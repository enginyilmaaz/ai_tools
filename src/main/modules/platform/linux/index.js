'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { runCommand, runShellCommand, runShellCommandVerbose, which, downloadFile } = require('../core/exec');
const { refreshPath } = require('./env');
const { LinuxCommands: cmd } = require('./commands');
const { LinuxDownloads: dl } = require('./downloads');
const { LinuxPaths: paths } = require('./paths');
const LinuxApps = require('./apps');

const NEEDS_SUDO = new Set(['git', 'vscode', 'claudeDesktop', 'githubCli']);
const MISSING_ELEVATION_MESSAGE = 'Root privileges are required, but neither pkexec nor sudo is available';
const SUDOERS_TMP = '/etc/sudoers.d/ai-tool-session';

let _sudoSessionActive = false;

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

// Create a temporary sudoers entry — asks for password ONCE via pkexec
// then all subsequent sudo calls for allowed commands are passwordless
async function ensureSudoSession() {
  if (_sudoSessionActive) return true;
  if (!await which('pkexec')) return false;

  const user = os.userInfo().username;
  const cmds = '/usr/bin/apt-get,/usr/bin/dpkg,/usr/bin/apt,/usr/bin/snap,/usr/bin/install,/usr/bin/gpg,/usr/bin/tee,/usr/bin/dd';
  const line = `${user} ALL=(ALL) NOPASSWD: ${cmds}`;
  const result = await runShellCommand(
    `pkexec sh -c 'echo "${line}" > ${SUDOERS_TMP} && chmod 440 ${SUDOERS_TMP}'`,
    30000
  );
  if (result !== null) {
    _sudoSessionActive = true;
    return true;
  }
  return false;
}

// Clean up the temporary sudoers file — call on app exit
async function cleanupSudoSession() {
  if (!_sudoSessionActive) return;
  _sudoSessionActive = false;
  await runShellCommand(`sudo rm -f ${SUDOERS_TMP}`, 5000);
}

async function buildElevatedCommand(command) {
  // Use cached sudo session if available
  if (_sudoSessionActive) {
    return `sudo sh -c ${shellQuote(command)}`;
  }
  // Try to create session (prompts once via pkexec)
  if (await ensureSudoSession()) {
    return `sudo sh -c ${shellQuote(command)}`;
  }
  // Last resort: direct pkexec (will prompt each time)
  if (await which('pkexec')) {
    return `pkexec sh -c ${shellQuote(command)}`;
  }
  return null;
}

async function runElevatedCommand(command, timeoutMs = 15000) {
  const elevatedCommand = await buildElevatedCommand(command);
  if (!elevatedCommand) return null;
  return runShellCommand(elevatedCommand, timeoutMs);
}

async function runElevatedCommandVerbose(command, timeoutMs = 15000) {
  const elevatedCommand = await buildElevatedCommand(command);
  if (!elevatedCommand) {
    return { success: false, output: null, error: MISSING_ELEVATION_MESSAGE };
  }
  return runShellCommandVerbose(elevatedCommand, timeoutMs);
}

async function ensureCommandPackages(commands, progress) {
  const missingPackages = [];
  for (const command of commands) {
    if (!await which(command)) missingPackages.push(command);
  }

  if (!missingPackages.length) return { success: true };

  if (progress) progress(`Installing required packages: ${missingPackages.join(', ')}...`);
  const result = await runElevatedCommandVerbose(`apt-get install -y ${missingPackages.join(' ')}`, 120000);
  if (!result.success) {
    return {
      success: false,
      message: result.error || `Failed to install required packages: ${missingPackages.join(', ')}`
    };
  }

  return { success: true };
}

async function installRepoKey(id, repo, progress) {
  if (!repo.keyUrl || !repo.keyPath || fs.existsSync(repo.keyPath)) {
    return { success: true, changed: false };
  }

  const keyBase = path.join(os.tmpdir(), `${id}-repo-key-${Date.now()}`);
  const downloadedKeyPath = `${keyBase}.asc`;
  const preparedKeyPath = repo.keyNeedsDearmor ? `${keyBase}.gpg` : `${keyBase}.key`;

  try {
    const downloadResult = await downloadFile(repo.keyUrl, downloadedKeyPath);
    if (!downloadResult.success) {
      return {
        success: false,
        changed: false,
        message: `Failed to download signing key: ${downloadResult.error || 'unknown error'}`
      };
    }

    if (repo.keyNeedsDearmor) {
      const packagesResult = await ensureCommandPackages(['gpg'], progress);
      if (!packagesResult.success) {
        return { success: false, changed: false, message: packagesResult.message };
      }

      const dearmorResult = await runShellCommandVerbose(
        `gpg --dearmor -o ${shellQuote(preparedKeyPath)} ${shellQuote(downloadedKeyPath)}`,
        30000
      );
      if (!dearmorResult.success) {
        return {
          success: false,
          changed: false,
          message: dearmorResult.error || 'Failed to convert signing key'
        };
      }
    } else {
      fs.copyFileSync(downloadedKeyPath, preparedKeyPath);
    }

    const installResult = await runElevatedCommandVerbose(
      `install -D -o root -g root -m 644 ${shellQuote(preparedKeyPath)} ${shellQuote(repo.keyPath)}`,
      30000
    );
    if (!installResult.success) {
      return {
        success: false,
        changed: false,
        message: installResult.error || 'Failed to install signing key'
      };
    }

    return { success: true, changed: true };
  } finally {
    try { fs.unlinkSync(downloadedKeyPath); } catch (_) {}
    try { fs.unlinkSync(preparedKeyPath); } catch (_) {}
  }
}

async function installRepoSource(id, repo) {
  const repoFile = repo.sourceFile || repo.listFile;
  if (!repoFile) return { success: true, changed: false };

  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
  const sourceContent = repo.sourceContents
    ? repo.sourceContents.replace(/\$\{ARCH\}/g, arch)
    : (repo.repoLine ? repo.repoLine.replace(/\$\{ARCH\}/g, arch) : '');
  if (!sourceContent) return { success: true, changed: false };

  const repoFiles = [repo.sourceFile, repo.listFile].concat(repo.legacyFiles || []).filter(Boolean);
  const repoExists = repoFiles.some((filePath) => fs.existsSync(filePath));
  if (repoExists && fs.existsSync(repoFile)) {
    return { success: true, changed: false };
  }

  const tmpPath = path.join(os.tmpdir(), `${id}-repo-${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmpPath, sourceContent.endsWith('\n') ? sourceContent : `${sourceContent}\n`);
    const installResult = await runElevatedCommandVerbose(
      `install -D -o root -g root -m 644 ${shellQuote(tmpPath)} ${shellQuote(repoFile)}`,
      30000
    );
    if (!installResult.success) {
      return {
        success: false,
        changed: false,
        message: installResult.error || 'Failed to install repository source file'
      };
    }

    const legacyFiles = (repo.legacyFiles || []).filter((filePath) => filePath !== repoFile);
    if (legacyFiles.length) {
      await runElevatedCommand(`rm -f ${legacyFiles.map(shellQuote).join(' ')}`, 10000);
    }

    return { success: true, changed: true };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

async function installAptPackage(packageName, progress, options) {
  const packageLabel = (options && options.label) || packageName;
  let result = await runElevatedCommandVerbose(`apt-get install -y ${packageName}`, 180000);

  const missingPackage = /Unable to locate package|has no installation candidate/i.test(result.error || '');
  if (!result.success && missingPackage) {
    if (progress) progress(`Refreshing apt package lists for ${packageLabel}...`);
    const updateResult = await runElevatedCommandVerbose('apt-get update', 120000);
    if (updateResult.success) {
      result = await runElevatedCommandVerbose(`apt-get install -y ${packageName}`, 180000);
    } else {
      result = updateResult;
    }
  }

  return result;
}

async function getRemoteScriptFetcher(progress) {
  if (await which('curl')) {
    return { success: true, command: 'curl -fsSL' };
  }

  if (await which('wget')) {
    return { success: true, command: 'wget -qO-' };
  }

  if (progress) progress('curl and wget not found, installing curl via apt...');
  const curlResult = await installAptPackage('curl', progress, { label: 'curl' });
  if (!curlResult.success) {
    return {
      success: false,
      message: curlResult.error || 'curl could not be installed'
    };
  }

  if (await which('curl')) {
    return { success: true, command: 'curl -fsSL' };
  }

  return { success: false, message: 'Neither curl nor wget is available' };
}

async function runRemoteInstallScript(url, shellName, progress, label) {
  const fetcher = await getRemoteScriptFetcher(progress);
  if (!fetcher.success) {
    return {
      success: false,
      output: null,
      error: fetcher.message || `${label || 'Remote script'} could not start`
    };
  }

  if (progress && fetcher.command.startsWith('wget')) {
    progress(`curl not found, using wget for ${label || 'remote install script'}...`);
  }

  return runShellCommandVerbose(`${fetcher.command} ${shellQuote(url)} | ${shellName}`, 120000);
}

function needsSudo(ids) {
  return ids.some(id => NEEDS_SUDO.has(id));
}

async function ensureAptRepos(ids, progress) {
  let needsUpdate = false;

  for (const id of ids) {
    const app = LinuxApps[id];
    if (!app || !app.aptRepo) continue;
    const repo = app.aptRepo;
    const repoFiles = [repo.sourceFile, repo.listFile].concat(repo.legacyFiles || []).filter(Boolean);
    const repoExists = repoFiles.some((filePath) => fs.existsSync(filePath));
    const keyExists = !repo.keyPath || fs.existsSync(repo.keyPath);
    if (repoExists && keyExists) continue;

    if (progress) progress(`Adding apt repository for ${id}...`);

    const keyResult = await installRepoKey(id, repo, progress);
    if (!keyResult.success) {
      if (progress) progress(`Failed to add signing key for ${id}: ${keyResult.message}`);
      continue;
    }

    const sourceResult = await installRepoSource(id, repo);
    if (!sourceResult.success) {
      if (progress) progress(`Failed to add apt source for ${id}: ${sourceResult.message}`);
      continue;
    }

    needsUpdate = needsUpdate || keyResult.changed || sourceResult.changed;
  }

  if (needsUpdate) {
    if (progress) progress('Updating apt package lists...');
    const updateResult = await runElevatedCommandVerbose('apt-get update -qq', 60000);
    if (!updateResult.success && progress) {
      progress(`apt-get update failed: ${updateResult.error || 'unknown error'}`);
    }
  }
}

async function detectPackageManager() {
  if (await which('apt-get')) return 'apt';
  return null;
}

async function checkNode() {
  const out = await runCommand(cmd.checkNode);
  return out ? { found: true, version: out } : { found: false, version: null };
}

async function checkGit() {
  const out = await runCommand(cmd.checkGit);
  if (out) {
    const match = out.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : out };
  }
  return { found: false, version: null };
}

async function checkClaude() {
  let out = await runCommand(cmd.checkClaude);
  if (!out) out = await runCommand('claude -v');
  if (out) {
    const match = out.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : out };
  }
  return { found: false, version: null };
}

async function checkVSCode() {
  const out = await runCommand(cmd.checkVSCode);
  if (out) {
    return { found: true, version: out.split('\n')[0] };
  }
  if (fs.existsSync(paths.vscodeSnap)) {
    const snapOut = await runCommand(`${paths.vscodeSnap} --version`);
    return { found: true, version: snapOut ? snapOut.split('\n')[0] : 'installed' };
  }
  return { found: false, version: null };
}

async function checkClaudeDesktop() {
  const out = await runCommand(cmd.checkClaudeDesktop);
  if (out) {
    const match = out.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : out };
  }
  if (fs.existsSync(paths.claudeDesktopBin) || fs.existsSync(paths.claudeDesktop)) {
    return { found: true, version: 'installed' };
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

async function installNode(progress, options) {
  const useNvm = !options || options.useNvm !== false;

  if (useNvm) {
    if (progress) progress('Installing nvm...');
    const nvmResult = await runRemoteInstallScript(dl.nvm, 'bash', progress, 'nvm install');
    if (!nvmResult.success) return { success: false, message: 'nvm install failed: ' + nvmResult.error };
    refreshPath();

    if (progress) progress('Installing Node.js LTS via nvm...');
    const nodeResult = await runShellCommandVerbose(cmd.installNodeViaNvm, 120000);
    refreshPath();

    const check = await checkNode();
    return check.found
      ? { success: true, message: check.version }
      : { success: false, message: nodeResult.error || 'Node.js installation failed' };
  }

  // Install via apt
  if (progress) progress('Installing Node.js via apt...');
  const result = await installAptPackage('nodejs npm', progress, { label: 'Node.js' });
  refreshPath();

  const check = await checkNode();
  return check.found
    ? { success: true, message: check.version }
    : { success: false, message: result.error || 'Node.js installation failed' };
}

async function installGit(progress) {
  if (progress) progress('Installing git via apt...');

  const result = await installAptPackage('git', progress, { label: 'git' });
  const check = await checkGit();
  return check.found
    ? { success: true, message: check.version }
    : { success: false, message: result.error || 'Git installation failed' };
}

async function installClaude(progress) {
  if (progress) progress('Installing Claude CLI...');
  const result = await runRemoteInstallScript(dl.claude, 'bash', progress, 'Claude CLI install');
  refreshPath();

  const check = await checkClaude();
  return check.found
    ? { success: true, message: check.version }
    : { success: false, message: result.error || 'Claude CLI installation failed' };
}

async function installVSCode(progress) {
  if (progress) progress('Installing VS Code via apt...');

  const result = await installAptPackage('code', progress, { label: 'VS Code' });
  const check = await checkVSCode();
  return check.found
    ? { success: true, message: check.version }
    : { success: false, message: result.error || 'VS Code installation failed' };
}

async function installClaudeDesktop(progress) {
  if (progress) progress('Downloading Claude Desktop...');
  const url = dl.getUrl('claudeDesktop');
  if (!url) return { success: false, message: 'Download URL not available' };

  const tmpPath = path.join(os.tmpdir(), 'claude-desktop.deb');
  const downloadResult = await downloadFile(url, tmpPath);
  if (!downloadResult.success) return { success: false, message: 'Download failed: ' + (downloadResult.error || 'unknown') };

  if (progress) progress('Installing Claude Desktop...');
  const dpkgResult = await runElevatedCommandVerbose(`dpkg -i "${tmpPath}"`, 120000);
  await runElevatedCommand('apt-get install -f -y', 60000);
  try { fs.unlinkSync(tmpPath); } catch (_) {}

  const check = await checkClaudeDesktop();
  return check.found
    ? { success: true, message: 'installed' }
    : { success: false, message: dpkgResult.error || 'Installation failed' };
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
  const out = await runCommand('codex --version');
  if (out) {
    const match = out.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : out };
  }
  return { found: false, version: null };
}

async function checkCodexApp() {
  return { found: false, version: null };
}

async function checkGithubCli() {
  const out = await runCommand('gh --version');
  if (out) {
    const match = out.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match ? match[1] : out };
  }
  return { found: false, version: null };
}

async function installCodexCli(progress) {
  if (progress) progress('Installing OpenAI Codex CLI...');
  const result = await runShellCommandVerbose('npm install -g @openai/codex', 120000);
  refreshPath();
  const check = await checkCodexCli();
  return check.found
    ? { success: true, message: check.version }
    : { success: false, message: result.error || 'Codex CLI installation failed' };
}

async function installCodexApp() {
  return { success: false, message: 'Not available on Linux' };
}

async function installGithubCli(progress) {
  // apt repo is already added by ensureAptRepos before install starts
  if (progress) progress('Installing GitHub CLI via apt...');
  const aptResult = await installAptPackage('gh', progress, { label: 'GitHub CLI' });

  let check = await checkGithubCli();
  if (check.found) return { success: true, message: check.version };

  // Fallback: download .deb directly
  if (progress) progress('apt install failed, downloading .deb...');
  const url = dl.githubCli && typeof dl.githubCli.getUrl === 'function' ? dl.githubCli.getUrl() : null;
  if (url) {
    const tmpPath = path.join(os.tmpdir(), 'gh.deb');
    const downloadResult = await downloadFile(url, tmpPath);
    if (downloadResult.success) {
      const dpkgResult = await runElevatedCommandVerbose(`dpkg -i "${tmpPath}"`, 60000);
      await runElevatedCommand('apt-get install -f -y', 60000);
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      check = await checkGithubCli();
      if (check.found) return { success: true, message: check.version };
      return { success: false, message: dpkgResult.error || 'dpkg install failed' };
    } else {
      return { success: false, message: 'Download failed: ' + (downloadResult.error || 'unknown') };
    }
  }

  refreshPath();
  return { success: false, message: aptResult.error || 'GitHub CLI installation failed' };
}

async function uninstallNode(progress, options) {
  const removeNvm = !!(options && options.removeNvm);
  const nvmCheck = await checkNvm();

  if (nvmCheck.found) {
    // Node is managed by nvm
    if (removeNvm) {
      if (progress) progress('Removing nvm and Node.js...');
      const nvmDir = path.join(os.homedir(), '.nvm');
      try { fs.rmSync(nvmDir, { recursive: true, force: true }); } catch (_) {}
    } else {
      if (progress) progress('Removing current Node.js version from nvm...');
      await runShellCommandVerbose('bash -c "source ~/.nvm/nvm.sh && nvm deactivate && nvm uninstall $(node -v)"', 30000);
    }
  } else {
    // Node installed via apt
    if (progress) progress('Removing Node.js via apt...');
    await runElevatedCommandVerbose('apt-get remove -y nodejs npm', 120000);
  }

  refreshPath();
  const check = await checkNode();
  return check.found
    ? { success: false, message: 'Node.js could not be fully removed' }
    : { success: true, message: 'Removed' };
}

async function uninstallGit(progress) {
  if (progress) progress('Removing git via apt...');
  const result = await runElevatedCommandVerbose('apt-get remove -y git', 120000);
  refreshPath();
  const check = await checkGit();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: result.error || 'Git removal failed' };
}

async function uninstallClaude(progress) {
  if (progress) progress('Removing Claude CLI...');

  const home = os.homedir();

  // Native install (official method): rm binary + version data
  const nativeBin = path.join(home, '.local', 'bin', 'claude');
  const nativeData = path.join(home, '.local', 'share', 'claude');
  try { fs.unlinkSync(nativeBin); } catch (_) {}
  try { fs.rmSync(nativeData, { recursive: true, force: true }); } catch (_) {}

  // npm install: try npm uninstall if npm is available
  if (await which('npm')) {
    await runShellCommandVerbose('npm uninstall -g @anthropic-ai/claude-code', 60000);
  }

  refreshPath();
  const check = await checkClaude();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: 'Claude CLI removal failed' };
}

async function uninstallVSCode(progress) {
  if (progress) progress('Removing VS Code via apt...');
  const result = await runElevatedCommandVerbose('apt-get remove -y code', 120000);
  refreshPath();
  const check = await checkVSCode();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: result.error || 'VS Code removal failed' };
}

async function uninstallClaudeDesktop(progress) {
  if (progress) progress('Removing Claude Desktop...');
  const result = await runElevatedCommandVerbose('dpkg -r claude-desktop', 120000);
  refreshPath();
  const check = await checkClaudeDesktop();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: result.error || 'Claude Desktop removal failed' };
}

async function uninstallCodexCli(progress) {
  if (progress) progress('Removing Codex CLI...');
  if (await which('npm')) {
    await runShellCommandVerbose('npm uninstall -g @openai/codex', 60000);
  } else {
    // Remove binary directly if npm is unavailable
    const codexPath = await which('codex');
    if (codexPath) {
      try { fs.unlinkSync(codexPath); } catch (_) {}
    }
  }
  refreshPath();
  const check = await checkCodexCli();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: 'Codex CLI removal failed' };
}

async function uninstallCodexApp() {
  return { success: false, message: 'Not available on Linux' };
}

async function uninstallGithubCli(progress) {
  if (progress) progress('Removing GitHub CLI via apt...');
  const result = await runElevatedCommandVerbose('apt-get remove -y gh', 120000);
  refreshPath();
  const check = await checkGithubCli();
  return !check.found
    ? { success: true, message: 'Removed' }
    : { success: false, message: result.error || 'GitHub CLI removal failed' };
}

async function uninstallExtension(editor, extensionId, progress) {
  const command = `${editor} --uninstall-extension ${extensionId}`;
  if (progress) progress(`Removing ${extensionId}...`);
  const result = await runShellCommandVerbose(command, 60000);
  const installed = await checkExtension(editor, extensionId);
  return !installed
    ? { success: true, message: extensionId }
    : { success: false, message: result.error || `Failed to remove ${extensionId}` };
}

module.exports = {
  detectPackageManager,
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
  needsSudo,
  ensureAptRepos,
  ensureSudoSession,
  cleanupSudoSession
};
