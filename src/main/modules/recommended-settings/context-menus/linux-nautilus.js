'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const EXT_DIR       = path.join(os.homedir(), '.local', 'share', 'nautilus-python', 'extensions');
const CONFIG_DIR    = path.join(os.homedir(), '.local', 'share', 'smartmarine-ai');
const CONFIG_PATH   = path.join(CONFIG_DIR, 'ctx-menu.json');
const PY_BASENAME   = 'smai-context-menus.py';
const PY_EXT_PATH   = path.join(EXT_DIR, PY_BASENAME);
const LEGACY_BRANDS = ['claude', 'codex', 'vscode'];

function assetBase() {
  const packaged = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'src', 'renderer', 'assets', 'recommended-settings');
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', '..', '..', '..', 'renderer', 'assets', 'recommended-settings');
}

function sourcePy() { return path.join(assetBase(), 'nautilus', PY_BASENAME); }

function readEnabledMap() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8').trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_) { return {}; }
}

function writeEnabledMap(map) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(map, null, 2), 'utf8');
}

function cleanupLegacyPerBrandFiles() {
  // Prior versions deployed smai-open-<brand>.py — Nautilus would still load
  // those alongside the new consolidated extension, duplicating menu items.
  for (const brand of LEGACY_BRANDS) {
    const p = path.join(EXT_DIR, `smai-open-${brand}.py`);
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
  }
}

function ensureExtensionFile() {
  const src = sourcePy();
  if (!fs.existsSync(src)) {
    return { success: false, message: `Python extension source missing: ${src}` };
  }
  fs.mkdirSync(EXT_DIR, { recursive: true });
  fs.copyFileSync(src, PY_EXT_PATH);
  cleanupLegacyPerBrandFiles();
  return { success: true };
}

function installPythonNautilus(logger) {
  return new Promise((resolve) => {
    if (logger) logger({ type: 'log', data: { message: 'Installing python3-nautilus via pkexec...' } });
    const proc = spawn('pkexec', ['apt', 'install', '-y', 'python3-nautilus'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, message: `pkexec/apt exited ${code}: ${stderr.slice(0, 500)}` });
      }
    });
    proc.on('error', (err) => resolve({ success: false, message: err.message }));
  });
}

function isApplied({ brand }) {
  if (!fs.existsSync(PY_EXT_PATH)) return false;
  const map = readEnabledMap();
  return !!map[brand];
}

function apply({ brand }) {
  const result = ensureExtensionFile();
  if (!result.success) return result;
  const map = readEnabledMap();
  map[brand] = true;
  writeEnabledMap(map);
  // Do NOT call `nautilus -q` here — killing the user's file manager is
  // disruptive. The renderer surfaces a modal asking the user to restart
  // Nautilus themselves.
  return { success: true };
}

function revert({ brand }) {
  const map = readEnabledMap();
  if (map[brand]) { delete map[brand]; writeEnabledMap(map); }
  // If nothing is enabled anymore, remove the .py so Nautilus doesn't load
  // the provider at all — keeps startup fast on subsequent launches.
  const stillEnabled = Object.keys(map).some(k => !!map[k]);
  if (!stillEnabled && fs.existsSync(PY_EXT_PATH)) {
    try { fs.unlinkSync(PY_EXT_PATH); } catch (_) {}
  }
  return { success: true };
}

function getNautilusPids() {
  // Read /proc directly — no dependency on pgrep being in PATH (Electron's
  // env when launched from .desktop can be very sparse). Also faster than
  // forking a process.
  const pids = [];
  let entries = [];
  try { entries = fs.readdirSync('/proc'); } catch (_) { return pids; }
  for (const name of entries) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const comm = fs.readFileSync(`/proc/${name}/comm`, 'utf8').trim();
      if (comm === 'nautilus') pids.push(parseInt(name, 10));
    } catch (_) { /* process exited mid-scan */ }
  }
  return pids;
}

function getOpenNautilusTitles(logger) {
  // Read current Nautilus window titles via xdotool. Each title is the
  // folder's display name (e.g. "Home", "smartmarine_ai_app"). Generic
  // "org.gnome.Nautilus" titles are the loader window before the folder
  // is shown — filter those out.
  const log = (m) => { if (logger) try { logger(m); } catch (_) {} };
  try {
    const out = execFileSync('xdotool', ['search', '--class', 'nautilus'], {
      encoding: 'utf8', timeout: 2000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (!out) { log('no nautilus windows to restore'); return []; }
    const wids = out.split('\n').filter(Boolean);
    const titles = [];
    for (const wid of wids) {
      try {
        const t = execFileSync('xdotool', ['getwindowname', wid], {
          encoding: 'utf8', timeout: 1000, windowsHide: true
        }).trim();
        if (t && t !== 'org.gnome.Nautilus' && titles.indexOf(t) === -1) titles.push(t);
      } catch (_) {}
    }
    log('captured window titles: ' + JSON.stringify(titles));
    return titles;
  } catch (e) {
    log('xdotool unavailable: ' + (e.code || e.message));
    return [];
  }
}

function resolveTitlesToUris(titles, logger) {
  // Best-effort mapping from a Nautilus window title (usually just the
  // folder's display name) to a full file:// URI. Check in order:
  //   1. XDG user-dirs (Home, Documents, ...)
  //   2. GTK bookmarks (~/.config/gtk-3.0/bookmarks, gtk-4.0)
  //   3. ~/.local/share/recently-used.xbel (most recent match wins)
  const log = (m) => { if (logger) try { logger(m); } catch (_) {} };
  const home = os.homedir();
  const standard = {
    'Home': home,
    'Documents': path.join(home, 'Documents'),
    'Downloads': path.join(home, 'Downloads'),
    'Desktop': path.join(home, 'Desktop'),
    'Pictures': path.join(home, 'Pictures'),
    'Music': path.join(home, 'Music'),
    'Videos': path.join(home, 'Videos'),
    'Public': path.join(home, 'Public'),
    'Templates': path.join(home, 'Templates')
  };

  const bookmarkMap = {};
  for (const bf of ['gtk-3.0/bookmarks', 'gtk-4.0/bookmarks']) {
    const bp = path.join(home, '.config', bf);
    if (!fs.existsSync(bp)) continue;
    try {
      for (const line of fs.readFileSync(bp, 'utf8').split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (!parts[0] || !parts[0].startsWith('file://')) continue;
        try {
          const decoded = decodeURIComponent(parts[0].slice('file://'.length));
          const title = parts.slice(1).join(' ') || path.basename(decoded);
          bookmarkMap[title] = parts[0];
          bookmarkMap[path.basename(decoded)] = parts[0];
        } catch (_) {}
      }
    } catch (_) {}
  }

  const recentMap = {};
  const xbel = path.join(home, '.local', 'share', 'recently-used.xbel');
  if (fs.existsSync(xbel)) {
    try {
      const text = fs.readFileSync(xbel, 'utf8');
      const rx = /href="(file:\/\/[^"]+)"/g;
      let m;
      while ((m = rx.exec(text))) {
        let decoded;
        try { decoded = decodeURIComponent(m[1].slice('file://'.length)); } catch (_) { continue; }
        try {
          const st = fs.statSync(decoded);
          if (!st.isDirectory()) continue;
        } catch (_) { continue; }
        recentMap[path.basename(decoded)] = m[1];
      }
    } catch (_) {}
  }

  const uris = [];
  const unresolved = [];
  for (const t of titles) {
    if (standard[t] && fs.existsSync(standard[t])) {
      uris.push('file://' + standard[t]);
    } else if (bookmarkMap[t]) {
      uris.push(bookmarkMap[t]);
    } else if (recentMap[t]) {
      uris.push(recentMap[t]);
    } else {
      unresolved.push(t);
    }
  }
  log('resolved ' + uris.length + '/' + titles.length + ' titles' +
      (unresolved.length ? ' (unresolved: ' + JSON.stringify(unresolved) + ')' : ''));
  return { uris, unresolved };
}

function reopenFolders(uris, env, logger) {
  // Open all captured folders in a single DBus call. Falls back to one
  // detached `nautilus <path>` per URI if the DBus method is unreachable.
  const log = (m) => { if (logger) try { logger(m); } catch (_) {} };
  if (!uris || uris.length === 0) return { ok: false, method: null };
  try {
    const arg = '[' + uris.map(u => "'" + u.replace(/'/g, "'\\''") + "'").join(',') + ']';
    execFileSync('gdbus', [
      'call', '--session',
      '--dest', 'org.freedesktop.FileManager1',
      '--object-path', '/org/freedesktop/FileManager1',
      '--method', 'org.freedesktop.FileManager1.ShowFolders',
      arg, ''
    ], { timeout: 5000, stdio: 'ignore', windowsHide: true, env });
    log('reopened via FileManager1.ShowFolders');
    return { ok: true, method: 'dbus' };
  } catch (e) {
    log('ShowFolders failed: ' + (e.code || e.message) + '; falling back to per-URI spawn');
  }
  for (const u of uris) {
    try {
      const p = decodeURIComponent(u.replace(/^file:\/\//, ''));
      const child = spawn('nautilus', [p], { detached: true, stdio: 'ignore', env });
      child.unref();
    } catch (_) {}
  }
  return { ok: true, method: 'spawn-per-uri' };
}

function buildChildEnv() {
  // Electron started from a .desktop file may hand down an env stripped of
  // DISPLAY / WAYLAND_DISPLAY / DBUS_SESSION_BUS_ADDRESS. Without those the
  // child can't connect to the session bus or pop a window. Fill from the
  // best guesses available (most of these are set per-session under
  // /run/user/<uid>). Only fills what's missing — never overwrites.
  const env = Object.assign({}, process.env);
  const uid = String(process.getuid ? process.getuid() : '');
  if (!env.DBUS_SESSION_BUS_ADDRESS && uid) {
    const busPath = `/run/user/${uid}/bus`;
    if (fs.existsSync(busPath)) env.DBUS_SESSION_BUS_ADDRESS = 'unix:path=' + busPath;
  }
  if (!env.XDG_RUNTIME_DIR && uid) env.XDG_RUNTIME_DIR = `/run/user/${uid}`;
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) env.DISPLAY = ':0';
  return env;
}

function spawnFreshNautilus(logger) {
  const log = (m) => { console.log('[rs-restart] ' + m); if (logger) try { logger(m); } catch (_) {} };
  // Open one visible Files window. Try four mechanisms in order of
  // increasing fallback: each avoids a different missing-env pitfall that
  // has bitten us in production.
  const home = os.homedir();
  const uri = 'file://' + home;
  const env = buildChildEnv();
  const attempts = [];

  // 1) bash -ic + xdg-open
  try {
    execFileSync('bash', ['-ic', 'xdg-open ' + JSON.stringify(home) + ' >/dev/null 2>&1 &'], {
      timeout: 8000, stdio: 'ignore', windowsHide: true, env
    });
    log('opened via xdg-open');
    return { ok: true, method: 'xdg-open', attempts };
  } catch (e) {
    attempts.push({ method: 'xdg-open', error: e.code || e.message });
    log('xdg-open failed: ' + (e.code || e.message));
  }

  // 2) gdbus -> FileManager1.ShowFolders (session DBus).
  try {
    const arg = "['" + uri.replace(/'/g, "'\\''") + "']";
    execFileSync('gdbus', [
      'call', '--session',
      '--dest', 'org.freedesktop.FileManager1',
      '--object-path', '/org/freedesktop/FileManager1',
      '--method', 'org.freedesktop.FileManager1.ShowFolders',
      arg, ''
    ], { timeout: 5000, stdio: 'ignore', windowsHide: true, env });
    log('opened via gdbus ShowFolders');
    return { ok: true, method: 'dbus', attempts };
  } catch (e) {
    attempts.push({ method: 'dbus', error: e.code || e.message });
    log('gdbus failed: ' + (e.code || e.message));
  }

  // 3) gio open
  try {
    execFileSync('gio', ['open', home], {
      timeout: 5000, stdio: 'ignore', windowsHide: true, env
    });
    log('opened via gio');
    return { ok: true, method: 'gio', attempts };
  } catch (e) {
    attempts.push({ method: 'gio', error: e.code || e.message });
    log('gio failed: ' + (e.code || e.message));
  }

  // 4) Detached spawn('nautilus').
  try {
    const child = spawn('nautilus', [home], { detached: true, stdio: 'ignore', env });
    child.unref();
    log('opened via spawn(nautilus)');
    return { ok: true, method: 'spawn', attempts };
  } catch (e) {
    attempts.push({ method: 'spawn', error: e.code || e.message });
    log('spawn failed: ' + (e.code || e.message));
    return { ok: false, method: null, attempts };
  }
}

function restartNautilus(logger) {
  const log = (m) => { console.log('[rs-restart] ' + m); if (logger) try { logger(m); } catch (_) {} };
  return new Promise((resolve) => {
    // STEP 0 — capture currently open window titles BEFORE we kill anything.
    const capturedTitles = getOpenNautilusTitles(logger);
    const before = getNautilusPids();
    log('before pids: [' + before.join(',') + ']');

    // pkexec path: the user explicitly asked for a sudo-backed kill because
    // same-UID process.kill was unreliable in their Electron runtime. pkexec
    // pops a polkit password dialog, kills the daemon as root (guaranteed),
    // then we respawn as the regular user so the new nautilus inherits the
    // user's session, not root.
    const runPkexecKill = () => new Promise((done) => {
      log('pkexec killall -TERM nautilus (polkit prompt)');
      const proc = spawn('pkexec', ['killall', '-TERM', 'nautilus'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', (code) => {
        log('pkexec exit=' + code + (stderr.trim() ? ' stderr=' + stderr.trim().slice(0, 200) : ''));
        done({ code, stderr: stderr.trim() });
      });
      proc.on('error', (err) => {
        log('pkexec spawn error: ' + (err.code || err.message));
        done({ code: -1, stderr: err.message });
      });
    });

    if (before.length === 0) {
      const opened = spawnFreshNautilus(logger);
      log('not running; open method=' + opened.method + ' ok=' + opened.ok);
      return resolve({
        success: true, killed: 0, opened: opened.ok ? 1 : 0,
        note: 'not_running', openMethod: opened.method, attempts: opened.attempts
      });
    }

    // Run pkexec kill FIRST. This always prompts for the user's password via
    // polkit. On success, every nautilus is gone; on cancellation or error
    // we fall back to same-UID process.kill so the button still does
    // something useful.
    runPkexecKill().then((pkResult) => {
      const pkexecSucceeded = pkResult.code === 0;
      let signaled = 0;

      if (!pkexecSucceeded) {
        // User cancelled the prompt or pkexec isn't available — try the
        // plain SIGTERM path as a best-effort so the button isn't useless.
        log('pkexec did not succeed, falling back to same-UID SIGTERM');
        for (const pid of before) {
          try { process.kill(pid, 'SIGTERM'); signaled++; } catch (_) {}
        }
      } else {
        signaled = before.length; // pkexec killed all of them
      }
      log('SIGTERM delivered to ' + signaled + '/' + before.length);

    setTimeout(() => {
      const stillAlive = before.filter((pid) => {
        try { process.kill(pid, 0); return true; } catch (_) { return false; }
      });
      if (stillAlive.length > 0) {
        log('still alive after 400ms: [' + stillAlive.join(',') + '] -> SIGKILL');
        for (const pid of stillAlive) {
          try { process.kill(pid, 'SIGKILL'); } catch (_) {}
        }
      } else {
        log('all old pids exited after SIGTERM');
      }

      setTimeout(() => {
        const after = getNautilusPids();
        const oldStillRunning = after.filter(p => before.includes(p));
        log('final pids: [' + after.join(',') + '] old-still-running: [' + oldStillRunning.join(',') + ']');

        if (oldStillRunning.length > 0) {
          return resolve({
            success: false, killed: signaled,
            message: 'pids still alive: ' + oldStillRunning.join(',')
          });
        }

        // Give the daemon a moment to auto-respawn via DBus activation
        // before we ask it to show folders.
        setTimeout(() => {
          // Try to restore the previously-open windows first. Only fall
          // back to a fresh Home window if we had no titles or nothing
          // resolved to a path.
          const resolved = resolveTitlesToUris(capturedTitles, logger);
          const env = buildChildEnv();
          let restoredCount = 0;
          if (resolved.uris.length > 0) {
            const reopenResult = reopenFolders(resolved.uris, env, logger);
            if (reopenResult.ok) restoredCount = resolved.uris.length;
          }
          let opened = { ok: restoredCount > 0, method: restoredCount > 0 ? 'dbus' : null, attempts: [] };
          if (restoredCount === 0) {
            opened = spawnFreshNautilus(logger);
          }
          log('done. killed=' + signaled +
              ' restored=' + restoredCount +
              ' freshWindow=' + (restoredCount === 0 && opened.ok) +
              ' method=' + opened.method);
          resolve({
            success: true,
            killed: signaled,
            opened: opened.ok ? 1 : 0,
            openMethod: opened.method,
            attempts: opened.attempts,
            captured: capturedTitles.length,
            restored: restoredCount,
            unresolved: resolved.unresolved.length
          });
        }, 500);
      }, 200);
    }, 400);
    }); // close runPkexecKill().then()
  });
}

module.exports = { apply, revert, isApplied, installPythonNautilus, restartNautilus };
