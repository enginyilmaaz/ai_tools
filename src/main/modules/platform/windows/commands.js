'use strict';

const WindowsCommands = {
  checkNode: 'cmd /c node -v',
  checkGit: 'cmd /c git --version',
  checkClaude: 'cmd /c claude --version',
  checkVSCode: 'cmd /c code --version',
  checkClaudeDesktop: null,
  checkExtensions: (editor) => `cmd /c ${editor} --list-extensions --show-versions`,
  checkNvm: 'cmd /c nvm version',
  installNvm: 'winget install -e --id CoreyButler.NVMforWindows --accept-package-agreements --accept-source-agreements --override "/VERYSILENT /NORESTART"',
  installNodeViaNvm: 'cmd /c "nvm install lts && nvm use lts"',
  installGit: 'winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements',
  installClaude: '%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -ExecutionPolicy Bypass -NoProfile -Command "irm https://claude.ai/install.ps1 | iex"',
  installVSCode: 'winget install -e --id Microsoft.VisualStudioCode --scope machine --accept-package-agreements --accept-source-agreements',
  installClaudeDesktop: 'winget install -e --id Anthropic.Claude --scope user --accept-package-agreements --accept-source-agreements',
  installExtension: (editor, id) => `cmd /c ${editor} --install-extension ${id} --force`,
  wrapNpx: (args) => `cmd /c npx ${args}`,
  registryCheckGit: 'reg query "HKLM\\SOFTWARE\\GitForWindows" /v InstallPath',
  registryCheckTheme: 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v AppsUseLightTheme'
};

module.exports = { WindowsCommands };
