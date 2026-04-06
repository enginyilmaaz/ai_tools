'use strict';

const { SharedPaths } = require('./core/shared-paths');
const { LinuxPaths } = require('./linux/paths');
const { WindowsPaths } = require('./windows/paths');
const { LinuxCommands } = require('./linux/commands');
const { WindowsCommands } = require('./windows/commands');
const { LinuxDownloads } = require('./linux/downloads');
const { WindowsDownloads } = require('./windows/downloads');
const LinuxApps = require('./linux/apps');
const WindowsApps = require('./windows/apps');

const platform = process.platform === 'win32'
  ? require('./windows/index')
  : require('./linux/index');

function getPlatformModule() {
  return platform;
}

function getPaths() {
  return process.platform === 'win32' ? WindowsPaths : LinuxPaths;
}

function getCommands() {
  return process.platform === 'win32' ? WindowsCommands : LinuxCommands;
}

function getDownloads() {
  return process.platform === 'win32' ? WindowsDownloads : LinuxDownloads;
}

function getApps() {
  return process.platform === 'win32' ? WindowsApps : LinuxApps;
}

module.exports = {
  platform,
  apps: getApps(),
  getPlatformModule,
  getApps,
  getPaths,
  getCommands,
  getDownloads,
  CommonPaths: SharedPaths,
  LinuxPaths,
  WindowsPaths,
  LinuxCommands,
  WindowsCommands,
  LinuxDownloads,
  WindowsDownloads,
  LinuxApps,
  WindowsApps
};
