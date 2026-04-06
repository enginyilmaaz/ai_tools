'use strict';

const { runShellCommand, runShellCommandVerbose, claudeCmd, checkInternet } = require('./platform/core/exec');

function reply(sender, type, data) {
  sender.send('bridge-reply', { type, data });
}

async function install(sender, data) {
  const { id } = data || {};
  if (!id) return reply(sender, 'pluginInstallResult', { id, success: false, message: 'No plugin ID' });

  // Check internet first
  if (!(await checkInternet())) {
    reply(sender, 'log', { message: `[Plugin] ${id} — no internet connection` });
    return reply(sender, 'pluginInstallResult', { id, success: false, message: 'No internet connection' });
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
    // If login required, show message (no terminal)
    if (errMsg.includes('not found') || errMsg.includes('Not logged in') || errMsg.includes('/login')) {
      reply(sender, 'log', { message: '[Plugin] Claude CLI login required. Open CMD or PowerShell, run "claude /login", then try again.' });
      reply(sender, 'pluginInstallResult', { id, success: false, message: errMsg, needsLogin: true });
      return;
    }
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
