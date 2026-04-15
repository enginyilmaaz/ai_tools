'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function settingsPath() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appdata, 'Code', 'User', 'settings.json');
  }
  return path.join(home, '.config', 'Code', 'User', 'settings.json');
}

function stripJsonComments(text) {
  return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function readSettings() {
  const p = settingsPath();
  if (!fs.existsSync(p)) return {};
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch (_) {
    try { return JSON.parse(stripJsonComments(raw)); }
    catch (_) { return {}; }
  }
}

function writeSettings(obj) {
  const p = settingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function isApplied(key, expectedValue) {
  const current = readSettings();
  return Object.prototype.hasOwnProperty.call(current, key) && current[key] === expectedValue;
}

function apply(key, value) {
  const current = readSettings();
  current[key] = value;
  writeSettings(current);
  return { success: true };
}

function revert(key) {
  const current = readSettings();
  if (Object.prototype.hasOwnProperty.call(current, key)) {
    delete current[key];
    writeSettings(current);
  }
  return { success: true };
}

module.exports = { settingsPath, isApplied, apply, revert };
