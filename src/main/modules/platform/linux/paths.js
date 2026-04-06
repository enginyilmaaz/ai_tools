'use strict';

const os = require('os');
const path = require('path');
const { SharedPaths } = require('../core/shared-paths');

const home = os.homedir();

const LinuxPaths = {
  ...SharedPaths,
  localBin: path.join(home, '.local', 'bin'),
  nvmDir: path.join(home, '.nvm'),
  nvmSh: path.join(home, '.nvm', 'nvm.sh'),
  vscodeSnap: '/snap/bin/code',
  claudeDesktop: '/opt/claude-desktop',
  claudeDesktopBin: '/usr/bin/claude-desktop',
  setupInstallDir: '/opt/AI Tool',
  desktopEntry: '/usr/share/applications/ai-tool.desktop'
};

module.exports = { LinuxPaths };
