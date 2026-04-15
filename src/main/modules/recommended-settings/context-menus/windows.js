'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ICON_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'smartmarine-ai', 'icons'
);

// Absolute path to reg.exe — Electron launched from Start / Explorer can
// hand down a PATH without %SystemRoot%\System32, which made every
// `reg add` call crash with ENOENT. Always use the System32 copy.
const REG_EXE = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');

function iconPathFor(brand) { return path.join(ICON_DIR, `${brand}.ico`); }

function sourceIcon(brand) {
  const packaged = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'src', 'renderer', 'assets', 'recommended-settings', 'platform', `${brand}.ico`);
  const dev = path.join(__dirname, '..', '..', '..', '..', 'renderer', 'assets', 'recommended-settings', 'platform', `${brand}.ico`);
  return fs.existsSync(packaged) ? packaged : dev;
}

function ensureIcon(brand) {
  fs.mkdirSync(ICON_DIR, { recursive: true });
  const dst = iconPathFor(brand);
  if (fs.existsSync(dst)) return dst;
  fs.copyFileSync(sourceIcon(brand), dst);
  return dst;
}

function regAdd(keyPath, valueName, data) {
  const args = ['add', keyPath];
  if (valueName === '') args.push('/ve'); else args.push('/v', valueName);
  args.push('/d', data, '/f');
  execFileSync(REG_EXE, args, { windowsHide: true, timeout: 5000 });
}

function regDelete(keyPath) {
  try {
    execFileSync(REG_EXE, ['delete', keyPath, '/f'], { windowsHide: true, timeout: 5000 });
  } catch (_) { /* idempotent */ }
}

function regQuery(keyPath) {
  try {
    execFileSync(REG_EXE, ['query', keyPath], { windowsHide: true, timeout: 5000, stdio: 'ignore' });
    return true;
  } catch (_) { return false; }
}

function keyBase(id) { return `HKCU\\Software\\Classes\\Directory\\shell\\SmaiOpen${id}`; }
function keyBackground(id) { return `HKCU\\Software\\Classes\\Directory\\Background\\shell\\SmaiOpen${id}`; }

function isApplied({ id }) {
  return regQuery(keyBase(id)) && regQuery(keyBackground(id));
}

function apply({ id, label, brand, runCmd, runInTerminal }) {
  const icon = ensureIcon(brand);
  const cmdline = runInTerminal
    ? `cmd.exe /k pushd "%V" && ${runCmd}`
    : `${runCmd} "%V"`;

  for (const root of [keyBase(id), keyBackground(id)]) {
    regAdd(root, '', label);
    regAdd(root, 'Icon', icon);
    regAdd(root + '\\command', '', cmdline);
  }
  return { success: true };
}

function revert({ id }) {
  regDelete(keyBase(id));
  regDelete(keyBackground(id));
  return { success: true };
}

module.exports = { apply, revert, isApplied };
