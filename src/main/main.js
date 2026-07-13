'use strict';

const { app, BrowserWindow, Menu, shell, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Required for transparent windows on Linux (and some Windows setups)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-transparent-visuals');
  app.disableHardwareAcceleration();
}

// Detect virtualised environments on Windows/macOS and disable hardware
// acceleration there too. Chromium's half-accelerated / half-software GPU
// path inside a VM (VMware SVGA, VirtualBox Chromium driver, etc.) is
// slower and flakier than pure software rendering.
(function maybeDisableHwAccelInVm() {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return;
  let inVm = false;
  try {
    if (process.platform === 'win32') {
      const vendor = (process.env.COMPUTERNAME || '').toLowerCase();
      const procArch = (process.env.PROCESSOR_IDENTIFIER || '').toLowerCase();
      if (/vmware|virtualbox|hyperv|parallels|qemu/.test(vendor + ' ' + procArch)) inVm = true;
      if (!inVm && process.env.SYSTEMROOT) {
        const drivers = [
          path.join(process.env.SYSTEMROOT, 'System32', 'drivers', 'vmhgfs.sys'),
          path.join(process.env.SYSTEMROOT, 'System32', 'drivers', 'VBoxGuest.sys'),
          path.join(process.env.SYSTEMROOT, 'System32', 'drivers', 'prl_fs.sys')
        ];
        for (const d of drivers) {
          try { if (fs.existsSync(d)) { inVm = true; break; } } catch (_) {}
        }
      }
    } else if (process.platform === 'darwin') {
      const vendor = (process.env.HOSTNAME || '').toLowerCase();
      if (/vmware|virtualbox|parallels|qemu/.test(vendor)) inVm = true;
    }
  } catch (_) {}
  if (inVm) app.disableHardwareAcceleration();
})();

const { registerIpcHandlers, setCreateSubWindow, setMainWindow } = require('./ipc-handlers');
const logger = require('./shared/logger');
const updater = require('./shared/updater');

// Menu translations
const menuTranslations = {
  en: {
    file: 'File', edit: 'Edit', view: 'View', window: 'Window', help: 'Help',
    about: 'About', quit: 'Quit', close: 'Close',
    undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste',
    delete: 'Delete', selectAll: 'Select All',
    reload: 'Reload', forceReload: 'Force Reload', toggleDevTools: 'Toggle Developer Tools',
    resetZoom: 'Actual Size', zoomIn: 'Zoom In', zoomOut: 'Zoom Out',
    toggleFullscreen: 'Toggle Full Screen',
    minimize: 'Minimize', zoom: 'Zoom', front: 'Bring All to Front',
    settings: 'Settings', theme: 'Theme', language: 'Language',
    themeSystem: 'System (Auto)', themeDark: 'Dark', themeLight: 'Light',
    langEn: 'English', langTr: 'Türkçe'
  },
  tr: {
    file: 'Dosya', edit: 'Düzenle', view: 'Görünüm', window: 'Pencere', help: 'Yardım',
    about: 'Hakkında', quit: 'Çıkış', close: 'Kapat',
    undo: 'Geri Al', redo: 'Yinele', cut: 'Kes', copy: 'Kopyala', paste: 'Yapıştır',
    delete: 'Sil', selectAll: 'Tümünü Seç',
    reload: 'Yenile', forceReload: 'Zorla Yenile', toggleDevTools: 'Geliştirici Araçları',
    resetZoom: 'Gerçek Boyut', zoomIn: 'Yakınlaştır', zoomOut: 'Uzaklaştır',
    toggleFullscreen: 'Tam Ekran',
    minimize: 'Simge Durumuna Küçült', zoom: 'Yakınlaştır', front: 'Tümünü Öne Getir',
    settings: 'Ayarlar', theme: 'Tema', language: 'Dil',
    themeSystem: 'Sistem (Otomatik)', themeDark: 'Koyu', themeLight: 'Açık',
    langEn: 'İngilizce', langTr: 'Türkçe'
  }
};

let currentLang = 'en';
let currentThemeMode = 'system';
let mainWindow;
const subWindows = {};

function forEachOpenWindow(callback) {
  const wins = [mainWindow].concat(Object.values(subWindows));
  wins.forEach((win) => {
    if (win && !win.isDestroyed()) {
      callback(win);
    }
  });
}

function broadcastTheme(theme) {
  if (theme) currentThemeMode = theme;
  forEachOpenWindow((win) => {
    win.webContents.send('set-theme', currentThemeMode);
  });
}

function broadcastLanguage(lang) {
  if (!menuTranslations[lang]) return;
  currentLang = lang;
  createMenu();
  forEachOpenWindow((win) => {
    win.webContents.send('set-language', currentLang);
  });
}

function setWindowCapabilities(win, capabilities) {
  if (win) {
    win._windowCapabilities = Object.assign({}, capabilities);
  }
  return win;
}

function getWindowCapabilities(win) {
  const caps = (win && win._windowCapabilities) || {};
  return {
    minimizable: caps.minimizable !== false,
    maximizable: caps.maximizable !== false,
    resizable: caps.resizable !== false
  };
}

function syncWindowMaximizeState(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(win.isMaximized() ? 'window-maximized' : 'window-unmaximized');
}

function getAppIconPath() {
  const base = path.join(__dirname, '..', 'renderer', 'assets');
  if (process.platform === 'win32') {
    return path.join(base, 'app-icon.ico');
  }
  return path.join(base, 'app-icon.png');
}

// Install icon to system icon directories on Linux so desktop/taskbar can show it
function installLinuxSystemIcon() {
  if (process.platform !== 'linux') return;
  const base = path.join(__dirname, '..', 'renderer', 'assets');
  const iconName = 'ai-tool';
  const localIcons = path.join(os.homedir(), '.local', 'share', 'icons', 'hicolor', '256x256', 'apps');
  const pixmaps = path.join(os.homedir(), '.local', 'share', 'pixmaps');

  const iconSrc = path.join(base, 'app-icon.png');
  if (!fs.existsSync(iconSrc)) return;

  const targets = [
    path.join(localIcons, `${iconName}.png`),
    path.join(pixmaps, `${iconName}.png`)
  ];

  for (const dest of targets) {
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(iconSrc, dest);
    } catch (_) {}
  }
}

function hasSecondarySkillsColumn() {
  return false;
}

// Always run without sandbox (required for deb/AppImage on Linux)
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');

// Set WM_CLASS on Linux
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', 'ai-tool');
  app.setName('AI Tool');
}

function trackMaximize(win) {
  win.on('maximize', () => syncWindowMaximizeState(win));
  win.on('unmaximize', () => syncWindowMaximizeState(win));
}

function createWindow() {
  const windowHeight = process.platform === 'win32' ? 510 : 510;
  mainWindow = setWindowCapabilities(new BrowserWindow({
    width: 690,
    height: windowHeight,
    minWidth: 690,
    minHeight: windowHeight,
    resizable: false,
    minimizable: true,
    maximizable: false,
    transparent: true,
    backgroundMaterial: 'none',
    title: 'AI Tool',
    icon: getAppIconPath(),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  }), {
    resizable: false,
    minimizable: true,
    maximizable: false
  });

  logger.setWindow(mainWindow);
  setMainWindow(mainWindow);
  trackMaximize(mainWindow);
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (process.argv.includes('--devtools')) {
    mainWindow.webContents.openDevTools({ mode: 'bottom' });
  }

  mainWindow.on('closed', () => {
    for (const [, win] of Object.entries(subWindows)) {
      if (win && !win.isDestroyed()) {
        win.close();
      }
    }
    mainWindow = null;
  });

  // Show window immediately with loading overlay, then send init data async
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    mainWindow.webContents.executeJavaScript(`({
      themeMode: localStorage.getItem('theme') || 'system',
      lang: localStorage.getItem('lang') || ''
    })`)
      .then((settings) => {
        currentThemeMode = settings.themeMode;
        if (settings.lang) currentLang = settings.lang;
        createMenu();
        setImmediate(() => sendInitData());
      })
      .catch(() => {
        setImmediate(() => sendInitData());
      });
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

async function sendInitData() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const langCode = currentLang || 'en';
  let language = {};
  try {
    language = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'config', 'languages', langCode + '.json'), 'utf8'
    ));
  } catch (e) {
    try {
      language = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'config', 'languages', 'en.json'), 'utf8'
      ));
    } catch (_) {}
  }

  const systemInfo = require('./modules/system-info');
  const skillInstaller = require('./modules/skill-installer');
  const prerequisiteChecker = require('./modules/prerequisite-checker');
  const { getPaths } = require('./modules/platform');
  const paths = getPaths();

  // Run heavy operations concurrently — catch errors so init always sends
  let sysInfo = {}, skillsRepoPath = '', unavailableApps = [];
  try {
    [sysInfo, skillsRepoPath, unavailableApps] = await Promise.all([
      systemInfo.getAsync().catch(e => { logger.error('systemInfo.getAsync failed: ' + e.message); return {}; }),
      Promise.resolve(skillInstaller.getSkillsRepoDir()).catch(e => { logger.error('getSkillsRepoDir failed: ' + e.message); return ''; }),
      Promise.resolve(prerequisiteChecker.getUnavailableApps()).catch(e => { logger.error('getUnavailableApps failed: ' + e.message); return []; })
    ]);
  } catch (err) {
    logger.error('sendInitData critical error: ' + err.message);
  }

  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send('bridge-reply', {
    type: 'init',
    data: {
      version: app.getVersion(),
      commitId: 'dev',
      skillsRepoFound: !!skillsRepoPath,
      skillsRepoPath: skillsRepoPath || '',
      skillsDir: paths.skillsDir,
      projectScan: {},
      platform: process.platform,
      langCode,
      language,
      systemInfo: sysInfo,
      unavailableApps,
      settings: {
        theme: currentThemeMode,
        appVersion: app.getVersion(),
        buildId: 'dev'
      }
    }
  });

  // Send system info + hide unavailable apps via executeJavaScript (same pattern as CCSA's ExecuteScript)
  const sysInfoJson = JSON.stringify(sysInfo).replace(/'/g, "\\'");
  mainWindow.webContents.executeJavaScript(
    `if(typeof App!=='undefined')App._showSystemInfo(JSON.parse('${sysInfoJson}'))`
  ).catch(() => {});

  // Hide unavailable prereq rows (e.g. Claude Desktop on Linux)
  if (unavailableApps.length > 0) {
    const hideScript = unavailableApps.map(id =>
      `var r=document.querySelector('[data-id="${id}"]');if(r)r.style.display='none';`
    ).join('');
    mainWindow.webContents.executeJavaScript(hideScript).catch(() => {});
  }
}

function createSubWindow(pageName) {
  if (subWindows[pageName] && !subWindows[pageName].isDestroyed()) {
    subWindows[pageName].focus();
    return;
  }

  const isAbout = pageName === 'about';
  const isResizable = pageName === 'best-practices' || pageName === 'mcp-guide' || pageName === 'skill-usage';
  const projectScan = null;

  let winWidth, winHeight;
  if (isAbout) { winWidth = 580; winHeight = 520; }
  else if (pageName === 'best-practices' || pageName === 'mcp-guide') { winWidth = 1180; winHeight = 700; }
  else if (pageName === 'skill-usage') { winWidth = 1180; winHeight = 700; }
  else if (pageName === 'skills') { winWidth = 660; winHeight = 660; }
  else if (pageName === 'global-rules') { winWidth = 660; winHeight = 660; }
  else if (pageName === 'mcp-servers') { winWidth = 725; winHeight = 590; }
  else if (pageName === 'recommended-settings') { winWidth = 795; winHeight = 590; }
  else if (pageName === 'dev-tools') { winWidth = 520; winHeight = process.platform === 'win32' ? 690 : 610; }
  else { winWidth = 900; winHeight = 700; }

  const windowCapabilities = {
    resizable: isResizable,
    minimizable: true,
    maximizable: isResizable
  };

  const subOptions = {
    width: winWidth,
    height: winHeight,
    minWidth: winWidth,
    minHeight: winHeight,
    resizable: isResizable,
    minimizable: true,
    maximizable: isResizable,
    transparent: true,
    backgroundMaterial: 'none',
    modal: false,
    title: '',
    icon: getAppIconPath(),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  if (!isResizable) {
    subOptions.parent = mainWindow;
  }

  const sub = setWindowCapabilities(new BrowserWindow(subOptions), windowCapabilities);

  sub.setMenu(null);
  sub.setMenuBarVisibility(false);
  trackMaximize(sub);
  subWindows[pageName] = sub;

  sub.loadFile(path.join(__dirname, '..', 'renderer', 'subwindow.html'), {
    query: { page: pageName }
  });

  sub.webContents.on('did-finish-load', () => {
    // Send window capabilities after load
    sub.webContents.send('window-capabilities', getWindowCapabilities(sub));

    const langCode = currentLang || 'en';
    let language = {};
    try {
      language = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'config', 'languages', langCode + '.json'), 'utf8'
      ));
    } catch (_) {}

    let skillsRepoPath = '';
    let skillsDir = '';
    let projectScanData = {};

    try {
      const skillInstaller = require('./modules/skill-installer');
      const { getPaths } = require('./modules/platform');
      const paths = getPaths();
      skillsDir = paths.skillsDir;
      skillsRepoPath = skillInstaller.getSkillsRepoDir() || '';

      projectScanData = {};
    } catch (err) {
      console.error('Subwindow init error:', err);
    }

    // Always send init — even if skills/scan failed above
    sub.webContents.send('bridge-reply', {
      type: 'init',
      data: {
        langCode,
        language,
        platform: process.platform,
        skillsRepoFound: !!skillsRepoPath,
        skillsRepoPath,
        skillsDir,
        projectScan: projectScanData,
        settings: {
          theme: currentThemeMode,
          appVersion: app.getVersion(),
          buildId: 'dev'
        }
      }
    });

  });

  // Handle external links in subwindow
  sub.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  sub.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  sub.on('closed', () => {
    delete subWindows[pageName];
  });
}

function createMenu() {
  const t = menuTranslations[currentLang] || menuTranslations.en;

  const template = [
    {
      label: t.file,
      submenu: [
        { label: t.quit, role: 'quit' }
      ]
    },
    {
      label: t.edit,
      submenu: [
        { label: t.undo, role: 'undo' },
        { label: t.redo, role: 'redo' },
        { type: 'separator' },
        { label: t.cut, role: 'cut' },
        { label: t.copy, role: 'copy' },
        { label: t.paste, role: 'paste' },
        { label: t.delete, role: 'delete' },
        { type: 'separator' },
        { label: t.selectAll, role: 'selectAll' }
      ]
    },
    {
      label: t.view,
      submenu: [
        { label: t.reload, role: 'reload' },
        { label: t.forceReload, role: 'forceReload' },
        { label: t.toggleDevTools, role: 'toggleDevTools' },
        { type: 'separator' },
        { label: t.resetZoom, role: 'resetZoom' },
        { label: t.zoomIn, role: 'zoomIn' },
        { label: t.zoomOut, role: 'zoomOut' },
        { type: 'separator' },
        { label: t.toggleFullscreen, role: 'togglefullscreen' }
      ]
    },
    {
      label: t.window,
      submenu: [
        { label: t.minimize, role: 'minimize' },
        { label: t.zoom, role: 'zoom' },
        { label: t.close, role: 'close' }
      ]
    },
    {
      label: t.settings,
      submenu: [
        { label: t.theme, enabled: false },
        {
          label: t.themeSystem, type: 'radio', checked: currentThemeMode === 'system',
          click: () => { broadcastTheme('system'); }
        },
        {
          label: t.themeDark, type: 'radio', checked: currentThemeMode === 'dark',
          click: () => { broadcastTheme('dark'); }
        },
        {
          label: t.themeLight, type: 'radio', checked: currentThemeMode === 'light',
          click: () => { broadcastTheme('light'); }
        },
        { type: 'separator' },
        { label: t.language, enabled: false },
        {
          label: t.langEn, type: 'radio', checked: currentLang === 'en',
          click: () => { broadcastLanguage('en'); }
        },
        {
          label: t.langTr, type: 'radio', checked: currentLang === 'tr',
          click: () => { broadcastLanguage('tr'); }
        }
      ]
    },
    {
      label: t.help,
      submenu: [
        {
          label: t.about,
          click: () => createSubWindow('about')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  installLinuxSystemIcon();
  // Clear any stale in-app-update marker so it only ever gates the one install
  // that set it (a later manual dpkg must still kill the stale instance).
  try { fs.rmSync(path.join(os.tmpdir(), '.ai-tool-inapp-update'), { force: true }); } catch (_) {}
  setCreateSubWindow(createSubWindow);

  // Broadcast theme when system theme changes (for 'system' mode)
  nativeTheme.on('updated', () => {
    if (currentThemeMode === 'system') {
      broadcastTheme('system');
    }
  });
  registerIpcHandlers();

  // Handle language change from renderer
  ipcMain.on('set-language', (_event, lang) => {
    broadcastLanguage(lang);
  });

  ipcMain.on('set-theme', (_event, theme) => {
    broadcastTheme(theme);
  });

  // Window control IPC handlers
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (getWindowCapabilities(win).minimizable) win.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const caps = getWindowCapabilities(win);
    if (!caps.resizable || !caps.maximizable) return;

    if (win.isMaximized()) win.unmaximize();
    else win.maximize();

    setTimeout(() => syncWindowMaximizeState(win), 150);
  });


  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  // Return window capabilities so renderer can show/hide buttons
  ipcMain.on('window-config', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    event.returnValue = getWindowCapabilities(win);
  });

  // ── Auto-update (public repo: enginyilmaaz/ai_tools) ──
  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) return { available: false, reason: 'dev' };
    return updater.checkForUpdate();
  });

  ipcMain.handle('updater:install', async (event, assetUrl, assetName, sudoPassword) => {
    const marker = path.join(os.tmpdir(), '.ai-tool-inapp-update');
    try {
      if (process.platform !== 'linux') {
        return { success: false, error: 'Auto-install is only supported on Linux' };
      }
      if (sudoPassword) {
        const v = await updater.validateSudo(sudoPassword);
        if (!v.ok) return { success: false, error: v.error || 'Incorrect sudo password' };
      }
      // Marker so the new package postinst skips its stale-instance pkill —
      // this is an in-app update that relaunches itself.
      try { fs.writeFileSync(marker, '1'); } catch (_) {}
      const debPath = await updater.downloadAsset(assetUrl, assetName, (received, total) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('updater:download-progress', { received, total });
        }
      });
      const result = await updater.installDeb(debPath, sudoPassword);
      try { fs.rmSync(path.dirname(debPath), { recursive: true, force: true }); } catch (_) {}
      if (result.success) {
        app.relaunch();
        setTimeout(() => app.exit(0), 1000);
      } else {
        try { fs.rmSync(marker, { force: true }); } catch (_) {}
      }
      return result;
    } catch (err) {
      try { fs.rmSync(marker, { force: true }); } catch (_) {}
      return { success: false, error: err.message };
    }
  });

  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// Clean up temporary sudo session on quit (Linux only)
app.on('will-quit', () => {
  if (process.platform === 'linux') {
    try {
      const { platform } = require('./modules/platform');
      if (platform.cleanupSudoSession) platform.cleanupSudoSession();
    } catch (_) {}
  }
});
