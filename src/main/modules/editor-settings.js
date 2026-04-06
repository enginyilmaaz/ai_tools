'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const RECOMMENDED_SETTINGS = {
  'claudeCode.allowDangerouslySkipPermissions': true,
  'claudeCode.initialPermissionMode': 'bypassPermissions',
  'git.autofetch': true,
  'editor.minimap.enabled': false,
  'terminal.integrated.stickyScroll.enabled': false,
  'chat.disableAIFeatures': true
};

const SETTING_LABELS = {
  'claudeCode.allowDangerouslySkipPermissions': 'Claude Code Skip Permissions (Dangerously)',
  'claudeCode.initialPermissionMode': 'Claude Code Initial Permission Mode',
  'git.autofetch': 'Git Auto Fetch',
  'editor.minimap.enabled': 'Minimap',
  'terminal.integrated.stickyScroll.enabled': 'Terminal Sticky Scroll',
  'chat.disableAIFeatures': 'Disable AI Chat Features'
};

function getSettingsPaths() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return {
      vscode: path.join(appdata, 'Code', 'User', 'settings.json')
    };
  }
  return {
    vscode: path.join(home, '.config', 'Code', 'User', 'settings.json')
  };
}

function editorInstalled(editor) {
  if (editor === 'vscode') {
    // Check known paths first (faster, no PATH dependency)
    const knownPaths = process.platform === 'win32' ? [
      path.join(process.env.PROGRAMFILES || '', 'Microsoft VS Code', 'bin', 'code.cmd'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd')
    ] : [
      '/usr/bin/code', '/usr/share/code/bin/code', '/snap/bin/code'
    ];
    for (const p of knownPaths) {
      if (fs.existsSync(p)) return true;
    }
  }
  // Fallback: which/where
  const { execFileSync } = require('child_process');
  const binary = editor === 'vscode' ? 'code' : editor;
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(cmd, [binary], { timeout: 3000, windowsHide: true });
    return true;
  } catch (_) {
    return false;
  }
}

function stripJsonComments(text) {
  // Remove single-line comments
  let result = text.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

function readSettingsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    // Try stripping comments (JSONC)
    try {
      return JSON.parse(stripJsonComments(raw));
    } catch (_2) {
      return {};
    }
  }
}

function readEditorSettings(editor) {
  const paths = getSettingsPaths();
  const settingsPath = paths[editor];
  if (!settingsPath) return null;

  const installed = editorInstalled(editor);
  if (!installed) return null;

  const current = readSettingsFile(settingsPath);
  const result = {};

  for (const [key, recommendedValue] of Object.entries(RECOMMENDED_SETTINGS)) {
    const currentValue = current.hasOwnProperty(key) ? current[key] : undefined;
    const alreadyApplied = currentValue === recommendedValue;
    result[key] = {
      label: SETTING_LABELS[key] || key,
      currentValue: currentValue,
      newValue: recommendedValue,
      alreadyApplied: alreadyApplied
    };
  }

  return result;
}

function applyEditorSettings(editor) {
  const paths = getSettingsPaths();
  const settingsPath = paths[editor];
  if (!settingsPath) return { success: false, message: 'Unknown editor' };

  // Ensure directory exists
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const current = readSettingsFile(settingsPath);

  // Merge recommended settings
  for (const [key, value] of Object.entries(RECOMMENDED_SETTINGS)) {
    current[key] = value;
  }

  try {
    fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getEditorSettingsInfo() {
  const editors = {};
  if (editorInstalled('vscode')) {
    editors.vscode = readEditorSettings('vscode');
  }
  // Show shell alias status
  const aliasInfo = {};
  for (const [alias, command] of Object.entries(BASH_ALIASES)) {
    const exists = checkAliasExists(alias);
    aliasInfo[alias] = {
      label: alias,
      currentValue: exists ? command : undefined,
      newValue: command,
      alreadyApplied: exists
    };
  }
  editors.shellAliases = aliasInfo;
  return editors;
}

function checkAliasExists(alias) {
  const home = os.homedir();
  if (process.platform === 'linux') {
    const bashrc = path.join(home, '.bashrc');
    if (!fs.existsSync(bashrc)) return false;
    return fs.readFileSync(bashrc, 'utf8').includes('alias ' + alias + '=');
  } else if (process.platform === 'win32') {
    const cmdFile = path.join(home, '.local', 'bin', alias + '.cmd');
    return fs.existsSync(cmdFile);
  }
  return false;
}

function applyAllEditorSettings() {
  const results = {};
  if (editorInstalled('vscode')) {
    results.vscode = applyEditorSettings('vscode');
  }
  if (process.platform === 'linux') {
    results.shellAliases = applyBashAliases();
  } else if (process.platform === 'win32') {
    results.shellAliases = applyCmdAliases();
    // Clean up PS profile if we created it (causes security errors)
    cleanupPsProfile();
  }
  return results;
}

const BASH_ALIASES = {
  'claude-skip': 'claude --dangerously-skip-permissions',
  'ccskip': 'claude --dangerously-skip-permissions',
  'codex-skip': 'codex --full-auto'
};

function applyBashAliases() {
  const home = os.homedir();
  const bashrcPath = path.join(home, '.bashrc');
  const results = [];

  if (!fs.existsSync(bashrcPath)) {
    return { success: false, message: '.bashrc not found' };
  }

  let content = fs.readFileSync(bashrcPath, 'utf8');
  let added = 0;

  for (const [alias, command] of Object.entries(BASH_ALIASES)) {
    const aliasLine = `alias ${alias}='${command}'`;
    if (content.includes(aliasLine)) {
      results.push({ alias, status: 'already exists' });
      continue;
    }
    // Remove old alias if exists with different value
    const aliasRegex = new RegExp(`^alias ${alias}=.*$`, 'gm');
    content = content.replace(aliasRegex, '');
    content = content.trimEnd() + '\n' + aliasLine + '\n';
    results.push({ alias, status: 'added' });
    added++;
  }

  if (added > 0) {
    try {
      fs.writeFileSync(bashrcPath, content, 'utf8');
    } catch (err) {
      return { success: false, message: err.message, results };
    }
  }

  return { success: true, results, added };
}

function cleanupPsProfile() {
  const home = os.homedir();
  const psProfile = path.join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
  if (!fs.existsSync(psProfile)) return;
  try {
    let content = fs.readFileSync(psProfile, 'utf8');
    // Remove our function definitions
    const funcs = ['claude-skip', 'ccskip', 'codex-skip'];
    for (const name of funcs) {
      content = content.replace(new RegExp(`function ${name}\\s*\\{[^}]*\\}\\s*\\n?`, 'g'), '');
    }
    content = content.trim();
    if (!content) {
      fs.unlinkSync(psProfile);
    } else {
      fs.writeFileSync(psProfile, content + '\n', 'utf8');
    }
  } catch (_) {}
}

function applyPowerShellAliases() {
  const home = os.homedir();
  const docsDir = path.join(home, 'Documents');
  const psProfileDir = path.join(docsDir, 'WindowsPowerShell');
  const psProfilePath = path.join(psProfileDir, 'Microsoft.PowerShell_profile.ps1');
  const results = [];

  const PS_FUNCTIONS = {
    'claude-skip': 'function claude-skip { claude --dangerously-skip-permissions @args }',
    'ccskip': 'function ccskip { claude --dangerously-skip-permissions @args }',
    'codex-skip': 'function codex-skip { codex --full-auto @args }'
  };

  fs.mkdirSync(psProfileDir, { recursive: true });
  let content = '';
  if (fs.existsSync(psProfilePath)) {
    content = fs.readFileSync(psProfilePath, 'utf8');
  }

  let added = 0;
  for (const [name, funcLine] of Object.entries(PS_FUNCTIONS)) {
    if (content.includes(funcLine)) {
      results.push({ alias: name, status: 'already exists' });
      continue;
    }
    // Remove old version if exists
    const funcRegex = new RegExp(`^function ${name}\\s*\\{[^}]*\\}\\s*$`, 'gm');
    content = content.replace(funcRegex, '');
    content = content.trimEnd() + '\n' + funcLine + '\n';
    results.push({ alias: name, status: 'added' });
    added++;
  }

  if (added > 0) {
    try {
      fs.writeFileSync(psProfilePath, content, 'utf8');
    } catch (err) {
      return { success: false, message: err.message, results };
    }
  }

  return { success: true, results, added };
}

function applyCmdAliases() {
  // Create .cmd batch files in %USERPROFILE%\.local\bin (same dir as Claude CLI)
  const home = os.homedir();
  const binDir = path.join(home, '.local', 'bin');
  fs.mkdirSync(binDir, { recursive: true });

  const CMD_SCRIPTS = {
    'claude-skip': '@echo off\r\nclaude --dangerously-skip-permissions %*',
    'ccskip': '@echo off\r\nclaude --dangerously-skip-permissions %*',
    'codex-skip': '@echo off\r\ncodex --full-auto %*'
  };

  const results = [];
  let added = 0;

  for (const [name, script] of Object.entries(CMD_SCRIPTS)) {
    const cmdPath = path.join(binDir, name + '.cmd');
    if (fs.existsSync(cmdPath)) {
      const existing = fs.readFileSync(cmdPath, 'utf8');
      if (existing.trim() === script.trim()) {
        results.push({ alias: name + '.cmd', status: 'already exists' });
        continue;
      }
    }
    try {
      fs.writeFileSync(cmdPath, script, 'utf8');
      results.push({ alias: name + '.cmd', status: 'added' });
      added++;
    } catch (err) {
      results.push({ alias: name + '.cmd', status: 'failed: ' + err.message });
    }
  }

  return { success: true, results, added };
}

module.exports = {
  getRecommendedSettings: () => RECOMMENDED_SETTINGS,
  getSettingLabels: () => SETTING_LABELS,
  readEditorSettings,
  applyEditorSettings,
  getEditorSettingsInfo,
  applyAllEditorSettings,
  getSettingsPaths,
  editorInstalled
};
