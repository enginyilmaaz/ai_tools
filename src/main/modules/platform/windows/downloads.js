'use strict';

const https = require('https');

const WindowsDownloads = {
  nvm: 'https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-setup.exe',
  nvmNoInstall: 'https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-noinstall.zip',
  claude: 'https://claude.ai/install.ps1',
  claudeCmd: 'https://claude.ai/install.cmd',
  vscode: 'https://update.code.visualstudio.com/latest/win32-x64/stable',
  claudeDesktop: 'https://downloads.claude.ai/releases/win32/ClaudeSetup.exe',

  getUrl(tool) {
    const staticUrls = {
      nvm: this.nvm,
      claude: this.claude,
      claudeCmd: this.claudeCmd,
      vscode: this.vscode,
      claudeDesktop: this.claudeDesktop
    };
    return staticUrls[tool] || null;
  },

  resolveGitUrl() {
    return resolveGithubAssetUrl(
      'https://api.github.com/repos/git-for-windows/git/releases/latest',
      /Git-.*-64-bit\.exe$/
    );
  },

  resolveGithubCliUrl() {
    return resolveGithubAssetUrl(
      'https://api.github.com/repos/cli/cli/releases/latest',
      /gh_.*_windows_amd64\.msi$/
    );
  }
};

function resolveGithubAssetUrl(apiUrl, pattern) {
  return new Promise((resolve) => {
    const req = https.get(apiUrl, {
      headers: { 'User-Agent': 'AITool/2.0', Accept: 'application/vnd.github.v3+json' },
      timeout: 10000
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const release = JSON.parse(body);
          const asset = (release.assets || []).find(a => pattern.test(a.name));
          if (asset) {
            console.log('[download] Resolved:', asset.browser_download_url);
          } else {
            console.warn('[download] No matching asset for pattern', pattern, 'in', apiUrl);
          }
          resolve(asset ? asset.browser_download_url : null);
        } catch (e) {
          console.error('[download] JSON parse failed for', apiUrl, e.message);
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

module.exports = { WindowsDownloads };
