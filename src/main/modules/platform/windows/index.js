'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { runCommand, runShellCommand, runShellCommandVerbose, downloadFile, runElevatedBatch } = require('../core/exec');
const { refreshPath } = require('./env');
const { WindowsCommands: cmd } = require('./commands');
const { WindowsDownloads: dl } = require('./downloads');
const { WindowsPaths: paths } = require('./paths');

async function checkNode() {
  const out = await runCommand(cmd.checkNode);
  if (out) return { found: true, version: out };

  // Fallback: check NVM symlink dir directly (NVM4W uses C:\nvm4w\nodejs)
  const nvmSymlinkCandidates = [
    process.env.NVM_SYMLINK,
    path.join(process.env.PROGRAMFILES || '', 'nodejs'),
    'C:\\nvm4w\\nodejs'
  ].filter(Boolean);
  let nodeExe = null;
  for (const dir of nvmSymlinkCandidates) {
    const candidate = path.join(dir, 'node.exe');
    if (fs.existsSync(candidate)) { nodeExe = candidate; break; }
  }
  if (nodeExe) {
    const ver = await runCommand(`"${nodeExe}" -v`);
    return { found: true, version: ver || 'installed' };
  }

  // Fallback: check if nvm is installed and has a version
  const nvmOut = await runCommand('cmd /c nvm current');
  if (nvmOut && nvmOut.trim() !== '' && !nvmOut.includes('No current')) {
    return { found: true, version: nvmOut.trim() };
  }

  return { found: false, version: null };
}

async function checkGit() {
  const out = await runCommand(cmd.checkGit);
  if (out) {
    const match = out.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : out };
  }
  for (const gitPath of paths.gitPaths) {
    if (fs.existsSync(gitPath)) {
      const version = await runCommand(`"${gitPath}" --version`);
      const match = version && version.match(/(\d+\.\d+[\.\d]*)/);
      return { found: true, version: match ? match[1] : 'installed' };
    }
  }
  return { found: false, version: null };
}

async function checkClaude() {
  // Check file paths first (sync, instant)
  for (const candidate of paths.claudeCliPaths) {
    if (fs.existsSync(candidate)) {
      // Try to get version from the found binary
      const ver = await runCommand(`"${candidate}" --version`);
      const match = ver && ver.match(/(\d+\.\d+[\.\d]*)/);
      return { found: true, version: match ? match[1] : 'installed' };
    }
  }
  let out = await runCommand(cmd.checkClaude);
  if (!out) out = await runCommand('cmd /c claude -v');
  if (out) {
    const match = out.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : out };
  }
  return { found: false, version: null };
}

async function checkVSCode() {
  const out = await runCommand(cmd.checkVSCode);
  if (out) return { found: true, version: out.split('\n')[0] };
  return { found: false, version: null };
}

async function checkClaudeDesktop() {
  // Check via AppxPackage (Store/MSIX — most reliable on Windows)
  const appxOut = await runShellCommand(
    'powershell -NoProfile -Command "(Get-AppxPackage *claude* | Select -First 1).Version"', 8000
  );
  if (appxOut && appxOut.match(/\d+\.\d+/)) {
    return { found: true, version: appxOut.trim() };
  }

  // Fallback: winget
  const wingetOut = await runShellCommand('winget list --id Anthropic.Claude', 10000);
  if (wingetOut && wingetOut.includes('Anthropic.Claude')) {
    const match = wingetOut.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : 'installed' };
  }

  // Fallback: known file paths (non-Store installs)
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const knownExePaths = [
    path.join(localAppData, 'AnthropicClaude', 'claude.exe'),
    path.join(localAppData, 'Programs', 'claude', 'claude.exe')
  ];
  for (const exePath of knownExePaths) {
    if (fs.existsSync(exePath)) return { found: true, version: 'installed' };
  }

  return { found: false, version: null };
}

async function checkExtension(editor, extensionId) {
  const command = typeof cmd.checkExtensions === 'function' ? cmd.checkExtensions(editor) : null;
  if (!command) return false;
  const out = await runCommand(command, 10000);
  if (!out) return false;
  const lines = out.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes(extensionId.toLowerCase())) {
      const parts = line.split('@');
      if (parts.length > 1) return parts[parts.length - 1].trim();
      return true;
    }
  }
  return false;
}

async function checkNvm() {
  const out = await runCommand(cmd.checkNvm);
  return out ? { found: true, version: out } : { found: false, version: null };
}

async function hasWinget() {
  const out = await runCommand('cmd /c winget --version');
  return !!out;
}

async function installNode(progress, options) {
  const useNvm = !options || options.useNvm !== false;

  if (useNvm) {
    // Check if NVM already installed
    const existingNvm = await checkNvm();
    let nvmInstalled = existingNvm.found;

    if (nvmInstalled) {
      if (progress) progress('NVM already installed, skipping NVM install...');
    } else {
      if (progress) progress('Installing NVM for Windows...');
      const wingetAvailable = await hasWinget();

      if (wingetAvailable) {
        const nvmResult = await runShellCommandVerbose(cmd.installNvm, 120000);
        nvmInstalled = nvmResult.success;
        if (!nvmInstalled && progress) progress('winget nvm failed, trying direct download...');
      }
    }

    // Fallback: download nvm-setup.exe and run silently
    if (!nvmInstalled) {
      if (progress) progress('Downloading NVM setup...');
      // Remove old NVM to avoid "directory not empty" popup
      await runShellCommandVerbose('winget uninstall -e --id CoreyButler.NVMforWindows', 60000);

      const tmpSetup = path.join(os.tmpdir(), 'nvm-setup.exe');
      const dlResult = await downloadFile(dl.nvm, tmpSetup);
      if (dlResult.success) {
        if (progress) progress('Installing NVM...');
        await runShellCommandVerbose(`"${tmpSetup}" /VERYSILENT /NORESTART`, 120000);
        try { fs.unlinkSync(tmpSetup); } catch (_) {}
      }
    }

    // Ensure NVM is in PATH
    addToPath(process.env.NVM_HOME || path.join(process.env.APPDATA || '', 'nvm'));
    addToPath(path.join(process.env.PROGRAMFILES || '', 'nodejs'));
    refreshPath();

    if (progress) progress('Installing Node.js LTS via NVM...');
    const nodeResult = await runShellCommandVerbose(cmd.installNodeViaNvm, 120000);

    refreshPath();
    const check = await checkNode();
    return check.found
      ? { success: true, message: check.version }
      : { success: false, message: nodeResult.error || 'Node.js installation failed' };
  }

  // Install via winget
  if (await hasWinget()) {
    if (progress) progress('Installing Node.js LTS via winget...');
    const result = await runShellCommandVerbose(
      'winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements',
      300000
    );
    refreshPath();
    const check = await checkNode();
    if (check.found) return { success: true, message: check.version };
  }

  // Fallback: download installer from nodejs.org
  if (progress) progress('Downloading Node.js installer...');
  const tmpPath = path.join(os.tmpdir(), 'node-installer.msi');
  const dlResult = await downloadFile('https://nodejs.org/dist/latest-lts/node-latest-lts-x64.msi', tmpPath);
  if (dlResult.success) {
    const msiResult = await runShellCommandVerbose(`msiexec /i "${tmpPath}" /qn /norestart`, 300000);
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    refreshPath();
    const check = await checkNode();
    if (check.found) return { success: true, message: check.version };
    return { success: false, message: msiResult.error || 'Node.js installer failed' };
  }

  return { success: false, message: 'Node.js installation failed — no package manager or download available' };
}

async function installGit(progress) {
  if (await hasWinget()) {
    if (progress) progress('Installing Git via winget...');
    await runShellCommandVerbose(cmd.installGit, 300000);
    refreshPath();
    const check = await checkGit();
    if (check.found) return { success: true, message: check.version };
  }

  // Fallback: direct download via GitHub API
  const url = await dl.resolveGitUrl();
  if (url) {
    if (progress) progress('Downloading Git installer...');
    const tmpPath = path.join(os.tmpdir(), 'git-installer.exe');
    const downloadResult = await downloadFile(url, tmpPath);
    if (downloadResult.success) {
      const exeResult = await runShellCommandVerbose(`"${tmpPath}" /VERYSILENT /NORESTART`, 300000);
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      refreshPath();
      const recheck = await checkGit();
      if (recheck.found) return { success: true, message: recheck.version };
      return { success: false, message: exeResult.error || 'Git installer failed' };
    } else {
      return { success: false, message: 'Download failed: ' + (downloadResult.error || 'unknown') };
    }
  }

  return { success: false, message: 'Git installation failed' };
}

async function installClaude(progress) {
  if (progress) progress('Installing Claude CLI...');

  // Try PowerShell first
  const psResult = await runShellCommandVerbose(cmd.installClaude, 120000);

  // Fallback: install.cmd (no PowerShell needed)
  let check = await checkClaude();
  if (!check.found) {
    if (progress) progress('PowerShell failed, trying install.cmd...');
    const tmpPath = path.join(os.tmpdir(), 'claude-install.cmd');
    const dlResult = await downloadFile(dl.claudeCmd, tmpPath);
    if (dlResult.success) {
      await runShellCommandVerbose(`cmd /c call "${tmpPath}"`, 120000);
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  }

  addClaudeBinToPath();
  refreshPath();
  check = await checkClaude();
  return check.found
    ? { success: true, message: check.version }
    : { success: false, message: psResult.error || 'Claude CLI installation failed' };
}

function addClaudeBinToPath() {
  addToPath(path.join(os.homedir(), '.local', 'bin'));
}

async function installVSCode(progress) {
  if (await hasWinget()) {
    if (progress) progress('Installing VS Code via winget...');
    await runShellCommandVerbose(cmd.installVSCode, 300000);
    refreshPath();
    const check = await checkVSCode();
    if (check.found) return { success: true, message: check.version };
  }

  // Fallback: direct download
  const url = dl.getUrl('vscode');
  if (url) {
    if (progress) progress('Downloading VS Code installer...');
    const tmpPath = path.join(os.tmpdir(), 'vscode-installer.exe');
    const downloadResult = await downloadFile(url, tmpPath);
    if (downloadResult.success) {
      const exeResult = await runShellCommandVerbose(`"${tmpPath}" /verysilent /mergetasks=!runcode`, 300000);
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      refreshPath();
      const recheck = await checkVSCode();
      if (recheck.found) return { success: true, message: recheck.version };
      return { success: false, message: exeResult.error || 'VS Code installer failed' };
    } else {
      return { success: false, message: 'Download failed: ' + (downloadResult.error || 'unknown') };
    }
  }

  return { success: false, message: 'VS Code installation failed' };
}

async function installClaudeDesktop(progress) {
  if (await hasWinget()) {
    if (progress) progress('Installing Claude Desktop via winget...');
    await runShellCommandVerbose(cmd.installClaudeDesktop, 300000);
    refreshPath();
    const check = await checkClaudeDesktop();
    if (check.found) return { success: true, message: 'installed' };
  }

  // Fallback: direct download
  const url = dl.getUrl('claudeDesktop');
  if (url) {
    if (progress) progress('Downloading Claude Desktop...');
    const tmpPath = path.join(os.tmpdir(), 'ClaudeSetup.exe');
    const downloadResult = await downloadFile(url, tmpPath);
    if (downloadResult.success) {
      const exeResult = await runShellCommandVerbose(`"${tmpPath}"`, 300000);
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      const recheck = await checkClaudeDesktop();
      if (recheck.found) return { success: true, message: 'installed' };
      return { success: false, message: exeResult.error || 'Claude Desktop installer failed' };
    } else {
      return { success: false, message: 'Download failed: ' + (downloadResult.error || 'unknown') };
    }
  }

  return { success: false, message: 'Claude Desktop installation failed' };
}

async function installExtension(editor, extensionId, progress) {
  const command = cmd.installExtension(editor, extensionId);
  if (progress) progress(`Installing ${extensionId}...`);
  const result = await runShellCommandVerbose(command, 60000);
  const installed = await checkExtension(editor, extensionId);
  return installed
    ? { success: true, message: extensionId }
    : { success: false, message: result.error || `Failed to install ${extensionId}` };
}

async function checkCodexCli() {
  const out = await runCommand('cmd /c codex --version');
  if (out) {
    const match = out.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : out };
  }
  return { found: false, version: null };
}

async function checkCodexApp() {
  // Check via AppxPackage (Store/MSIX — most reliable)
  const appxOut = await runShellCommand(
    'powershell -NoProfile -Command "(Get-AppxPackage *OpenAI.Codex* | Select -First 1).Version"', 8000
  );
  if (appxOut && appxOut.match(/\d+\.\d+/)) {
    return { found: true, version: appxOut.trim() };
  }

  // Fallback: winget/msstore
  const out = await runShellCommand('winget list --id 9PLM9XGG6VKS --source msstore', 10000);
  if (out && out.includes('Codex')) {
    const match = out.match(/(\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : 'installed' };
  }
  return { found: false, version: null };
}

async function checkGithubCli() {
  const out = await runCommand('cmd /c gh --version');
  if (out) {
    const match = out.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : out };
  }
  return { found: false, version: null };
}

async function installCodexCli(progress) {
  if (progress) progress('Installing OpenAI Codex CLI...');
  const result = await runShellCommandVerbose('cmd /c npm install -g @openai/codex', 120000);
  refreshPath();
  const check = await checkCodexCli();
  return check.found
    ? { success: true, message: check.version }
    : { success: false, message: result.error || 'Codex CLI installation failed' };
}

async function installCodexApp(progress) {
  if (!await hasWinget()) {
    return { success: false, message: 'Codex App requires winget (Microsoft Store) which is not available' };
  }
  if (progress) progress('Installing Codex App from Microsoft Store...');
  const result = await runShellCommandVerbose(
    'winget install -e --id 9PLM9XGG6VKS --source msstore --accept-package-agreements --accept-source-agreements',
    300000
  );
  refreshPath();
  const check = await checkCodexApp();
  return check.found
    ? { success: true, message: 'installed' }
    : { success: false, message: result.error || 'Codex App installation failed' };
}

async function installGithubCli(progress) {
  if (await hasWinget()) {
    if (progress) progress('Installing GitHub CLI via winget...');
    await runShellCommandVerbose(
      'winget install -e --id GitHub.cli --accept-package-agreements --accept-source-agreements',
      300000
    );
    refreshPath();
    const check = await checkGithubCli();
    if (check.found) return { success: true, message: check.version };
  }

  // Fallback: download .msi via GitHub API
  const url = await dl.resolveGithubCliUrl();
  if (url) {
    if (progress) progress('Downloading GitHub CLI installer...');
    const tmpPath = path.join(os.tmpdir(), 'gh-installer.msi');
    const downloadResult = await downloadFile(url, tmpPath);
    if (downloadResult.success) {
      const msiResult = await runShellCommandVerbose(`msiexec /i "${tmpPath}" /qn /norestart`, 120000);
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      refreshPath();
      const recheck = await checkGithubCli();
      if (recheck.found) return { success: true, message: recheck.version };
      return { success: false, message: msiResult.error || 'GitHub CLI installer failed' };
    } else {
      return { success: false, message: 'Download failed: ' + (downloadResult.error || 'unknown') };
    }
  }

  return { success: false, message: 'GitHub CLI installation failed' };
}

async function uninstallNode(progress, options) {
  const removeNvm = !!(options && options.removeNvm);
  const nvmCheck = await checkNvm();

  if (nvmCheck.found) {
    // Node managed by nvm
    if (removeNvm) {
      if (progress) progress('Removing NVM for Windows...');
      // Try NVM's own uninstaller first
      const nvmUninst = path.join(process.env.APPDATA || '', 'nvm', 'unins000.exe');
      if (fs.existsSync(nvmUninst)) {
        if (progress) progress('Using NVM uninstaller...');
        await runShellCommandVerbose(`"${nvmUninst}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART`, 300000);
      }
      // Fallback: winget
      await runShellCommandVerbose(
        'winget uninstall -e --id CoreyButler.NVMforWindows --accept-source-agreements', 300000
      );
      // Clean leftover dirs
      const nvmDir = path.join(process.env.APPDATA || '', 'nvm');
      const nvmLink = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nodejs');
      try { if (fs.existsSync(nvmDir)) fs.rmSync(nvmDir, { recursive: true, force: true }); } catch (_) {}
      try { if (fs.existsSync(nvmLink)) fs.rmSync(nvmLink, { recursive: true, force: true }); } catch (_) {}
    } else {
      if (progress) progress('Removing current Node.js version from nvm...');
      // Get current version before deactivating
      const nodeVer = await runCommand('cmd /c node -v');
      if (nodeVer) {
        await runShellCommandVerbose(`cmd /c "nvm deactivate && nvm uninstall ${nodeVer.trim()}"`, 30000);
      }
    }
  } else {
    // Node installed via winget
    if (progress) progress('Removing Node.js...');
    await runShellCommandVerbose(
      'winget uninstall -e --id OpenJS.NodeJS.LTS --accept-source-agreements', 300000
    );
  }

  refreshPath();
  const check = await checkNode();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: 'Node.js removal failed' };
}

async function uninstallGit(progress) {
  if (progress) progress('Removing Git...');

  // Try winget first
  await runShellCommandVerbose('winget uninstall -e --id Git.Git --accept-source-agreements', 300000);
  refreshPath();
  let check = await checkGit();
  if (!check.found) return { success: true, message: 'Removed' };

  // Fallback: Git's own uninstaller with suppress flags
  const gitUninstallers = [
    path.join(process.env.PROGRAMFILES || '', 'Git', 'unins000.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Git', 'unins000.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'unins000.exe')
  ];
  for (const uninstaller of gitUninstallers) {
    if (fs.existsSync(uninstaller)) {
      await runShellCommandVerbose(`"${uninstaller}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART`, 300000);
      break;
    }
  }

  // Wait for uninstaller to finalize + retry
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise(r => setTimeout(r, 3000));
    refreshPath();
    check = await checkGit();
    if (!check.found) return { success: true, message: 'Removed' };
  }

  return { success: false, message: 'Git removal failed — still detected after uninstall' };
}

async function uninstallClaude(progress) {
  if (progress) progress('Removing Claude CLI...');

  // Native install: remove binary + data
  const home = os.homedir();
  const nativeBin = path.join(home, '.local', 'bin', 'claude.exe');
  const nativeCmd = path.join(home, '.local', 'bin', 'claude.cmd');
  const nativeData = path.join(home, '.local', 'share', 'claude');
  try { fs.unlinkSync(nativeBin); } catch (_) {}
  try { fs.unlinkSync(nativeCmd); } catch (_) {}
  try { fs.rmSync(nativeData, { recursive: true, force: true }); } catch (_) {}

  // Also try npm uninstall if npm is available
  const npmCheck = await runCommand('cmd /c npm --version');
  if (npmCheck) {
    await runShellCommandVerbose('cmd /c npm uninstall -g @anthropic-ai/claude-code', 60000);
  }

  refreshPath();
  const check = await checkClaude();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: 'Claude CLI removal failed' };
}

async function uninstallVSCode(progress) {
  if (progress) progress('Removing VS Code...');
  const result = await runShellCommandVerbose(
    'winget uninstall -e --id Microsoft.VisualStudioCode --accept-source-agreements', 300000
  );
  refreshPath();
  const check = await checkVSCode();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: result.error || 'VS Code removal failed' };
}

async function uninstallClaudeDesktop(progress) {
  if (progress) progress('Removing Claude Desktop...');
  const result = await runShellCommandVerbose(
    'winget uninstall -e --id Anthropic.Claude --accept-source-agreements', 300000
  );
  refreshPath();
  const check = await checkClaudeDesktop();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: result.error || 'Claude Desktop removal failed' };
}

async function uninstallCodexCli(progress) {
  if (progress) progress('Removing Codex CLI...');
  const npmCheck = await runCommand('cmd /c npm --version');
  if (npmCheck) {
    await runShellCommandVerbose('cmd /c npm uninstall -g @openai/codex', 60000);
  }
  refreshPath();
  const check = await checkCodexCli();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: 'Codex CLI removal failed' };
}

async function uninstallCodexApp(progress) {
  if (progress) progress('Removing Codex App...');
  const result = await runShellCommandVerbose(
    'winget uninstall -e --id 9PLM9XGG6VKS --accept-source-agreements', 300000
  );
  refreshPath();
  const check = await checkCodexApp();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: result.error || 'Codex App removal failed' };
}

async function uninstallGithubCli(progress) {
  if (progress) progress('Removing GitHub CLI...');
  const result = await runShellCommandVerbose(
    'winget uninstall -e --id GitHub.cli --accept-source-agreements', 300000
  );
  refreshPath();
  const check = await checkGithubCli();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: result.error || 'GitHub CLI removal failed' };
}

async function uninstallExtension(editor, extensionId, progress) {
  const command = `cmd /c ${editor} --uninstall-extension ${extensionId}`;
  if (progress) progress(`Removing ${extensionId}...`);
  const result = await runShellCommandVerbose(command, 60000);
  const installed = await checkExtension(editor, extensionId);
  return !installed
    ? { success: true, message: extensionId }
    : { success: false, message: result.error || `Failed to remove ${extensionId}` };
}

// ── Elevated batch install ──
// Tools that need admin/UAC elevation for install
const ELEVATED_TOOLS = new Set(['node', 'git', 'vscode', 'claude', 'claudeDesktop', 'codexApp', 'githubCli']);
// Tools that don't need elevation
const NON_ELEVATED_TOOLS = new Set(['codexCli', 'vscodeClaude', 'vscodeCodex']);

function needsElevation(toolIds) {
  return toolIds.some(id => ELEVATED_TOOLS.has(id));
}

/**
 * Download all installers first (no UAC needed), then return steps array
 * for runElevatedBatch. Each step has {id, command}.
 */
async function prepareElevatedInstall(toolIds, progress) {
  const ids = toolIds.filter(id => ELEVATED_TOOLS.has(id));

  // Resolve dynamic URLs in parallel
  const [gitUrl, ghCliUrl] = await Promise.all([
    ids.includes('git') ? dl.resolveGitUrl() : null,
    ids.includes('githubCli') ? dl.resolveGithubCliUrl() : null
  ]);

  // Build download tasks and run them in parallel
  const downloadTasks = [];
  const tmpDir = os.tmpdir();
  const nvmHome = path.join(process.env.APPDATA || '', 'nvm');

  for (const id of ids) {
    switch (id) {
      case 'node':
        downloadTasks.push({ id, dest: path.join(tmpDir, 'nvm-setup.exe'), url: dl.nvm }); break;
      case 'git':
        if (gitUrl) downloadTasks.push({ id, dest: path.join(tmpDir, 'git-installer.exe'), url: gitUrl }); break;
      case 'claude':
        downloadTasks.push({ id, dest: path.join(tmpDir, 'claude-install.cmd'), url: dl.claudeCmd }); break;
      case 'vscode':
        downloadTasks.push({ id, dest: path.join(tmpDir, 'vscode-installer.exe'), url: dl.vscode }); break;
      case 'claudeDesktop':
        downloadTasks.push({ id, dest: path.join(tmpDir, 'ClaudeSetup.exe'), url: dl.claudeDesktop }); break;
      case 'githubCli':
        if (ghCliUrl) downloadTasks.push({ id, dest: path.join(tmpDir, 'gh-installer.msi'), url: ghCliUrl }); break;
    }
  }

  if (progress) progress('Downloading all installers...');
  const dlResults = await Promise.all(
    downloadTasks.map(t => {
      if (progress) progress(`[${t.id}] Downloading from ${t.url}`);
      return downloadFile(t.url, t.dest).then(r => {
        if (r.success) {
          if (progress) progress(`[${t.id}] Downloaded → ${t.dest}`);
        } else {
          if (progress) progress(`[${t.id}] Download FAILED from ${t.url}`);
        }
        return { ...t, ok: r.success };
      });
    })
  );

  // Build steps from successful downloads
  const downloaded = {};
  const steps = [];

  for (const dl of dlResults) {
    if (!dl.ok) {
      if (progress) progress(`[${dl.id}] Skipped — download failed`);
      continue;
    }
    downloaded[dl.id] = dl.dest;

    switch (dl.id) {
      case 'node': {
        const nvmSymlink = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nodejs');
        // If NVM already exists, just install node; otherwise install NVM first
        const nvmExists = fs.existsSync(path.join(nvmHome, 'nvm.exe'));
        const cmds = [];
        if (!nvmExists) {
          cmds.push('winget uninstall -e --id CoreyButler.NVMforWindows 2>nul');
          cmds.push(`"${dl.dest}" /VERYSILENT /NORESTART`);
          cmds.push('timeout /t 5 /nobreak >nul');
        }
        cmds.push(`set "PATH=${nvmHome};${nvmSymlink};%PATH%"`);
        cmds.push(`"${path.join(nvmHome, 'nvm.exe')}" install lts`);
        cmds.push(`"${path.join(nvmHome, 'nvm.exe')}" use lts`);
        steps.push({ id: 'node', command: cmds.join('\r\n') });
        break;
      }
      case 'git':
        steps.push({ id: 'git', command: `"${dl.dest}" /VERYSILENT /NORESTART` }); break;
      case 'claude': {
        const claudeBinDir = path.join(os.homedir(), '.local', 'bin');
        steps.push({
          id: 'claude',
          command: [
            `call "${dl.dest}"`,
            `for /f "tokens=2*" %%a in ('reg query "HKCU\\Environment" /v Path 2^>nul') do set "UPATH=%%b"`,
            `echo %UPATH% | find /i ".local\\bin" >nul || setx PATH "%UPATH%;${claudeBinDir}"`
          ].join('\r\n')
        });
        break;
      }
      case 'vscode':
        steps.push({ id: 'vscode', command: `"${dl.dest}" /verysilent /mergetasks=!runcode` }); break;
      case 'claudeDesktop':
        steps.push({ id: 'claudeDesktop', command: `"${dl.dest}"\r\ntimeout /t 10 /nobreak >nul` }); break;
      case 'githubCli':
        steps.push({ id: 'githubCli', command: `msiexec /i "${dl.dest}" /qn /norestart` }); break;
    }
  }

  // codexApp doesn't need a download
  if (ids.includes('codexApp')) {
    steps.push({
      id: 'codexApp',
      command: 'winget install -e --id 9PLM9XGG6VKS --source msstore --accept-package-agreements --accept-source-agreements'
    });
  }

  return { steps, downloaded };
}

async function runBatchInstall(toolIds, onStepProgress, progress) {
  const elevatedIds = toolIds.filter(id => ELEVATED_TOOLS.has(id));
  if (elevatedIds.length === 0) return { success: true, elevated: false };

  if (progress) progress('Downloading installers...');
  const { steps, downloaded } = await prepareElevatedInstall(elevatedIds, progress);

  if (steps.length === 0) {
    return { success: false, elevated: false, error: 'No installers could be downloaded' };
  }

  if (progress) progress('Requesting admin permission (one-time UAC)...');

  const result = await runElevatedBatch(steps, onStepProgress);

  // Clean up downloaded installers
  for (const tmpPath of Object.values(downloaded)) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }

  if (!result.success) {
    return { success: false, elevated: true, error: result.error };
  }

  // Wait a moment for registry/filesystem to settle after batch
  await new Promise(r => setTimeout(r, 2000));

  // Refresh PATH from registry
  refreshPath();

  // Inject all known install paths (non-existent dirs in PATH are harmless)
  const home = os.homedir();
  [
    process.env.NVM_HOME || path.join(process.env.APPDATA || '', 'nvm'),
    path.join(process.env.PROGRAMFILES || '', 'nodejs'),
    path.join(home, '.local', 'bin'),
    path.join(home, '.claude', 'local'),
    path.join(process.env.PROGRAMFILES || '', 'Git', 'cmd'),
    path.join(process.env.PROGRAMFILES || '', 'GitHub CLI'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'bin'),
    path.join(process.env.PROGRAMFILES || '', 'Microsoft VS Code', 'bin')
  ].forEach(addToPath);

  return { success: true, elevated: true };
}

function addToPath(dir) {
  if (dir && !process.env.PATH.includes(dir)) {
    process.env.PATH = dir + ';' + process.env.PATH;
  }
}

function injectKnownPaths() {
  const home = os.homedir();
  [
    process.env.NVM_HOME || path.join(process.env.APPDATA || '', 'nvm'),
    path.join(process.env.PROGRAMFILES || '', 'nodejs'),
    path.join(home, '.local', 'bin'),
    path.join(home, '.claude', 'local'),
    path.join(process.env.PROGRAMFILES || '', 'Git', 'cmd'),
    path.join(process.env.PROGRAMFILES || '', 'GitHub CLI'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'bin'),
    path.join(process.env.PROGRAMFILES || '', 'Microsoft VS Code', 'bin'),
    // NVM symlink dir for node (standard + NVM4W)
    process.env.NVM_SYMLINK || path.join(process.env.PROGRAMFILES || '', 'nodejs'),
    'C:\\nvm4w\\nodejs'
  ].forEach(addToPath);
}

// Uninstall batch
async function runBatchUninstall(toolIds, progress) {
  const elevatedIds = toolIds.filter(id => ELEVATED_TOOLS.has(id));
  if (elevatedIds.length === 0) return { success: true, elevated: false };

  const steps = [];
  const home = os.homedir();

  for (const id of elevatedIds) {
    switch (id) {
      case 'node': {
        const nvmDir = path.join(process.env.APPDATA || '', 'nvm');
        const nvmLink = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nodejs');
        const nvmUninst = path.join(nvmDir, 'unins000.exe');
        steps.push({ id, command: [
          'nvm deactivate 2>nul',
          // Try NVM's own uninstaller first (from setup.exe install)
          `if exist "${nvmUninst}" "${nvmUninst}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART`,
          'timeout /t 3 /nobreak >nul',
          // Fallback: winget uninstall
          'winget uninstall -e --id CoreyButler.NVMforWindows --accept-source-agreements 2>nul',
          'timeout /t 3 /nobreak >nul',
          // Clean up leftover dirs
          `if exist "${nvmDir}" rmdir /s /q "${nvmDir}"`,
          `if exist "${nvmLink}" rmdir /s /q "${nvmLink}"`
        ].join('\r\n') });
        break;
      }
      case 'git': {
        const gitUninst = path.join(process.env.PROGRAMFILES || '', 'Git', 'unins000.exe');
        steps.push({ id, command: [
          'winget uninstall -e --id Git.Git --accept-source-agreements 2>nul',
          'timeout /t 3 /nobreak >nul',
          `if exist "${gitUninst}" "${gitUninst}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART`
        ].join('\r\n') });
        break;
      }
      case 'claude': {
        const bin = path.join(home, '.local', 'bin');
        steps.push({ id, command: [
          `del /f /q "${path.join(bin, 'claude.exe')}" 2>nul`,
          `del /f /q "${path.join(bin, 'claude.cmd')}" 2>nul`,
          `rmdir /s /q "${path.join(home, '.local', 'share', 'claude')}" 2>nul`,
          'npm uninstall -g @anthropic-ai/claude-code 2>nul'
        ].join('\r\n') });
        break;
      }
      case 'vscode':
        steps.push({ id, command: 'winget uninstall -e --id Microsoft.VisualStudioCode --accept-source-agreements 2>nul' });
        break;
      case 'claudeDesktop':
        steps.push({ id, command: 'winget uninstall -e --id Anthropic.Claude --accept-source-agreements 2>nul' });
        break;
      case 'codexApp':
        steps.push({ id, command: 'winget uninstall -e --id 9PLM9XGG6VKS --accept-source-agreements 2>nul' });
        break;
      case 'githubCli':
        steps.push({ id, command: 'winget uninstall -e --id GitHub.cli --accept-source-agreements 2>nul' });
        break;
    }
  }

  if (progress) progress('Requesting admin permission for removal...');
  const result = await runElevatedBatch(steps);
  refreshPath();
  return { success: result.success, elevated: true, error: result.error };
}

module.exports = {
  checkNode,
  checkNvm,
  checkGit,
  checkClaude,
  checkVSCode,
  checkClaudeDesktop,
  checkCodexCli,
  checkCodexApp,
  checkGithubCli,
  checkExtension,
  installNode,
  installGit,
  installClaude,
  installVSCode,
  installClaudeDesktop,
  installCodexCli,
  installCodexApp,
  installGithubCli,
  installExtension,
  uninstallNode,
  uninstallGit,
  uninstallClaude,
  uninstallVSCode,
  uninstallClaudeDesktop,
  uninstallCodexCli,
  uninstallCodexApp,
  uninstallGithubCli,
  uninstallExtension,
  refreshPath,
  injectKnownPaths,
  needsElevation,
  runBatchInstall,
  runBatchUninstall,
  ELEVATED_TOOLS,
  NON_ELEVATED_TOOLS
};
