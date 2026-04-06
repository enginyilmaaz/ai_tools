'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client } = require('pg');
const { runShellCommand, runShellCommandVerbose, claudeCmd, checkInternet } = require('./platform/core/exec');
const { getCommands, getPaths } = require('./platform');

const USER_SCOPE = 'user';
const LEGACY_MCP_SCOPES = ['local', 'project'];

function reply(sender, type, data) {
  sender.send('bridge-reply', { type, data });
}

function getUserConfigPath() {
  return path.join(os.homedir(), '.claude.json');
}

function createDefaultUserClaudeConfig() {
  return {
    firstStartTime: new Date().toISOString(),
    opusProMigrationComplete: true,
    sonnet1m45MigrationComplete: true,
    mcpServers: {}
  };
}

function readUserClaudeConfig() {
  const configPath = getUserConfigPath();
  if (!fs.existsSync(configPath)) {
    return createDefaultUserClaudeConfig();
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_) {
    return createDefaultUserClaudeConfig();
  }
}

function ensureUserConfigEntry(config) {
  if (!config || typeof config !== 'object') {
    config = createDefaultUserClaudeConfig();
  }
  if (!config.firstStartTime) {
    config.firstStartTime = new Date().toISOString();
  }
  if (typeof config.opusProMigrationComplete !== 'boolean') {
    config.opusProMigrationComplete = true;
  }
  if (typeof config.sonnet1m45MigrationComplete !== 'boolean') {
    config.sonnet1m45MigrationComplete = true;
  }
  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    config.mcpServers = {};
  }

  return config;
}

function listUserConfiguredMcpServers() {
  const config = ensureUserConfigEntry(readUserClaudeConfig());
  return Object.keys(config.mcpServers);
}

function getUserConfiguredMcpServer(id) {
  const config = ensureUserConfigEntry(readUserClaudeConfig());
  return config.mcpServers[id] || null;
}

async function removeMcpFromScope(id, scope) {
  const output = await runShellCommand(claudeCmd(`mcp remove -s ${scope} ${id}`), 15000);
  return output !== null;
}

async function cleanupLegacyMcpScopes(id) {
  for (const scope of LEGACY_MCP_SCOPES) {
    await removeMcpFromScope(id, scope);
  }
}

async function addUserScopedMcp(id, values) {
  const args = buildMcpArgs(id, values || {});
  return runShellCommand(claudeCmd(`mcp add --scope ${USER_SCOPE} ${args}`), 60000);
}

function needsMcpAuth(id) {
  return id === 'atlassian' || id === 'postman';
}

async function install(sender, data) {
  const { id, values } = data || {};
  if (!id) return reply(sender, 'mcpInstallResult', { id, success: false, message: 'No server ID' });

  // Check internet first
  if (!(await checkInternet())) {
    reply(sender, 'log', { message: `[MCP] ${id} — no internet connection` });
    return reply(sender, 'mcpInstallResult', { id, success: false, message: 'No internet connection' });
  }

  // If already configured in user scope, skip install
  if (listUserConfiguredMcpServers().includes(id)) {
    reply(sender, 'log', { message: `[MCP] ${id} already installed` });
    return reply(sender, 'mcpInstallResult', {
      id,
      success: true,
      message: 'already installed',
      needsAuth: needsMcpAuth(id)
    });
  }

  const args = buildMcpArgs(id, values || {});
  const fullCmd = claudeCmd(`mcp add --scope ${USER_SCOPE} ${args}`);
  reply(sender, 'log', { message: `[MCP] Installing ${id} → cmd: ${fullCmd}` });
  const result = await runShellCommandVerbose(fullCmd, 60000);
  const success = result.success && listUserConfiguredMcpServers().includes(id);
  if (success) {
    await cleanupLegacyMcpScopes(id);
    reply(sender, 'log', { message: `[MCP] ${id} installed successfully` });
    reply(sender, 'log', { message: '[MCP] Reload: restart Claude Code or run /mcp to apply' });
  } else {
    reply(sender, 'log', { message: `[MCP] ${id} FAILED — ${result.error || 'unknown'}` });
    if (result.command) reply(sender, 'log', { message: `[MCP] Command used: ${result.command}` });
  }

  reply(sender, 'mcpInstallResult', {
    id,
    success,
    message: success ? '' : (result.error || 'Installation failed'),
    needsAuth: needsMcpAuth(id)
  });
}

async function testConnection(sender, data) {
  const { id, values } = data || {};
  if (id !== 'postgres') {
    return reply(sender, 'mcpTestResult', { id, success: false, message: 'Test not supported' });
  }

  let client = null;
  try {
    const config = buildPostgresClientConfig(values);
    client = new Client(config);
    await client.connect();
    await client.query('select 1');
    reply(sender, 'mcpTestResult', { id, success: true, message: '' });
  } catch (err) {
    const errMsg = err && err.message ? err.message : 'Connection failed';
    reply(sender, 'log', { message: `[MCP] ${id} test failed — ${errMsg}` });
    reply(sender, 'mcpTestResult', { id, success: false, message: errMsg });
  } finally {
    if (client) {
      try { await client.end(); } catch (_) {}
    }
  }
}

async function checkStatus(sender) {
  reply(sender, 'log', { message: '[MCP] Checking installed MCP servers...' });
  const installed = await listInstalledMcpServers();
  if (installed.length > 0) {
    reply(sender, 'log', { message: `[MCP] Found ${installed.length} server(s): ${installed.join(', ')}` });
  } else {
    reply(sender, 'log', { message: '[MCP] No MCP servers configured' });
  }
  reply(sender, 'mcpStatusResult', { installed });
}

async function getConfig(sender, data) {
  const { id } = data || {};
  try {
    const values = await getConfigValues(id);
    reply(sender, 'mcpConfigResult', { id, found: true, values });
  } catch (err) {
    reply(sender, 'mcpConfigResult', { id, found: false, values: {} });
  }
}

async function saveConfig(sender, data) {
  const { id, values } = data || {};
  await removeMcpFromScope(id, USER_SCOPE);

  const result = await addUserScopedMcp(id, values);
  const success = result !== null && hasMatchingUserConfig(id, values);

  if (success) {
    await cleanupLegacyMcpScopes(id);
  }

  reply(sender, 'mcpSaveResult', {
    id,
    success,
    message: success ? '' : 'Configuration save failed'
  });
}

async function remove(sender, data) {
  const { id } = data || {};
  const removeCmd = claudeCmd(`mcp remove -s ${USER_SCOPE} ${id}`);
  reply(sender, 'log', { message: `[MCP] Removing ${id} → cmd: ${removeCmd}` });
  await removeMcpFromScope(id, USER_SCOPE);
  for (const scope of LEGACY_MCP_SCOPES) {
    await removeMcpFromScope(id, scope);
  }

  const success = !(await isInstalled(id));
  if (success) {
    reply(sender, 'log', { message: `[MCP] ${id} removed successfully` });
    reply(sender, 'log', { message: '[MCP] Reload: restart Claude Code or run /mcp to apply' });
  } else {
    reply(sender, 'log', { message: `[MCP] ${id} removal FAILED` });
  }
  reply(sender, 'mcpRemoveResult', {
    id,
    success,
    message: success ? '' : 'Removal failed'
  });
}

async function isInstalled(id) {
  const installed = await listInstalledMcpServers();
  return installed.includes(id);
}

async function listInstalledMcpServers() {
  const installed = [];
  const addInstalled = (name) => {
    if (name && !installed.includes(name)) {
      installed.push(name);
    }
  };

  listUserConfiguredMcpServers().forEach(addInstalled);

  const cliInstalled = await listCliConfiguredMcpServers();
  cliInstalled.forEach(addInstalled);

  return installed;
}

async function listCliConfiguredMcpServers() {
  const out = await runShellCommand(claudeCmd('mcp list'), 15000);
  return parseInstalledMcpServersFromCliOutput(out);
}

function parseInstalledMcpServersFromCliOutput(output) {
  const installed = [];

  if (!output) {
    return installed;
  }

  const addInstalled = (name) => {
    if (name && !installed.includes(name)) {
      installed.push(name);
    }
  };

  const lines = String(output).split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('Checking') || trimmed.startsWith('plugin:') || trimmed.startsWith('claude.ai ')) {
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      addInstalled(trimmed.substring(0, colonIdx).trim());
    }
  }

  return installed;
}

function hasMatchingUserConfig(id, expectedValues) {
  const config = getUserConfiguredMcpServer(id);
  if (!config) {
    return false;
  }

  const actualValues = parseConfigValues(id, config);
  switch (id) {
    case 'postgres':
      return ['host', 'port', 'database', 'username', 'password'].every((key) => {
        return normalizeConfigValue(actualValues[key]) === normalizeConfigValue(expectedValues && expectedValues[key]);
      });
    default:
      return true;
  }
}

function normalizeConfigValue(value) {
  return String(value == null ? '' : value).trim();
}

function buildMcpArgs(id, values) {
  const cmds = getCommands();
  const wrap = cmds.wrapNpx;

  switch (id) {
    case 'github':
      return `github --transport stdio -- ${wrap('@anthropic-ai/github-mcp-server')}`;
    case 'atlassian':
    case 'jira':
      return 'atlassian --transport http https://mcp.atlassian.com/v1/mcp';
    case 'postgres': {
      const dsn = buildPostgresDsn(values);
      return `postgres --transport stdio -- ${wrap(`@anthropic-ai/postgres-mcp-server "${dsn}"`)}`;
    }
    case 'postman':
      return 'postman --transport http https://mcp.postman.com/mcp';
    case 'figma': {
      const token = values.token || '';
      return `figma --transport stdio -e FIGMA_PERSONAL_ACCESS_TOKEN="${token}" -- ${wrap('@anthropic-ai/figma-mcp-server')}`;
    }
    default:
      return `${id} --transport stdio -- ${wrap(`@anthropic-ai/${id}-mcp-server`)}`;
  }
}

function parseConfigValues(id, config) {
  // Best-effort extraction from settings.json mcpServers entry
  const args = config.args || [];
  const env = config.env || {};
  const values = {};

  switch (id) {
    case 'postgres': {
      const dsnArg = args.find(a => a.startsWith('postgresql://'));
      if (dsnArg) {
        try {
          const url = new URL(dsnArg);
          values.host = url.hostname;
          values.port = url.port || '5432';
          values.database = url.pathname.replace('/', '');
          values.username = url.username;
          values.password = url.password;
        } catch (_) {}
      }
      break;
    }
    case 'jira':
      values.url = env.JIRA_URL || '';
      values.email = env.JIRA_EMAIL || '';
      values.token = env.JIRA_API_TOKEN || '';
      values.projectKey = env.JIRA_PROJECT_KEY || '';
      break;
    case 'figma':
      values.token = env.FIGMA_PERSONAL_ACCESS_TOKEN || '';
      break;
  }

  return values;
}

async function getConfigValues(id) {
  const userConfig = getUserConfiguredMcpServer(id);
  if (userConfig) {
    const userValues = parseConfigValues(id, userConfig);
    if (Object.keys(userValues).length > 0) {
      return userValues;
    }
  }

  const cliValues = await parseConfigValuesFromCli(id);
  if (Object.keys(cliValues).length > 0) {
    return cliValues;
  }

  const paths = getPaths();
  if (!fs.existsSync(paths.settingsJson)) {
    return {};
  }

  const settings = JSON.parse(fs.readFileSync(paths.settingsJson, 'utf8'));
  const serverConfig = settings.mcpServers && settings.mcpServers[id];
  if (!serverConfig) {
    return {};
  }

  return parseConfigValues(id, serverConfig);
}

async function parseConfigValuesFromCli(id) {
  try {
    const out = await runShellCommand(claudeCmd(`mcp get ${id}`), 15000);
    if (!out) return {};

    switch (id) {
      case 'postgres':
        return parsePostgresValuesFromCliOutput(out);
      default:
        return {};
    }
  } catch (_) {
    return {};
  }
}

function parsePostgresValuesFromCliOutput(output) {
  const values = {};
  const lines = String(output || '').split('\n');
  const argsLine = lines.find(line => line.trim().startsWith('Args:'));
  if (!argsLine) {
    return values;
  }

  const dsnMatch = argsLine.match(/postgres(?:ql)?:\/\/\S+/i);
  if (!dsnMatch) {
    return values;
  }

  try {
    const url = new URL(dsnMatch[0]);
    values.host = url.hostname;
    values.port = url.port || '5432';
    values.database = url.pathname.replace(/^\/+/, '');
    values.username = decodeURIComponent(url.username || '');
    values.password = decodeURIComponent(url.password || '');
  } catch (_) {}

  return values;
}

function buildPostgresClientConfig(values) {
  const { host, port, database, username, password } = values || {};

  return {
    host: host || 'localhost',
    port: Number(port || 5432),
    database: database || '',
    user: username || '',
    password: password || '',
    connectionTimeoutMillis: 5000
  };
}

function buildPostgresDsn(values) {
  const config = buildPostgresClientConfig(values);
  const url = new URL('postgresql://localhost');

  url.hostname = config.host;
  url.port = String(config.port);
  url.pathname = `/${config.database || ''}`;
  url.username = config.user;
  url.password = config.password;

  return url.toString();
}

module.exports = { install, testConnection, checkStatus, getConfig, saveConfig, remove };
