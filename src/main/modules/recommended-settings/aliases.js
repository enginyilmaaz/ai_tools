'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MARKER_HEAD = '# smai-recommended-alias:';

function bashrcPath() { return path.join(os.homedir(), '.bashrc'); }
function winCmdPath(name) {
  return path.join(os.homedir(), '.local', 'bin', name + '.cmd');
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function isAppliedLinux(name, command) {
  const p = bashrcPath();
  if (!fs.existsSync(p)) return false;
  const content = fs.readFileSync(p, 'utf8');
  const exact = `alias ${name}='${command}'`;
  return content.includes(exact);
}

function applyLinux(name, command) {
  const p = bashrcPath();
  if (!fs.existsSync(p)) {
    return { success: false, message: '.bashrc not found' };
  }
  let content = fs.readFileSync(p, 'utf8');
  const exact = `alias ${name}='${command}'`;
  if (content.includes(exact)) return { success: true };
  content = content.replace(new RegExp(`^alias ${escapeRegex(name)}=.*$`, 'gm'), '');
  content = content.trimEnd() + '\n' + `${MARKER_HEAD} ${name}\n` + exact + '\n';
  fs.writeFileSync(p, content, 'utf8');
  return { success: true };
}

function revertLinux(name, command) {
  const p = bashrcPath();
  if (!fs.existsSync(p)) return { success: true };
  let content = fs.readFileSync(p, 'utf8');
  const exact = `alias ${name}='${command}'`;
  if (!content.includes(exact)) return { success: true };
  content = content.replace(new RegExp(`^${escapeRegex(MARKER_HEAD)}\\s+${escapeRegex(name)}\\s*\\n`, 'gm'), '');
  content = content.split('\n').filter(line => line !== exact).join('\n');
  fs.writeFileSync(p, content, 'utf8');
  return { success: true };
}

function isAppliedWindows(name, command) {
  const p = winCmdPath(name);
  if (!fs.existsSync(p)) return false;
  const expected = `@echo off\r\n${command} %*`;
  return fs.readFileSync(p, 'utf8').trim() === expected.trim();
}

function applyWindows(name, command) {
  const p = winCmdPath(name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `@echo off\r\n${command} %*`, 'utf8');
  return { success: true };
}

function revertWindows(name) {
  const p = winCmdPath(name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return { success: true };
}

function isApplied(name, command) {
  return process.platform === 'win32' ? isAppliedWindows(name, command) : isAppliedLinux(name, command);
}

function apply(name, command) {
  return process.platform === 'win32' ? applyWindows(name, command) : applyLinux(name, command);
}

function revert(name, command) {
  return process.platform === 'win32' ? revertWindows(name) : revertLinux(name, command);
}

module.exports = { isApplied, apply, revert };
