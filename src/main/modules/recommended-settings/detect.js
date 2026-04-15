'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function binaryInstalled(name) {
  // Fast path: look it up in the current process PATH.
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    execFileSync(cmd, [name], { timeout: 3000, windowsHide: true, stdio: 'ignore' });
    return true;
  } catch (_) { /* fall through */ }

  if (process.platform === 'linux') {
    // Electron launched from a .desktop file inherits a sparse PATH that
    // misses nvm / asdf / ~/.local/bin. An interactive bash is the only
    // reliable way to trigger the user's full rc chain (the default Ubuntu
    // .bashrc has an early return for non-interactive shells).
    try {
      execFileSync('bash', ['-ic', 'command -v ' + name + ' >/dev/null'], {
        timeout: 3000, windowsHide: true, stdio: 'ignore'
      });
      return true;
    } catch (_) {}
    return false;
  }

  if (process.platform === 'win32') {
    // Electron on Windows, launched from Start menu / Explorer, often does
    // not inherit %AppData%\npm on PATH even when the user's shell does.
    // Probe common per-user install locations for a '<name>.cmd' / '.exe'
    // and NVM's node-version directories.
    const home = os.homedir();
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const localAppdata = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const candidates = [
      path.join(appdata, 'npm', name + '.cmd'),
      path.join(appdata, 'npm', name + '.exe'),
      path.join(localAppdata, 'npm', name + '.cmd'),
      path.join(home, 'scoop', 'shims', name + '.exe'),
      path.join(home, '.local', 'bin', name + '.cmd'),
      path.join(home, '.local', 'bin', name + '.exe')
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return true;
    }
    // Look through any NVM-for-Windows node installs: %APPDATA%\nvm or C:\nvm
    const nvmRoots = [process.env.NVM_HOME, path.join(appdata, 'nvm'), 'C:\\nvm'].filter(Boolean);
    for (const root of nvmRoots) {
      try {
        if (!fs.existsSync(root)) continue;
        for (const entry of fs.readdirSync(root)) {
          const full = path.join(root, entry, name + '.cmd');
          if (fs.existsSync(full)) return true;
          const fullExe = path.join(root, entry, name + '.exe');
          if (fs.existsSync(fullExe)) return true;
        }
      } catch (_) {}
    }
  }

  return false;
}

function vscodeInstalled() {
  const paths = process.platform === 'win32' ? [
    path.join(process.env.PROGRAMFILES || '', 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd')
  ] : [
    '/usr/bin/code', '/usr/share/code/bin/code', '/snap/bin/code'
  ];
  for (const p of paths) if (fs.existsSync(p)) return true;
  return binaryInstalled(process.platform === 'win32' ? 'code.cmd' : 'code');
}

function detectLinuxFM() {
  if (process.platform !== 'linux') return null;
  try {
    const out = execFileSync('xdg-mime', ['query', 'default', 'inode/directory'], {
      timeout: 2000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (out.toLowerCase().includes('nautilus')) return 'nautilus';
    if (out.toLowerCase().includes('dolphin')) return 'dolphin';
    if (out.toLowerCase().includes('thunar')) return 'thunar';
    if (out.toLowerCase().includes('nemo')) return 'nemo';
  } catch (_) {}

  const desk = (process.env.XDG_CURRENT_DESKTOP || '').toLowerCase();
  if (desk.includes('gnome') && binaryInstalled('nautilus')) return 'nautilus';
  if (desk.includes('kde') && binaryInstalled('dolphin')) return 'dolphin';
  if (desk.includes('xfce') && binaryInstalled('thunar')) return 'thunar';
  if (desk.includes('cinnamon') && binaryInstalled('nemo')) return 'nemo';

  if (binaryInstalled('nautilus')) return 'nautilus';
  return null;
}

function pythonNautilusInstalled() {
  if (process.platform !== 'linux') return false;
  const candidates = [
    '/usr/lib/python3/dist-packages/gi/overrides/Nautilus.py',
    '/usr/lib/python3/dist-packages/nautilus/__init__.py',
    '/usr/share/nautilus-python'
  ];
  if (candidates.some(p => fs.existsSync(p))) return true;
  try {
    execFileSync('dpkg', ['-s', 'python3-nautilus'], {
      timeout: 3000, stdio: 'ignore', windowsHide: true
    });
    return true;
  } catch (_) { return false; }
}

function detectCapabilities() {
  const fm = detectLinuxFM();
  return {
    vscode: vscodeInstalled(),
    claude: binaryInstalled('claude'),
    codex:  binaryInstalled('codex'),
    platform: process.platform,
    fileManager: fm,
    ctxmenuSupported:
      process.platform === 'win32' ||
      (process.platform === 'linux' && fm === 'nautilus'),
    pythonNautilusInstalled: pythonNautilusInstalled()
  };
}

module.exports = {
  binaryInstalled,
  vscodeInstalled,
  detectLinuxFM,
  pythonNautilusInstalled,
  detectCapabilities
};
