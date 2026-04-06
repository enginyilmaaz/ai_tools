'use strict';

const { execFile } = require('child_process');
const { runShellCommand, runShellCommandVerbose, claudeCmd, checkInternet } = require('./platform/core/exec');

function reply(sender, type, data) {
  sender.send('bridge-reply', { type, data });
}

async function isClaudeLoggedIn() {
  const out = await runShellCommand(claudeCmd('config list'), 10000);
  if (!out) return false;
  return !out.includes('Not logged in') && !out.includes('/login');
}

function openTerminalWithLogin() {
  // Open a native terminal window with claude login command
  if (process.platform === 'win32') {
    execFile('cmd.exe', ['/c', 'start', 'cmd', '/k', 'echo Claude login required && echo. && claude /login'], { windowsHide: false });
  } else {
    execFile('bash', ['-c',
      'x-terminal-emulator -e "bash -c \'echo Claude login required && claude /login && read\'" 2>/dev/null || ' +
      'gnome-terminal -- bash -c "echo Claude login required && claude /login && read" 2>/dev/null'
    ]);
  }
}

async function install(sender, data) {
  const { id } = data || {};
  if (!id) return reply(sender, 'pluginInstallResult', { id, success: false, message: 'No plugin ID' });

  // Check internet first
  if (!(await checkInternet())) {
    reply(sender, 'log', { message: `[Plugin] ${id} — no internet connection` });
    return reply(sender, 'pluginInstallResult', { id, success: false, message: 'No internet connection' });
  }

  // Check if Claude CLI is logged in
  if (!(await isClaudeLoggedIn())) {
    reply(sender, 'log', { message: '[Plugin] Claude CLI is not logged in — opening login terminal...' });
    reply(sender, 'pluginInstallResult', {
      id, success: false, message: 'Claude CLI not logged in',
      needsLogin: true
    });
    openTerminalWithLogin();
    // Retry after 10 seconds
    setTimeout(() => {
      reply(sender, 'log', { message: '[Plugin] Retrying plugin install after login...' });
      install(sender, data);
    }, 10000);
    return;
  }

  // If already installed, skip
  if (await isPluginInstalled(id)) {
    reply(sender, 'log', { message: `[Plugin] ${id} already installed` });
    return reply(sender, 'pluginInstallResult', { id, success: true, message: 'already installed' });
  }

  const cmd = claudeCmd(`plugin install ${id}`);
  reply(sender, 'log', { message: `[Plugin] Installing ${id} → cmd: ${cmd}` });
  const result = await runShellCommandVerbose(cmd, 60000);
  const success = await isPluginInstalled(id);
  if (success) {
    reply(sender, 'log', { message: `[Plugin] ${id} installed successfully` });
    reply(sender, 'log', { message: '[Plugin] Reload: restart Claude Code or run /mcp to apply' });
  } else {
    const errMsg = result.error || result.output || 'Installation failed';
    reply(sender, 'log', { message: `[Plugin] ${id} FAILED — ${errMsg}` });
    if (result.command) reply(sender, 'log', { message: `[Plugin] Command used: ${result.command}` });
  }
  reply(sender, 'pluginInstallResult', {
    id,
    success,
    message: success ? '' : (result.error || result.output || 'Installation failed')
  });
}

async function remove(sender, data) {
  const { id } = data || {};
  const cmd = claudeCmd(`plugin remove ${id}`);
  reply(sender, 'log', { message: `[Plugin] Removing ${id} → cmd: ${cmd}` });
  const result = await runShellCommandVerbose(cmd, 15000);
  const success = !(await isPluginInstalled(id));
  if (success) {
    reply(sender, 'log', { message: `[Plugin] ${id} removed successfully` });
    reply(sender, 'log', { message: '[Plugin] Reload: restart Claude Code or run /mcp to apply' });
  } else {
    reply(sender, 'log', { message: `[Plugin] ${id} removal FAILED — ${result.error || 'unknown'}` });
  }
  reply(sender, 'pluginRemoveResult', { id, success, message: success ? '' : (result.error || 'Removal failed') });
}

async function checkStatus(sender) {
  reply(sender, 'log', { message: '[Plugin] Checking installed plugins...' });
  const installed = await listInstalledPlugins();
  if (installed.length > 0) {
    reply(sender, 'log', { message: `[Plugin] Found ${installed.length} plugin(s): ${installed.join(', ')}` });
  } else {
    reply(sender, 'log', { message: '[Plugin] No plugins installed' });
  }
  reply(sender, 'pluginStatusResult', { installed });
}

async function isPluginInstalled(id) {
  const installed = await listInstalledPlugins();
  return installed.includes(id);
}

async function listInstalledPlugins() {
  const installed = [];

  // Parse "claude plugin list" output
  // Format: "  ❯ figma@claude-plugins-official"
  const out = await runShellCommand(claudeCmd('plugin list'), 10000);
  if (!out) {
    return installed;
  }

  const lines = out.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('@claude-plugins-official')) {
      const atIdx = trimmed.indexOf('@');
      if (atIdx > 0) {
        const name = trimmed.substring(0, atIdx).replace(/^[❯>\u276f\u2770\s]+/, '').trim();
        if (name && !installed.includes(name)) {
          installed.push(name);
        }
      }
    }
  }

  return installed;
}

module.exports = { install, remove, checkStatus };
