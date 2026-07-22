'use strict';

// Standalone hooks installer (public app — flat asset layout).
//
// A "standalone hook" is a self-contained Claude Code hook shipped as an asset:
// a manifest entry plus one or more script files. Installing it copies the
// script(s) into ~/.claude/hooks/ and merges the hook's `settings` fragment
// into ~/.claude/settings.json — idempotently, by leaf command text. Removing
// it strips that settings entry and deletes the copied script(s).
//
// Source: the bundled `src/assets/hooks` submodule dir with a flat manifest.json
// (this app carries only public assets, so there is no private/ half to merge).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function getHooksRepoDir() {
  const projectRoot = path.join(__dirname, '..', '..', '..');
  for (const c of [path.join(projectRoot, 'src', 'assets', 'hooks'), path.join(projectRoot, 'src', 'assets', 'Hooks')]) {
    if (fs.existsSync(path.join(c, 'manifest.json'))) return path.resolve(c);
  }
  return null;
}

function readManifest(repoDir) {
  const dir = repoDir || getHooksRepoDir();
  if (!dir) return null;
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    if (!m || !Array.isArray(m.hooks)) return { hooks: [] };
    const hooks = m.hooks.map(h => Object.assign({}, h, { _base: dir }));
    hooks.sort((a, b) => (a.order || 0) - (b.order || 0));
    return { hooks };
  } catch (_) { return null; }
}

// ----- target settings.json (~/.claude) -------------------------------------

function getSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8')); }
  catch (_) { return {}; }
}

function writeSettings(settings, log) {
  const file = getSettingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2), 'utf8');
  if (log) log('[Hooks] Wrote ' + file);
}

function commandsOf(hook) {
  const out = [];
  const frag = (hook && hook.settings && hook.settings.hooks) || {};
  for (const ev of Object.keys(frag)) {
    for (const group of (frag[ev] || [])) {
      for (const h of (group.hooks || [])) {
        if (h && h.command) out.push({ event: ev, command: h.command });
      }
    }
  }
  return out;
}

function isInstalled(settings, hook) {
  const want = commandsOf(hook);
  if (!want.length) return false;
  const have = new Set();
  const hooks = (settings && settings.hooks) || {};
  for (const ev of Object.keys(hooks)) {
    for (const group of (hooks[ev] || [])) {
      for (const h of (group.hooks || [])) {
        if (h && h.command) have.add(ev + ' ' + h.command);
      }
    }
  }
  return want.every(w => have.has(w.event + ' ' + w.command));
}

function getHooksState() {
  const m = readManifest();
  const state = {};
  if (!m) return state;
  const settings = readSettings();
  for (const hook of m.hooks) state[hook.id] = isInstalled(settings, hook);
  return state;
}

function mergeHookSettings(settings, hook) {
  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};
  const frag = (hook.settings && hook.settings.hooks) || {};
  for (const ev of Object.keys(frag)) {
    if (!Array.isArray(settings.hooks[ev])) settings.hooks[ev] = [];
    const addCmds = new Set();
    for (const group of (frag[ev] || [])) for (const h of (group.hooks || [])) if (h.command) addCmds.add(h.command);
    settings.hooks[ev] = settings.hooks[ev].filter(group =>
      !(group.hooks || []).some(h => h && addCmds.has(h.command))
    );
    for (const group of (frag[ev] || [])) settings.hooks[ev].push(JSON.parse(JSON.stringify(group)));
  }
}

function stripHookSettings(settings, hook) {
  const frag = (hook.settings && hook.settings.hooks) || {};
  if (!settings.hooks) return;
  for (const ev of Object.keys(frag)) {
    if (!Array.isArray(settings.hooks[ev])) continue;
    const rmCmds = new Set();
    for (const group of (frag[ev] || [])) for (const h of (group.hooks || [])) if (h.command) rmCmds.add(h.command);
    settings.hooks[ev] = settings.hooks[ev].filter(group =>
      !(group.hooks || []).some(h => h && rmCmds.has(h.command))
    );
    if (!settings.hooks[ev].length) delete settings.hooks[ev];
  }
}

function copyHookFiles(hook, log) {
  for (const f of (hook.files || [])) {
    try {
      const src = path.join(hook._base, f.src);
      const dest = expandHome(f.dest);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      if (f.chmod) fs.chmodSync(dest, parseInt(f.chmod, 8));
      log('[Hooks] Copied ' + f.src + ' -> ' + dest);
    } catch (err) {
      log('[Hooks] WARNING: copy ' + f.src + ' failed: ' + err.message);
    }
  }
}

function removeHookFiles(hook, log) {
  for (const f of (hook.files || [])) {
    try {
      const dest = expandHome(f.dest);
      if (fs.existsSync(dest)) { fs.unlinkSync(dest); log('[Hooks] Removed ' + dest); }
    } catch (_) {}
  }
}

function ensureDependencies(hook, log) {
  for (const dep of (hook.dependencies || [])) {
    try {
      if (dep.type === 'python-venv-cli') {
        const bin = expandHome(dep.bin);
        if (bin && fs.existsSync(bin)) { log('[Hooks] Dependency ' + dep.pip + ' already present'); continue; }
        const venv = expandHome(dep.venv);
        log('[Hooks] Installing dependency ' + dep.pip + ' into ' + venv + ' (best-effort)...');
        execFileSync('python3', ['-m', 'venv', venv], { timeout: 60000 });
        execFileSync(path.join(venv, 'bin', 'pip'), ['install', '--quiet', dep.pip], { timeout: 180000 });
        const built = path.join(venv, 'bin', dep.pip);
        if (bin && fs.existsSync(built)) {
          fs.mkdirSync(path.dirname(bin), { recursive: true });
          try { fs.unlinkSync(bin); } catch (_) {}
          fs.symlinkSync(built, bin);
        }
        log('[Hooks] Dependency ' + dep.pip + ' installed');
      }
    } catch (err) {
      log('[Hooks] WARNING: dependency ' + (dep.pip || dep.type) + ' failed: ' + err.message + ' (hook installed anyway)');
    }
  }
}

function installHooks(ids, logFn) {
  const log = logFn || function () {};
  const dir = getHooksRepoDir();
  if (!dir) return { ok: false, error: 'Hooks source not found (src/assets/hooks)' };
  const m = readManifest(dir);
  if (!m) return { ok: false, error: 'Invalid or missing hooks manifest' };
  const byId = new Map(m.hooks.map(h => [h.id, h]));
  const settings = readSettings();
  const applied = [];
  for (const id of ids || []) {
    const hook = byId.get(id);
    if (!hook) { log('[Hooks] Unknown hook: ' + id); continue; }
    copyHookFiles(hook, log);
    ensureDependencies(hook, log);
    mergeHookSettings(settings, hook);
    applied.push(id);
    log('[Hooks] Installed ' + id);
  }
  writeSettings(settings, log);
  return { ok: true, applied };
}

function removeHooks(ids, logFn) {
  const log = logFn || function () {};
  const dir = getHooksRepoDir();
  if (!dir) return { ok: false, error: 'Hooks source not found (src/assets/hooks)' };
  const m = readManifest(dir);
  if (!m) return { ok: false, error: 'Invalid or missing hooks manifest' };
  const byId = new Map(m.hooks.map(h => [h.id, h]));
  const settings = readSettings();
  const removed = [];
  for (const id of ids || []) {
    const hook = byId.get(id);
    if (!hook) continue;
    stripHookSettings(settings, hook);
    removeHookFiles(hook, log);
    removed.push(id);
    log('[Hooks] Removed ' + id);
  }
  writeSettings(settings, log);
  return { ok: true, removed };
}

module.exports = {
  getHooksRepoDir,
  readManifest,
  getHooksState,
  installHooks,
  removeHooks,
  _internal: { commandsOf, isInstalled, mergeHookSettings, stripHookSettings }
};
