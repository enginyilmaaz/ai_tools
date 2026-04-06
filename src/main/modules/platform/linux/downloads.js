'use strict';

const os = require('os');

const arch = os.arch();

const LinuxDownloads = {
  nvm: 'https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh',
  claude: 'https://claude.ai/install.sh',
  vscode: {
    x64: 'https://update.code.visualstudio.com/latest/linux-deb-x64/stable',
    arm64: 'https://update.code.visualstudio.com/latest/linux-deb-arm64/stable'
  },
  claudeDesktop: {
    x64: 'https://storage.googleapis.com/anthropic-desktop/claude-desktop_latest_amd64.deb',
    arm64: 'https://storage.googleapis.com/anthropic-desktop/claude-desktop_latest_arm64.deb'
  },
  githubCli: {
    x64: 'https://github.com/cli/cli/releases/latest/download/gh_linux_amd64.deb',
    arm64: 'https://github.com/cli/cli/releases/latest/download/gh_linux_arm64.deb',
    getUrl() {
      return this[arch] || this.x64;
    }
  },
  git: null,
  getUrl(tool) {
    const entry = this[tool];
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    if (typeof entry.getUrl === 'function') return entry.getUrl();
    return entry[arch] || entry.x64 || null;
  }
};

module.exports = { LinuxDownloads };
