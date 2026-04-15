'use strict';

const windowsImpl = require('./windows');
const linuxImpl = require('./linux-nautilus');

function pick() {
  if (process.platform === 'win32') return windowsImpl;
  if (process.platform === 'linux') return linuxImpl;
  return null;
}

function apply(item) {
  const impl = pick();
  if (!impl) return { success: false, message: 'Unsupported platform' };
  return impl.apply(item);
}

function revert(item) {
  const impl = pick();
  if (!impl) return { success: false, message: 'Unsupported platform' };
  return impl.revert(item);
}

function isApplied(item) {
  const impl = pick();
  if (!impl) return false;
  return impl.isApplied(item);
}

function installPrerequisites(logger) {
  if (process.platform === 'linux') return linuxImpl.installPythonNautilus(logger);
  return Promise.resolve({ success: true });
}

function restartFileManager(logger) {
  if (process.platform === 'linux') return linuxImpl.restartNautilus(logger);
  return Promise.resolve({ success: true });
}

module.exports = { apply, revert, isApplied, installPrerequisites, restartFileManager };
