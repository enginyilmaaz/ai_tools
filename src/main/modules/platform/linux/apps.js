'use strict';

const os = require('os');

const arch = os.arch();

const LinuxApps = {
  node: {
    id: 'node',
    available: true,
    check: 'node -v',
    install: {
      nvm: 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash',
      nodeViaNvm: 'bash -c "source ~/.nvm/nvm.sh && nvm install --lts && nvm use --lts"'
    },
    download: null
  },
  git: {
    id: 'git',
    available: true,
    check: 'git --version',
    install: {
      apt: 'apt-get install -y git'
    },
    download: null
  },
  claude: {
    id: 'claude',
    available: true,
    check: 'claude --version',
    checkFallback: 'claude -v',
    install: {
      command: 'curl -fsSL https://claude.ai/install.sh | sh'
    },
    download: {
      script: 'https://claude.ai/install.sh'
    }
  },
  vscode: {
    id: 'vscode',
    available: true,
    aptRepo: {
      keyUrl: 'https://packages.microsoft.com/keys/microsoft.asc',
      keyPath: '/usr/share/keyrings/microsoft.gpg',
      keyNeedsDearmor: true,
      sourceFile: '/etc/apt/sources.list.d/vscode.sources',
      sourceContents: [
        'Types: deb',
        'URIs: https://packages.microsoft.com/repos/code',
        'Suites: stable',
        'Components: main',
        'Architectures: amd64,arm64,armhf',
        'Signed-By: /usr/share/keyrings/microsoft.gpg'
      ].join('\n'),
      legacyFiles: ['/etc/apt/sources.list.d/vscode.list']
    },
    check: 'code --version',
    install: {
      apt: 'apt-get install -y code'
    },
    download: {
      x64: 'https://update.code.visualstudio.com/latest/linux-deb-x64/stable',
      arm64: 'https://update.code.visualstudio.com/latest/linux-deb-arm64/stable',
      getUrl() { return this[arch] || this.x64; }
    }
  },
  claudeDesktop: {
    id: 'claudeDesktop',
    available: false,
    check: null,
    install: null,
    download: null
  },
  codexCli: {
    id: 'codexCli',
    available: true,
    check: 'codex --version',
    install: {
      command: 'npm install -g @openai/codex'
    },
    download: null
  },
  codexApp: {
    id: 'codexApp',
    available: false,
    check: null,
    install: null,
    download: null
  },
  githubCli: {
    id: 'githubCli',
    available: true,
    check: 'gh --version',
    aptRepo: {
      keyUrl: 'https://cli.github.com/packages/githubcli-archive-keyring.gpg',
      keyPath: '/usr/share/keyrings/githubcli-archive-keyring.gpg',
      listFile: '/etc/apt/sources.list.d/github-cli.list',
      repoLine: 'deb [arch=${ARCH} signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main'
    },
    install: {
      apt: 'apt-get install -y gh'
    },
    download: {
      x64: 'https://github.com/cli/cli/releases/latest/download/gh_linux_amd64.deb',
      arm64: 'https://github.com/cli/cli/releases/latest/download/gh_linux_arm64.deb',
      getUrl() { return this[arch] || this.x64; }
    }
  },
  vscodeClaude: {
    id: 'vscodeClaude',
    available: true,
    extensionId: 'anthropic.claude-code',
    editor: 'code',
    check: (editor) => `${editor} --list-extensions`,
    install: (editor, id) => `${editor} --install-extension ${id} --force`
  },
  vscodeCodex: {
    id: 'vscodeCodex',
    available: true,
    extensionId: 'openai.chatgpt',
    editor: 'code',
    check: (editor) => `${editor} --list-extensions`,
    install: (editor, id) => `${editor} --install-extension ${id} --force`
  },
};

module.exports = LinuxApps;
