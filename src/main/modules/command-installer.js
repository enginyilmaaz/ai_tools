'use strict';

// Slash-command installer.
//
// A "command" is a Claude Code slash-command shipped as an asset: a single
// markdown file living under a group folder (e.g. `claude/move-session.md`)
// whose leading `---`…`---` YAML frontmatter carries a `description` and an
// optional `argument-hint`. Installing it copies the markdown into
// ~/.claude/commands/<group>/<name>.md, plus any helper files that share the
// command's basename (e.g. `move-session.sh` beside `move-session.md`) — shell
// scripts / shebang files are made executable. Removing it deletes the markdown
// and those helpers (and the now-empty group folder). Commands target Claude
// Code only — there is no Codex target and no settings.json merge.
//
// Single-tier layout: `src/assets` IS the bundled ai_assets submodule, so the
// commands live directly under `src/assets/commands/<group>/<name>.md` (no
// private/public split). Commands are AUTO-DISCOVERED by walking that tree; the
// `README.md` (and any other root-level file) is skipped.

const fs = require('fs');
const path = require('path');
const os = require('os');

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

// ----- source resolution ----------------------------------------------------

// Is `commandsDir` a directory that holds at least one group subfolder?
function hasGroupSubdirs(commandsDir) {
  try {
    if (!fs.statSync(commandsDir).isDirectory()) return false;
    return fs.readdirSync(commandsDir, { withFileTypes: true }).some(e => e.isDirectory());
  } catch (_) {
    return false;
  }
}

// Only read from src/assets/commands (bundled submodule; flat single-tier layout).
function getCommandsRepoDir() {
  const projectRoot = path.join(__dirname, '..', '..', '..');
  for (const c of [
    path.join(projectRoot, 'src', 'assets', 'commands'),
    path.join(projectRoot, 'src', 'assets', 'Commands')
  ]) {
    if (hasGroupSubdirs(c)) return path.resolve(c);
  }
  return null;
}

// ----- frontmatter parsing --------------------------------------------------

// Parse the leading `---`…`---` YAML frontmatter with a simple line parser (no
// yaml dependency — matches the repo style). Only single-line `description` and
// `argument-hint` values are extracted; surrounding quotes are stripped.
function parseFrontmatter(text) {
  const out = { description: '', argumentHint: '' };
  if (!text) return out;
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);
  if ((lines[0] || '').trim() !== '---') return out;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') break; // end of frontmatter
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const key = m[1].toLowerCase();
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key === 'description') out.description = val;
    else if (key === 'argument-hint') out.argumentHint = val;
  }
  return out;
}

// ----- helper (auxiliary) files ---------------------------------------------

// Files that ship next to a command markdown and share its basename but a
// different extension (e.g. `move-session.sh` beside `move-session.md`).
// `srcMdPath` is the absolute path of the command's .md; returns bare file names.
function siblingAuxFiles(srcMdPath, name) {
  const dirName = path.dirname(srcMdPath);
  let entries;
  try { entries = fs.readdirSync(dirName, { withFileTypes: true }); } catch (_) { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const parsed = path.parse(e.name);
    if (parsed.name === name && parsed.ext.toLowerCase() !== '.md') out.push(e.name);
  }
  return out;
}

// Should this helper be marked executable on install? Shell scripts by extension,
// or any file whose first two bytes are a `#!` shebang.
function isScript(fileName, absPath) {
  if (/\.(sh|bash|zsh)$/i.test(fileName)) return true;
  try {
    const fd = fs.openSync(absPath, 'r');
    const buf = Buffer.alloc(2);
    const n = fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    return n === 2 && buf[0] === 0x23 && buf[1] === 0x21; // '#!'
  } catch (_) { return false; }
}

// ----- discovery ------------------------------------------------------------

// Walk src/assets/commands and emit one object per command file. Root-level
// files (e.g. README.md) and non-directories are skipped. Returns
// { commands: [...] } sorted by group then name.
function scanCommands() {
  const dir = getCommandsRepoDir();
  const commands = [];
  if (!dir) return { commands };

  let groups;
  try { groups = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return { commands }; }
  for (const g of groups) {
    if (!g.isDirectory()) continue; // skip root-level README.md and files
    const group = g.name;
    const groupDir = path.join(dir, group);
    let files;
    try { files = fs.readdirSync(groupDir, { withFileTypes: true }); } catch (_) { continue; }
    for (const f of files) {
      if (!f.isFile() || !/\.md$/i.test(f.name)) continue;
      const name = f.name.replace(/\.md$/i, '');
      const id = group + ':' + name;
      let fm = { description: '', argumentHint: '' };
      try { fm = parseFrontmatter(fs.readFileSync(path.join(groupDir, f.name), 'utf8')); } catch (_) {}
      commands.push({
        id: id,
        group: group,
        name: name,
        command: '/' + group + ':' + name,
        description: fm.description || '',
        argumentHint: fm.argumentHint || '',
        icon: 'terminal',
        _base: dir,
        src: group + '/' + name + '.md',
        dest: '~/.claude/commands/' + group + '/' + name + '.md'
      });
    }
  }
  commands.sort((a, b) => (a.group === b.group ? a.name.localeCompare(b.name) : a.group.localeCompare(b.group)));
  return { commands };
}

// Which command ids are currently present in ~/.claude/commands.
function getCommandsState() {
  const state = {};
  for (const cmd of scanCommands().commands) {
    state[cmd.id] = fs.existsSync(expandHome(cmd.dest));
  }
  return state;
}

// ----- public operations ----------------------------------------------------

function installCommands(ids, logFn) {
  const log = logFn || function () {};
  const dir = getCommandsRepoDir();
  if (!dir) return { ok: false, error: 'Commands source not found (src/assets/commands)' };
  const byId = new Map(scanCommands().commands.map(c => [c.id, c]));
  const applied = [];
  try {
    for (const id of ids || []) {
      const cmd = byId.get(id);
      if (!cmd) { log('[Commands] Unknown command: ' + id); continue; }
      const src = path.join(cmd._base, cmd.src);
      const dest = expandHome(cmd.dest);
      const destDir = path.dirname(dest);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
      log('[Commands] Installed ' + id + ' -> ' + dest);
      // Copy helper files that share the command's basename (e.g. move-session.sh),
      // making shell scripts executable so the command can run them.
      for (const aux of siblingAuxFiles(src, cmd.name)) {
        const srcAux = path.join(path.dirname(src), aux);
        const destAux = path.join(destDir, aux);
        fs.copyFileSync(srcAux, destAux);
        if (isScript(aux, srcAux)) { try { fs.chmodSync(destAux, 0o755); } catch (_) {} }
        log('[Commands] Installed helper ' + aux + ' -> ' + destAux);
      }
      applied.push(id);
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: true, applied };
}

function removeCommands(ids, logFn) {
  const log = logFn || function () {};
  const dir = getCommandsRepoDir();
  if (!dir) return { ok: false, error: 'Commands source not found (src/assets/commands)' };
  const byId = new Map(scanCommands().commands.map(c => [c.id, c]));
  const removed = [];
  try {
    for (const id of ids || []) {
      const cmd = byId.get(id);
      if (!cmd) continue;
      const dest = expandHome(cmd.dest);
      const groupDir = path.dirname(dest);
      // Remove the command markdown plus any helper files sharing its basename
      // (e.g. move-session.md + move-session.sh) from the installed group folder.
      try {
        for (const f of fs.readdirSync(groupDir)) {
          if (path.parse(f).name === cmd.name) {
            const fp = path.join(groupDir, f);
            fs.unlinkSync(fp);
            log('[Commands] Removed ' + fp);
          }
        }
      } catch (_) {
        if (fs.existsSync(dest)) { fs.unlinkSync(dest); log('[Commands] Removed ' + dest); }
      }
      // best-effort: drop the group folder if it is now empty
      try {
        if (fs.existsSync(groupDir) && fs.readdirSync(groupDir).length === 0) {
          fs.rmdirSync(groupDir);
          log('[Commands] Removed empty group folder ' + groupDir);
        }
      } catch (_) {}
      removed.push(id);
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: true, removed };
}

module.exports = {
  getCommandsRepoDir,
  scanCommands,
  getCommandsState,
  installCommands,
  removeCommands
};
