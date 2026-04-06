'use strict';

const os = require('os');
const path = require('path');
const { SharedPaths } = require('../core/shared-paths');

const home = os.homedir();

const WindowsPaths = {
  ...SharedPaths,
  nvmDir: path.join(process.env.APPDATA || '', 'nvm'),
  programFiles: process.env.PROGRAMFILES || 'C:\\Program Files',
  programFilesX86: process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
  localAppData: process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'),
  appData: process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
  gitPaths: [
    path.join(process.env.PROGRAMFILES || '', 'Git', 'cmd', 'git.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Git', 'bin', 'git.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Git', 'cmd', 'git.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Git', 'bin', 'git.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe')
  ],
  claudeCliPaths: [
    path.join(home, '.claude', 'local', 'claude.exe'),
    path.join(home, '.local', 'bin', 'claude.exe'),
    path.join(home, '.local', 'bin', 'claude.cmd'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'claude', 'claude.exe')
  ],
  setupInstallDir: path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AI Tool')
};

module.exports = { WindowsPaths };
