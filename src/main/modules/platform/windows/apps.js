'use strict';

const WindowsApps = {
  node: {
    id: 'node',
    available: true,
    check: 'cmd /c node -v',
    install: {
      nvm: 'winget install -e --id CoreyButler.NVMforWindows --accept-package-agreements --accept-source-agreements',
      nodeViaNvm: 'cmd /c "nvm install lts && nvm use lts"'
    },
    download: {
      nvm: 'https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-setup.exe'
    }
  },
  git: {
    id: 'git',
    available: true,
    check: 'cmd /c git --version',
    install: {
      winget: 'winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements',
      silentArgs: '/VERYSILENT /NORESTART'
    },
    download: {
      api: 'https://api.github.com/repos/git-for-windows/git/releases/latest',
      fallback: null
    }
  },
  claude: {
    id: 'claude',
    available: true,
    check: 'cmd /c claude --version',
    checkFallback: 'cmd /c claude -v',
    install: {
      command: 'powershell -ExecutionPolicy Bypass -NoProfile -Command "irm https://claude.ai/install.ps1 | iex"'
    },
    download: {
      script: 'https://claude.ai/install.ps1'
    }
  },
  vscode: {
    id: 'vscode',
    available: true,
    check: 'cmd /c code --version',
    install: {
      winget: 'winget install -e --id Microsoft.VisualStudioCode --scope machine --accept-package-agreements --accept-source-agreements',
      silentArgs: '/verysilent /mergetasks=!runcode'
    },
    download: {
      x64: 'https://update.code.visualstudio.com/latest/win32-x64/stable'
    }
  },
  claudeDesktop: {
    id: 'claudeDesktop',
    available: true,
    check: null,
    install: {
      winget: 'winget install -e --id Anthropic.Claude --scope user --accept-package-agreements --accept-source-agreements'
    },
    download: {
      x64: 'https://downloads.claude.ai/releases/win32/ClaudeSetup.exe'
    }
  },
  codexCli: {
    id: 'codexCli',
    available: true,
    check: 'cmd /c codex --version',
    install: {
      command: 'cmd /c npm install -g @openai/codex'
    },
    download: null
  },
  codexApp: {
    id: 'codexApp',
    available: true,
    check: null,
    install: {
      winget: 'winget install -e --id 9PLM9XGG6VKS --source msstore --accept-package-agreements --accept-source-agreements'
    },
    download: {
      store: 'https://apps.microsoft.com/detail/9plm9xgg6vks'
    }
  },
  githubCli: {
    id: 'githubCli',
    available: true,
    check: 'cmd /c gh --version',
    install: {
      winget: 'winget install -e --id GitHub.cli --accept-package-agreements --accept-source-agreements'
    },
    download: {
      x64: 'https://github.com/cli/cli/releases/latest/download/gh_windows_amd64.msi'
    }
  },
  vscodeClaude: {
    id: 'vscodeClaude',
    available: true,
    extensionId: 'anthropic.claude-code',
    editor: 'code',
    check: (editor) => `cmd /c ${editor} --list-extensions`,
    install: (editor, id) => `cmd /c ${editor} --install-extension ${id} --force`
  },
  vscodeCodex: {
    id: 'vscodeCodex',
    available: true,
    extensionId: 'openai.chatgpt',
    editor: 'code',
    check: (editor) => `cmd /c ${editor} --list-extensions`,
    install: (editor, id) => `cmd /c ${editor} --install-extension ${id} --force`
  },
};

module.exports = WindowsApps;
