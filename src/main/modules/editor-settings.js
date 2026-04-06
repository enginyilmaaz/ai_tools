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
  return editors;
}

function applyAllEditorSettings() {
  const results = {};
  if (editorInstalled('vscode')) {
    results.vscode = applyEditorSettings('vscode');
  }
  return results;
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
