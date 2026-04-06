'use strict';

const LinuxCommands = {
  checkNode: 'node -v',
  checkGit: 'git --version',
  checkClaude: 'claude --version',
  checkVSCode: 'code --version',
  checkClaudeDesktop: 'claude-desktop --version',
  checkExtensions: (editor) => `${editor} --list-extensions --show-versions`,
  checkNvm: 'bash -c "source ~/.nvm/nvm.sh && nvm --version"',
  installNodeViaNvm: 'bash -c "source ~/.nvm/nvm.sh && nvm install --lts && nvm use --lts"',
  installGit: 'apt-get install -y git',
  installVSCodeApt: 'apt-get install -y code',
  installExtension: (editor, id) => `${editor} --install-extension ${id} --force`,
  wrapNpx: (args) => `npx ${args}`
};

module.exports = { LinuxCommands };
