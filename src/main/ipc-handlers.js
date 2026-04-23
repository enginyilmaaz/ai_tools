'use strict';

const { ipcMain, shell, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const skillInstaller = require('./modules/skill-installer');
const prerequisiteChecker = require('./modules/prerequisite-checker');
const mcpManager = require('./modules/mcp-manager');
const pluginManager = require('./modules/plugin-manager');
const recommendedSettings = require('./modules/recommended-settings');
const { getPaths } = require('./modules/platform');

let _createSubWindow = null;
let _mainWindow = null;

function setCreateSubWindow(fn) {
  _createSubWindow = fn;
}

function setMainWindow(win) {
  _mainWindow = win;
}

function logToMain(message) {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send('bridge-reply', { type: 'log', data: { message } });
  }
}

// Wraps a sender (possibly subwindow) so that 'log' messages also go to main window terminal
function wrapSenderWithMainLog(sender) {
  return {
    send: function (channel, msg) {
      sender.send(channel, msg);
      if (msg && msg.type === 'log' && _mainWindow && !_mainWindow.isDestroyed() && sender !== _mainWindow.webContents) {
        _mainWindow.webContents.send(channel, msg);
      }
    }
  };
}

function registerIpcHandlers() {
  // Shell
  ipcMain.handle('shell:open-external', async (_e, url) => {
    return shell.openExternal(url);
  });

  // Bridge message router
  ipcMain.on('bridge-message', (event, { type, data }) => {
    const sender = event.sender;

    switch (type) {
      // ==================== Live Stats ====================
      case 'getLiveStats': {
        const os = require('os');
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const usedMem = totalMem - os.freemem();

        // CPU usage: compare ticks between two snapshots
        if (!global._prevCpuTicks) global._prevCpuTicks = { idle: 0, total: 0 };
        let curIdle = 0, curTotal = 0;
        for (const cpu of cpus) {
          for (const type in cpu.times) curTotal += cpu.times[type];
          curIdle += cpu.times.idle;
        }
        const diffIdle = curIdle - global._prevCpuTicks.idle;
        const diffTotal = curTotal - global._prevCpuTicks.total;
        const cpuPercent = diffTotal > 0 ? Math.round(100 - (diffIdle / diffTotal * 100)) : 0;
        global._prevCpuTicks = { idle: curIdle, total: curTotal };

        // CPU speed: use os.cpus() speed, fallback to model string parse
        let speedMHz = cpus[0]?.speed || 0;
        if (!speedMHz) {
          const match = (cpus[0]?.model || '').match(/@\s*([\d.]+)\s*GHz/i);
          if (match) speedMHz = Math.round(parseFloat(match[1]) * 1000);
        }
        const cpuSpeed = speedMHz > 0 ? (speedMHz / 1000).toFixed(2) : null;

        sender.send('bridge-reply', { type: 'liveStats', data: {
          cpuPercent,
          cpuSpeed,
          usedRamGB: (usedMem / (1024 * 1024 * 1024)).toFixed(1),
          totalRamGB: (totalMem / (1024 * 1024 * 1024)).toFixed(1)
        }});
        break;
      }

      case 'getUptime': {
        const upSec = require('os').uptime();
        sender.send('bridge-reply', { type: 'uptimeResult', data: {
          days: Math.floor(upSec / 86400),
          hours: Math.floor((upSec % 86400) / 3600),
          minutes: Math.floor((upSec % 3600) / 60)
        }});
        break;
      }

      // ==================== Prerequisites ====================
      case 'checkAll':
        prerequisiteChecker.checkAll(wrapSenderWithMainLog(sender));
        break;

      case 'installSelected':
        prerequisiteChecker.installSelected(wrapSenderWithMainLog(sender), data);
        break;

      case 'uninstallSelected':
        prerequisiteChecker.uninstallSelected(wrapSenderWithMainLog(sender), data);
        break;

      case 'checkSkillsTargetPrerequisites':
        prerequisiteChecker.checkSkillsTargetPrerequisites(sender, data);
        break;

      // ==================== Skills ====================
      case 'installSkills':
        handleInstallSkills(wrapSenderWithMainLog(sender), data);
        break;

      case 'removeSkills': {
        const wrappedSender = wrapSenderWithMainLog(sender);
        const log = (msg) => wrappedSender.send('bridge-reply', { type: 'log', data: { message: msg } });
        const skills = (data && data.skills) || [];
        const target = data && data.target === 'codex' ? 'codex' : 'claude';
        log(`[Skills] Removing ${skills.length} skill(s) from ${target}...`);
        const results = skillInstaller.removeSkills(skills, target, log);
        const succeeded = results.filter(r => r.success).length;
        log(`[Skills] Done: ${succeeded} removed`);
        wrappedSender.send('bridge-reply', {
          type: 'removeSkillsResult',
          data: { success: true, results, target }
        });
        break;
      }

      case 'openSkillsFolder': {
        const paths = getPaths();
        shell.openPath(paths.skillsDir);
        break;
      }

      case 'setSkillsRepo':
        // Store skills repo path if needed
        break;

      // ==================== MCP Servers ====================
      case 'installMcp':
        mcpManager.install(wrapSenderWithMainLog(sender), data);
        break;

      case 'testMcpConnection':
        mcpManager.testConnection(wrapSenderWithMainLog(sender), data);
        break;

      case 'checkMcpStatus':
        mcpManager.checkStatus(wrapSenderWithMainLog(sender));
        break;

      case 'getMcpConfig':
        mcpManager.getConfig(sender, data);
        break;

      case 'saveMcpConfig':
        mcpManager.saveConfig(sender, data);
        break;

      case 'removeMcp':
        mcpManager.remove(wrapSenderWithMainLog(sender), data);
        break;

      // ==================== Plugins ====================
      case 'installPlugin':
        pluginManager.install(wrapSenderWithMainLog(sender), data);
        break;

      case 'removePlugin':
        pluginManager.remove(wrapSenderWithMainLog(sender), data);
        break;

      case 'checkPluginStatus':
        pluginManager.checkStatus(wrapSenderWithMainLog(sender));
        break;

      // ==================== SubWindows ====================
      case 'openAbout':
        if (_createSubWindow) _createSubWindow('about');
        break;

      case 'openBestPractices':
        if (_createSubWindow) _createSubWindow('best-practices');
        break;

      case 'openSkillUsage':
        if (_createSubWindow) _createSubWindow('skill-usage');
        break;

      case 'openSkills':
        if (_createSubWindow) _createSubWindow('skills');
        break;

      case 'openMcpGuide':
        if (_createSubWindow) _createSubWindow('mcp-guide');
        break;

      case 'openMcpServers':
        if (_createSubWindow) _createSubWindow('mcp-servers');
        break;

      case 'openDevTools':
        if (_createSubWindow) _createSubWindow('dev-tools');
        break;

      case 'openRecommendedSettings':
        if (_createSubWindow) _createSubWindow('recommended-settings');
        break;

      // ==================== Recommended Settings ====================
      case 'getRecommendedSettings':
        handleGetRecommendedSettings(sender);
        break;

      case 'applyRecommendedSettings':
        handleApplyRecommendedSettings(sender, data);
        break;

      case 'revertRecommendedSettings':
        handleRevertRecommendedSettings(sender, data);
        break;

      case 'restartFileManager':
        logToMain('[rs-restart] IPC received');
        handleRestartFileManager(sender);
        break;

      case 'openMcpHelp':
        handleOpenMcpHelp(sender);
        break;

      // ==================== Language ====================
      case 'switchLang':
        handleSwitchLang(sender, data);
        break;

      // ==================== General ====================
      case 'openUrl':
        if (data && data.url) shell.openExternal(data.url);
        break;

      case 'downloadBestPracticesPdf':
        handlePdfDownload(sender, data);
        break;

      case 'openBestPracticesInBrowser':
        handleBrowserOpen(data);
        break;

      case 'exit':
        require('electron').app.quit();
        break;

      case 'closeWindow': {
        const win = BrowserWindow.fromWebContents(sender);
        if (win) win.close();
        break;
      }
    }
  });
}

function handleInstallSkills(sender, data) {
  const log = (msg) => sender.send('bridge-reply', { type: 'log', data: { message: msg } });
  const skills = (data && data.skills) || [];
  const target = data && data.target === 'codex' ? 'codex' : 'claude';
  if (!skills.length) {
    log('[Skills] No skills selected');
    sender.send('bridge-reply', {
      type: 'installSkillsResult',
      data: { success: false, message: 'No skills selected', results: [], target }
    });
    return;
  }

  const repoDir = skillInstaller.getSkillsRepoDir();
  if (!repoDir) {
    log('[Skills] Skills repository not found');
    sender.send('bridge-reply', {
      type: 'installSkillsResult',
      data: { success: false, message: 'Skills repository not found', results: [], target }
    });
    return;
  }

  log(`[Skills] Installing ${skills.length} skill(s) for ${target}...`);
  const targetDir = skillInstaller.getSkillsDirectory(target);
  const results = skillInstaller.installSkills(repoDir, skills, target, log);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  for (const r of results) {
    if (!r.success) {
      log(`[Skills] ${r.name} failed${r.message ? ': ' + r.message : ''}`);
    }
  }
  log(`[Skills] Done: ${succeeded} installed, ${failed} failed`);

  // Upsert the minimal auto-trigger hooks for the installed skills.
  // installHooksForSkills removes any stale entries by code or canonical command
  // text, then appends the fresh entry with a `code` property.
  const installedSkills = results.filter(r => r.success).map(r => r.name);
  if (installedSkills.length > 0) {
    if (target === 'codex') {
      skillInstaller.installCodexHooksForSkills(installedSkills, log);
    } else {
      skillInstaller.installHooksForSkills(installedSkills, log);
    }
  }

  sender.send('bridge-reply', {
    type: 'installSkillsResult',
    data: {
      success: failed === 0,
      message: `Installed: ${succeeded} | Failed: ${failed}`,
      results,
      target,
      sourceDir: repoDir,
      targetDir,
      skillsDir: targetDir
    }
  });
}

function handleSwitchLang(sender, data) {
  const langCode = (data && data.lang) || 'en';
  let language = {};
  try {
    language = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'config', 'languages', langCode + '.json'), 'utf8'
    ));
  } catch (_) {}

  sender.send('bridge-reply', {
    type: 'languageChanged',
    data: { language, langCode }
  });
}

async function handlePdfDownload(sender, data) {
  const lang = (data && data.lang) === 'tr' ? 'tr' : 'en';
  const pdfPath = path.join(__dirname, '..', 'renderer', 'docs', `claude-code-best-practices-${lang}.pdf`);

  if (!fs.existsSync(pdfPath)) {
    sender.send('bridge-reply', { type: 'error', data: { message: 'PDF file not found' } });
    return;
  }

  const win = BrowserWindow.fromWebContents(sender);
  const result = await dialog.showSaveDialog(win, {
    defaultPath: `claude-code-best-practices-${lang}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (!result.canceled && result.filePath) {
    fs.copyFileSync(pdfPath, result.filePath);
    shell.openPath(result.filePath);
  }
}

function handleBrowserOpen(data) {
  const lang = (data && data.lang) === 'tr' ? 'tr' : 'en';
  const htmlPath = path.join(__dirname, '..', 'renderer', 'docs', `claude-code-best-practices-${lang}.html`);
  if (fs.existsSync(htmlPath)) {
    shell.openExternal('file://' + htmlPath);
  }
}

function handleOpenMcpHelp(sender) {
  // Determine language from sender window
  const win = BrowserWindow.fromWebContents(sender);
  if (win) {
    win.webContents.executeJavaScript("localStorage.getItem('lang') || 'en'")
      .then((lang) => {
        const helpLang = lang === 'tr' ? 'tr' : 'en';
        const htmlPath = path.join(__dirname, '..', 'renderer', 'docs', `mcp-help-${helpLang}.html`);
        if (fs.existsSync(htmlPath)) {
          shell.openExternal('file://' + htmlPath);
        }
      })
      .catch(() => {
        const htmlPath = path.join(__dirname, '..', 'renderer', 'docs', 'mcp-help-en.html');
        if (fs.existsSync(htmlPath)) shell.openExternal('file://' + htmlPath);
      });
  }
}

function handleGetRecommendedSettings(sender) {
  try {
    const status = recommendedSettings.getStatus();
    sender.send('bridge-reply', { type: 'recommendedSettingsStatus', data: status });
  } catch (err) {
    sender.send('bridge-reply', { type: 'recommendedSettingsStatus', data: { error: err.message } });
  }
}

async function handleApplyRecommendedSettings(sender, data) {
  const ids = (data && Array.isArray(data.ids)) ? data.ids : [];
  const onItem = (r) => sender.send('bridge-reply', { type: 'recommendedSettingResult', data: r });
  const logger = (message) => {
    const msg = '[rs-apply] ' + (typeof message === 'string' ? message : JSON.stringify(message));
    console.log(msg);
    logToMain(msg);
  };
  logger('batch start ids=' + JSON.stringify(ids));
  try {
    const summary = await recommendedSettings.applyMany(ids, onItem, logger);
    logger('batch done ' + JSON.stringify(summary));
    sender.send('bridge-reply', { type: 'recommendedSettingsBatchDone', data: { mode: 'apply', ...summary } });
  } catch (err) {
    logger('batch error ' + err.message);
    sender.send('bridge-reply', { type: 'recommendedSettingsBatchDone', data: { mode: 'apply', error: err.message } });
  }
}

function handleRevertRecommendedSettings(sender, data) {
  const ids = (data && Array.isArray(data.ids)) ? data.ids : [];
  const onItem = (r) => sender.send('bridge-reply', { type: 'recommendedSettingResult', data: r });
  const log = (msg) => { const m = '[rs-revert] ' + msg; console.log(m); logToMain(m); };
  log('batch start ids=' + JSON.stringify(ids));
  try {
    const summary = recommendedSettings.revertMany(ids, onItem);
    log('batch done ' + JSON.stringify(summary));
    sender.send('bridge-reply', { type: 'recommendedSettingsBatchDone', data: { mode: 'revert', ...summary } });
  } catch (err) {
    log('batch error ' + err.message);
    sender.send('bridge-reply', { type: 'recommendedSettingsBatchDone', data: { mode: 'revert', error: err.message } });
  }
}

async function handleRestartFileManager(sender) {
  // Direct logger — writes to both the main-window log panel (via logToMain)
  // AND the triggering subwindow. No dependency on wrapSenderWithMainLog,
  // which we've seen fail silently in some Electron runtime configurations.
  const logger = (message) => {
    const msg = '[rs-restart] ' + message;
    console.log(msg);
    logToMain(msg);
    try { sender.send('bridge-reply', { type: 'log', data: { message: msg } }); } catch (_) {}
  };
  logger('handler entered');
  try {
    const ctxMenus = require('./modules/recommended-settings/context-menus');
    const result = await ctxMenus.restartFileManager(logger);
    logger('result: ' + JSON.stringify(result));
    sender.send('bridge-reply', { type: 'fileManagerRestartResult', data: result });
  } catch (err) {
    logger('handler threw: ' + err.message);
    sender.send('bridge-reply', { type: 'fileManagerRestartResult', data: { success: false, message: err.message } });
  }
}

module.exports = { registerIpcHandlers, setCreateSubWindow, setMainWindow };
