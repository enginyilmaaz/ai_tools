'use strict';

const { platform, apps } = require('./platform');
const { isWindows, checkInternet } = require('./platform/core/exec');

const INSTALL_ORDER = {
  node: 10, git: 20, githubCli: 25, claude: 30, codexCli: 35,
  vscode: 40, vscodeClaude: 41, vscodeCodex: 42,
  claudeDesktop: 60, codexApp: 65
};

// Tool dependencies — key requires value to be installed first
const DEPENDS_ON = {
  codexCli: 'node',
  vscodeClaude: 'vscode',
  vscodeCodex: 'vscode'
};

// Map tool id to its check function name on the platform module
const CHECK_FN_MAP = {
  node: 'checkNode',
  git: 'checkGit',
  claude: 'checkClaude',
  vscode: 'checkVSCode',
  claudeDesktop: 'checkClaudeDesktop',
  codexCli: 'checkCodexCli',
  codexApp: 'checkCodexApp',
  githubCli: 'checkGithubCli'
};

function getUnavailableApps() {
  return Object.keys(apps).filter(id => apps[id] && apps[id].available === false);
}

async function checkAll(sender) {
  // Refresh PATH so nvm-installed node and other user-local binaries are found
  if (platform.refreshPath) platform.refreshPath();

  const unavailable = getUnavailableApps();

  const send = (id, found, version) => {
    sender.send('bridge-reply', { type: 'checkResult', data: { id, found, version } });
  };

  // Send unavailable apps as "not available" immediately
  for (const id of unavailable) {
    send(id, 'unavailable', null);
  }

  try {
    const checks = [];

    if (apps.node.available) {
      checks.push(platform.checkNode().then(r => send('node', r.found, r.version)));
    }
    if (apps.git.available) {
      checks.push(platform.checkGit().then(r => send('git', r.found, r.version)));
    }
    if (apps.claude.available) {
      checks.push(platform.checkClaude().then(r => send('claude', r.found, r.version)));
    }
    if (apps.vscode.available) {
      checks.push(
        platform.checkVSCode().then(r => {
          send('vscode', r.found, r.version);
          if (r.found) {
            // Check both extensions in parallel
            return Promise.all([
              platform.checkExtension('code', apps.vscodeClaude.extensionId),
              platform.checkExtension('code', apps.vscodeCodex.extensionId)
            ]).then(([hasClaude, hasCodex]) => {
              send('vscodeClaude', !!hasClaude, hasClaude && hasClaude !== true ? hasClaude : (hasClaude ? 'installed' : null));
              send('vscodeCodex', !!hasCodex, hasCodex && hasCodex !== true ? hasCodex : (hasCodex ? 'installed' : null));
            });
          } else {
            send('vscodeClaude', false, null);
            send('vscodeCodex', false, null);
          }
        })
      );
    }
    if (apps.claudeDesktop.available) {
      checks.push(platform.checkClaudeDesktop().then(r => send('claudeDesktop', r.found, r.version)));
    }
    if (apps.codexCli.available) {
      checks.push(platform.checkCodexCli().then(r => send('codexCli', r.found, r.version)));
    }
    if (apps.codexApp.available) {
      checks.push(platform.checkCodexApp().then(r => send('codexApp', r.found, r.version)));
    }
    if (apps.githubCli.available) {
      checks.push(platform.checkGithubCli().then(r => send('githubCli', r.found, r.version)));
    }

    // Check nvm status (non-blocking, separate result)
    if (platform.checkNvm) {
      checks.push(platform.checkNvm().then(r => send('nvm', r.found, r.version)));
    }

    await Promise.allSettled(checks);
    sender.send('bridge-reply', { type: 'checkAllDone', data: {} });
  } catch (err) {
    sender.send('bridge-reply', { type: 'checkAllDone', data: { error: err.message } });
  }
}

async function checkSkillsTargetPrerequisites(sender, data) {
  const target = data && data.target === 'codex' ? 'codex' : 'claude';
  const result = await getSkillsTargetPrerequisites(target);
  sender.send('bridge-reply', {
    type: 'skillsTargetPrereqResult',
    data: result
  });
}

async function getSkillsTargetPrerequisites(target) {
  const isCodex = target === 'codex';
  const cliCheck = isCodex
    ? await platform.checkCodexCli()
    : await platform.checkClaude();

  const editors = {
    vscode: { installed: false, extensionInstalled: false }
  };

  if (apps.vscode.available) {
    const vscode = await platform.checkVSCode();
    editors.vscode.installed = !!(vscode && vscode.found);
    if (editors.vscode.installed) {
      const extensionId = isCodex ? apps.vscodeCodex.extensionId : apps.vscodeClaude.extensionId;
      editors.vscode.extensionInstalled = await platform.checkExtension('code', extensionId);
    }
  }

  const editorReady = Object.keys(editors).some((key) => {
    return editors[key].installed && editors[key].extensionInstalled;
  });

  return {
    target,
    ok: !!(cliCheck && cliCheck.found) && editorReady,
    cliInstalled: !!(cliCheck && cliCheck.found),
    editors
  };
}

async function installSelected(sender, data) {
  const items = (data && data.items) || [];
  const silent = !!(data && data.silent);
  const options = (data && data.options) || {};
  const unavailable = getUnavailableApps();

  // Filter out unavailable apps and sort by install order
  const sorted = items
    .filter(id => !unavailable.includes(id))
    .sort((a, b) => (INSTALL_ORDER[a] || 99) - (INSTALL_ORDER[b] || 99));

  // Check internet before starting downloads
  const online = await checkInternet();
  sender.send('bridge-reply', { type: 'log', data: { message: `Internet check: ${online ? 'online' : 'offline'}` } });
  if (!online) {
    sender.send('bridge-reply', {
      type: 'installAllResult',
      data: {
        results: sorted.map(id => ({ id, success: false, message: 'No internet connection' })),
        noInternet: true
      }
    });
    return;
  }

  // On Linux, add missing apt repositories before installing any elevated apt-based packages
  if (platform.ensureAptRepos && platform.needsSudo && platform.needsSudo(sorted)) {
    const repoProgress = (msg) => {
      sender.send('bridge-reply', { type: 'log', data: { message: msg } });
    };
    await platform.ensureAptRepos(sorted, repoProgress);
  }

  // ── Windows: single UAC batch install for elevated tools ──
  if (isWindows() && platform.needsElevation && platform.needsElevation(sorted)) {
    return installSelectedWindows(sender, sorted, options);
  }

  // ── Linux / non-elevated flow ──
  return installSelectedSequential(sender, sorted, options);
}

/**
 * Windows batch install: download all → one UAC → silent install one-by-one → check results.
 * UI shows: Queued → Installing → Installed for each tool sequentially.
 * Non-elevated tools (npm, extensions) run after the batch completes.
 */
async function installSelectedWindows(sender, sorted, options) {
  const results = [];
  const failed = new Set();

  const log = (msg) => sender.send('bridge-reply', { type: 'log', data: { message: msg } });
  const progress = (id, status, message) => {
    sender.send('bridge-reply', { type: 'installProgress', data: { id, status, message } });
  };

  // Separate elevated vs non-elevated
  const elevatedIds = sorted.filter(id => platform.ELEVATED_TOOLS && platform.ELEVATED_TOOLS.has(id));
  const nonElevatedIds = sorted.filter(id => !platform.ELEVATED_TOOLS || !platform.ELEVATED_TOOLS.has(id));

  // Mark all elevated tools as "Queued", non-elevated too
  for (const id of elevatedIds) {
    progress(id, 'queued', 'Queued');
  }
  for (const id of nonElevatedIds) {
    progress(id, 'queued', 'Queued');
  }

  // Track which tool is currently installing via status file polling
  const doneSet = new Set();

  const onStepProgress = (status) => {
    // status: "INSTALLING:node", "DONE:node", "ALLDONE"
    const parts = status.split(':');
    if (parts.length < 2) return;
    const action = parts[0].trim();
    const id = parts[1].trim();

    if (action === 'INSTALLING') {
      progress(id, 'installing', 'Installing...');
      log(`[${id}] Installing...`);
    } else if (action === 'DONE') {
      doneSet.add(id);
    }
  };

  // Run batch install with per-step progress
  if (elevatedIds.length > 0) {
    // Notify user that UAC prompt will appear
    sender.send('bridge-reply', { type: 'uacNotice', data: { action: 'install' } });

    const batchProgress = (msg) => log(msg);
    const batchResult = await platform.runBatchInstall(elevatedIds, onStepProgress, batchProgress);

    if (!batchResult.success && batchResult.elevated) {
      for (const id of elevatedIds) {
        const msg = batchResult.error || 'UAC elevation cancelled';
        log(`[${id}] Installation failed — ${msg}`);
        progress(id, 'failed', msg);
        results.push({ id, success: false, message: msg });
        failed.add(id);
      }
    } else {
      // Check each tool with retry (installs may need a moment to finalize)
      if (platform.refreshPath) platform.refreshPath();
      for (const id of elevatedIds) {
        const checkFn = platform[CHECK_FN_MAP[id]];
        let found = false;
        if (checkFn) {
          for (let attempt = 0; attempt < 3 && !found; attempt++) {
            if (attempt > 0) {
              log(`[${id}] Retry ${attempt + 1}/3 — refreshing PATH...`);
              await new Promise(r => setTimeout(r, 3000));
              if (platform.refreshPath) platform.refreshPath();
            }
            try {
              const check = await checkFn();
              found = !!(check && check.found);
              if (found) {
                log(`[${id}] Post-install check: found=true${check.version ? ' version=' + check.version : ''}`);
              }
            } catch (e) {
              log(`[${id}] Check error: ${e.message}`);
            }
          }
        }

        if (found) {
          log(`[${id}] Installed successfully`);
          progress(id, 'done', '');
          results.push({ id, success: true, message: '' });
        } else {
          const msg = 'Not detected after install (batch completed, tool check failed after 3 retries)';
          log(`[${id}] Installation failed — ${msg}`);
          progress(id, 'failed', msg);
          results.push({ id, success: false, message: msg });
          failed.add(id);
        }
      }
    }
  }

  // Now install non-elevated tools sequentially
  for (const id of nonElevatedIds) {
    const dep = DEPENDS_ON[id];
    if (dep && failed.has(dep)) {
      let depInstalled = false;
      try {
        const checkFn = platform[CHECK_FN_MAP[dep]];
        if (checkFn) {
          const depCheck = await checkFn();
          depInstalled = !!(depCheck && depCheck.found);
        }
      } catch (_) {}

      if (!depInstalled) {
        const msg = `Skipped — requires ${dep} which is not installed`;
        log(`[${id}] ${msg}`);
        progress(id, 'failed', msg);
        results.push({ id, success: false, message: msg });
        failed.add(id);
        continue;
      }
    }

    progress(id, 'installing', 'Installing...');
    const stepProgress = (msg) => log(`[${id}] ${msg}`);

    let result;
    try {
      switch (id) {
        case 'codexCli':
          result = await platform.installCodexCli(stepProgress);
          break;
        case 'vscodeClaude':
          result = await platform.installExtension('code', apps.vscodeClaude.extensionId, stepProgress);
          break;
        case 'vscodeCodex':
          result = await platform.installExtension('code', apps.vscodeCodex.extensionId, stepProgress);
          break;
        default:
          result = { success: false, message: `Unknown tool: ${id}` };
      }
    } catch (err) {
      result = { success: false, message: err.message };
    }

    const logMsg = result.success
      ? `[${id}] Installed successfully${result.message ? ' — ' + result.message : ''}`
      : `[${id}] Installation failed${result.message ? ' — ' + result.message : ''}`;
    log(logMsg);
    progress(id, result.success ? 'done' : 'failed', result.message || '');

    if (!result.success) failed.add(id);
    results.push({ id, success: result.success, message: result.message || '' });
  }

  finishInstall(sender, results);
}

/**
 * Sequential install flow (Linux, or Windows with no elevated tools).
 */
async function installSelectedSequential(sender, sorted, options) {
  const results = [];
  const failed = new Set();

  for (const id of sorted) {
    const dep = DEPENDS_ON[id];
    if (dep && (failed.has(dep) || (!sorted.includes(dep) && results.every(r => r.id !== dep || !r.success)))) {
      let depInstalled = false;
      try {
        const checkFn = platform[CHECK_FN_MAP[dep]];
        if (checkFn) {
          const depCheck = await checkFn();
          depInstalled = !!(depCheck && depCheck.found);
        }
      } catch (_) {}

      if (!depInstalled) {
        const msg = `Skipped — requires ${dep} which is not installed`;
        sender.send('bridge-reply', { type: 'log', data: { message: `[${id}] ${msg}` } });
        sender.send('bridge-reply', { type: 'installProgress', data: { id, status: 'failed', message: msg } });
        results.push({ id, success: false, message: msg });
        failed.add(id);
        continue;
      }
    }

    sender.send('bridge-reply', { type: 'installProgress', data: { id, status: 'installing', message: 'Installing...' } });

    const progress = (msg) => {
      sender.send('bridge-reply', { type: 'log', data: { message: `[${id}] ${msg}` } });
    };

    let result;
    try {
      switch (id) {
        case 'node':
          result = await platform.installNode(progress, options.node);
          break;
        case 'git':
          result = await platform.installGit(progress);
          break;
        case 'claude':
          result = await platform.installClaude(progress);
          break;
        case 'vscode':
          result = await platform.installVSCode(progress);
          break;
        case 'claudeDesktop':
          result = await platform.installClaudeDesktop(progress);
          break;
        case 'vscodeClaude':
          result = await platform.installExtension('code', apps.vscodeClaude.extensionId, progress);
          break;
        case 'vscodeCodex':
          result = await platform.installExtension('code', apps.vscodeCodex.extensionId, progress);
          break;
        case 'codexCli':
          result = await platform.installCodexCli(progress);
          break;
        case 'codexApp':
          result = await platform.installCodexApp(progress);
          break;
        case 'githubCli':
          result = await platform.installGithubCli(progress);
          break;
        default:
          result = { success: false, message: `Unknown tool: ${id}` };
      }
    } catch (err) {
      result = { success: false, message: err.message };
    }

    const logMsg = result.success
      ? `[${id}] Installed successfully${result.message ? ' — ' + result.message : ''}`
      : `[${id}] Installation failed${result.message ? ' — ' + result.message : ''}`;
    sender.send('bridge-reply', { type: 'log', data: { message: logMsg } });
    sender.send('bridge-reply', {
      type: 'installProgress',
      data: { id, status: result.success ? 'done' : 'failed', message: result.message || '' }
    });

    if (!result.success) failed.add(id);
    results.push({ id, success: result.success, message: result.message || '' });
  }

  finishInstall(sender, results);
}

function finishInstall(sender, results) {
  finishOperation(sender, results, 'install');
}

// Reverse install order for uninstall — children before parents
const UNINSTALL_ORDER = {
  vscodeClaude: 10, vscodeCodex: 11,
  codexCli: 20, codexApp: 25, claudeDesktop: 30,
  claude: 40, githubCli: 45,
  vscode: 50,
  git: 60, node: 70
};

async function uninstallSelected(sender, data) {
  const items = (data && data.items) || [];
  const options = (data && data.options) || {};
  const unavailable = getUnavailableApps();

  // Filter out unavailable apps and sort by uninstall order (children first)
  const sorted = items
    .filter(id => !unavailable.includes(id))
    .sort((a, b) => (UNINSTALL_ORDER[a] || 99) - (UNINSTALL_ORDER[b] || 99));

  // On Linux, ensure sudo session before removing elevated apt-based packages
  if (platform.ensureSudoSession && platform.needsSudo && platform.needsSudo(sorted)) {
    const repoProgress = (msg) => {
      sender.send('bridge-reply', { type: 'log', data: { message: msg } });
    };
    repoProgress('Requesting elevated privileges for removal...');
    await platform.ensureSudoSession();
  }

  // ── Windows: single UAC batch uninstall ──
  if (isWindows() && platform.needsElevation && platform.needsElevation(sorted)) {
    return uninstallSelectedWindows(sender, sorted, options);
  }

  return uninstallSelectedSequential(sender, sorted, options);
}

async function uninstallSelectedWindows(sender, sorted, options) {
  const results = [];
  const log = (msg) => sender.send('bridge-reply', { type: 'log', data: { message: msg } });
  const progress = (id, status, message) => {
    sender.send('bridge-reply', { type: 'uninstallProgress', data: { id, status, message } });
  };

  const elevatedIds = sorted.filter(id => platform.ELEVATED_TOOLS && platform.ELEVATED_TOOLS.has(id));
  const nonElevatedIds = sorted.filter(id => !platform.ELEVATED_TOOLS || !platform.ELEVATED_TOOLS.has(id));

  // Non-elevated first (extensions, npm packages) — children before parents
  for (const id of nonElevatedIds) {
    progress(id, 'removing', 'Removing...');
    const stepProgress = (msg) => log(`[${id}] ${msg}`);
    let result;
    try {
      switch (id) {
        case 'vscodeClaude':
          result = await platform.uninstallExtension('code', apps.vscodeClaude.extensionId, stepProgress);
          break;
        case 'vscodeCodex':
          result = await platform.uninstallExtension('code', apps.vscodeCodex.extensionId, stepProgress);
          break;
        case 'codexCli':
          result = await platform.uninstallCodexCli(stepProgress);
          break;
        default:
          result = { success: false, message: `Unknown tool: ${id}` };
      }
    } catch (err) {
      result = { success: false, message: err.message };
    }
    log(result.success ? `[${id}] Removed successfully` : `[${id}] Removal failed — ${result.message || ''}`);
    progress(id, result.success ? 'done' : 'failed', result.message || '');
    results.push({ id, success: result.success, message: result.message || '' });
  }

  // Elevated batch
  if (elevatedIds.length > 0) {
    for (const id of elevatedIds) progress(id, 'removing', 'Preparing...');

    // Notify user that UAC prompt will appear
    sender.send('bridge-reply', { type: 'uacNotice', data: { action: 'remove' } });

    const batchResult = await platform.runBatchUninstall(elevatedIds, (msg) => log(msg));

    for (const id of elevatedIds) {
      if (!batchResult.success) {
        const msg = batchResult.error || 'UAC elevation cancelled';
        log(`[${id}] Removal failed — ${msg}`);
        progress(id, 'failed', msg);
        results.push({ id, success: false, message: msg });
      } else {
        const checkFn = platform[CHECK_FN_MAP[id]];
        let stillInstalled = false;
        if (checkFn) {
          try {
            const check = await checkFn();
            stillInstalled = !!(check && check.found);
          } catch (_) {}
        }
        if (!stillInstalled) {
          log(`[${id}] Removed successfully`);
          progress(id, 'done', '');
          results.push({ id, success: true, message: '' });
        } else {
          log(`[${id}] Removal failed — still detected`);
          progress(id, 'failed', 'Still detected after removal');
          results.push({ id, success: false, message: 'Still detected after removal' });
        }
      }
    }
  }

  finishUninstall(sender, results);
}

async function uninstallSelectedSequential(sender, sorted, options) {
  const results = [];

  for (const id of sorted) {
    sender.send('bridge-reply', { type: 'uninstallProgress', data: { id, status: 'removing', message: 'Removing...' } });

    const progress = (msg) => {
      sender.send('bridge-reply', { type: 'log', data: { message: `[${id}] ${msg}` } });
    };

    let result;
    try {
      switch (id) {
        case 'node':
          result = await platform.uninstallNode(progress, options.node);
          break;
        case 'git':
          result = await platform.uninstallGit(progress);
          break;
        case 'claude':
          result = await platform.uninstallClaude(progress);
          break;
        case 'vscode':
          result = await platform.uninstallVSCode(progress);
          break;
        case 'claudeDesktop':
          result = await platform.uninstallClaudeDesktop(progress);
          break;
        case 'vscodeClaude':
          result = await platform.uninstallExtension('code', apps.vscodeClaude.extensionId, progress);
          break;
        case 'vscodeCodex':
          result = await platform.uninstallExtension('code', apps.vscodeCodex.extensionId, progress);
          break;
        case 'codexCli':
          result = await platform.uninstallCodexCli(progress);
          break;
        case 'codexApp':
          result = await platform.uninstallCodexApp(progress);
          break;
        case 'githubCli':
          result = await platform.uninstallGithubCli(progress);
          break;
        default:
          result = { success: false, message: `Unknown tool: ${id}` };
      }
    } catch (err) {
      result = { success: false, message: err.message };
    }

    const logMsg = result.success
      ? `[${id}] Removed successfully`
      : `[${id}] Removal failed${result.message ? ' — ' + result.message : ''}`;
    sender.send('bridge-reply', { type: 'log', data: { message: logMsg } });
    sender.send('bridge-reply', {
      type: 'uninstallProgress',
      data: { id, status: result.success ? 'done' : 'failed', message: result.message || '' }
    });

    results.push({ id, success: result.success, message: result.message || '' });
  }

  finishUninstall(sender, results);
}

function finishUninstall(sender, results) {
  finishOperation(sender, results, 'uninstall');
}

function finishOperation(sender, results, action) {
  const ok = results.filter(r => r.success).length;
  const fail = results.length - ok;
  const label = action === 'install' ? 'Install' : 'Uninstall';
  sender.send('bridge-reply', {
    type: 'log',
    data: { message: `${label} complete: ${ok}/${results.length} succeeded${fail ? ', ' + fail + ' failed' : ''}` }
  });
  sender.send('bridge-reply', {
    type: `${action}AllResult`,
    data: { results }
  });
}

module.exports = { checkAll, checkSkillsTargetPrerequisites, installSelected, uninstallSelected, getUnavailableApps };
