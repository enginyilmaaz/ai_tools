'use strict';

// Global Claude/Codex rules installer.
//
// Unlike skills (which are copied folders), a "rule" is one `## Heading` section
// that gets merged into the user's global instruction file — `~/.claude/CLAUDE.md`
// for Claude, `~/.codex/AGENTS.md` for Codex. Installing a rule inserts/replaces
// its section idempotently (by heading); removing strips that section. Everything
// else in the file — hand-written content and other rules — is preserved.
//
// Source of truth is the bundled `src/rules` submodule (the ai_rules repo):
//   manifest.json    → the catalog (id, icon, order, localized name/description)
//   preamble.md      → the `# Global Preferences` header, ensured at the top
//   rules/<id>.md    → the rule body (a single `## Heading` section)

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getPaths } = require('./platform');

// ----- source (bundled submodule) resolution -------------------------------

function getRulesRepoCandidates() {
  const projectRoot = path.join(__dirname, '..', '..', '..');
  return [
    path.join(projectRoot, 'src', 'rules'),
    path.join(projectRoot, 'src', 'Rules')
  ];
}

function isRulesSourceDirectory(dirPath) {
  try {
    return fs.existsSync(dirPath)
      && fs.statSync(dirPath).isDirectory()
      && fs.existsSync(path.join(dirPath, 'manifest.json'));
  } catch (_) {
    return false;
  }
}

function getRulesRepoDir() {
  for (const c of getRulesRepoCandidates()) {
    if (isRulesSourceDirectory(c)) return path.resolve(c);
  }
  return null;
}

// Read + validate manifest.json. Returns { preamble, rules: [...] } or null.
function readManifest(repoDir) {
  const dir = repoDir || getRulesRepoDir();
  if (!dir) return null;
  try {
    const raw = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8');
    const m = JSON.parse(raw);
    if (!m || !Array.isArray(m.rules)) return null;
    m.rules.sort((a, b) => (a.order || 0) - (b.order || 0));
    return m;
  } catch (_) {
    return null;
  }
}

function readPreamble(repoDir) {
  const dir = repoDir || getRulesRepoDir();
  if (!dir) return '';
  const m = readManifest(dir);
  const rel = (m && m.preamble) || 'preamble.md';
  try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch (_) { return ''; }
}

// The rule body markdown for one id (a single `## Heading` section).
function readRuleBody(repoDir, rule) {
  const dir = repoDir || getRulesRepoDir();
  if (!dir || !rule) return '';
  const rel = rule.file || path.join('rules', rule.id + '.md');
  try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch (_) { return ''; }
}

// ----- target files --------------------------------------------------------

function getTargetFile(target) {
  const p = getPaths();
  return target === 'codex' ? p.codexRulesFile : p.claudeRulesFile;
}

function readTarget(target) {
  const file = getTargetFile(target);
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; }
}

// ----- section-merge engine (pure string transforms) -----------------------

// The heading text of a rule body, e.g. "## Language" → "Language".
function headingOf(markdown) {
  const m = /(?:^|\n)##\s+(.+?)\s*(?:\n|$)/.exec(markdown || '');
  return m ? m[1].trim() : null;
}

// Split text into a preamble (everything before the first `## `) and a list of
// level-2 sections { heading, body } where body includes the `## …` line.
function splitSections(text) {
  const lines = String(text == null ? '' : text).split('\n');
  const head = [];
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      cur = { heading: m[1].trim(), lines: [line] };
      sections.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    } else {
      head.push(line);
    }
  }
  return { head: head.join('\n'), sections };
}

// Reassemble, normalizing to a single blank line between blocks + trailing newline.
function joinSections(head, sections) {
  const blocks = [];
  const h = head.replace(/\s+$/, '');
  if (h.trim()) blocks.push(h);
  for (const s of sections) {
    const body = s.lines.join('\n').replace(/\s+$/, '');
    if (body.trim()) blocks.push(body);
  }
  return blocks.join('\n\n') + '\n';
}

// Insert/replace one rule's section into targetText (idempotent by heading).
function mergeRule(targetText, ruleBody, preamble) {
  const heading = headingOf(ruleBody);
  if (!heading) throw new Error('Rule has no "## Heading"');
  let text = targetText;
  if (!text.trim()) text = (preamble || '').trim(); // fresh file → seed with preamble
  const { head, sections } = splitSections(text);
  const block = ruleBody.replace(/^\s*\n/, '').replace(/\s+$/, '');
  const next = { heading, lines: block.split('\n') };
  const idx = sections.findIndex(s => s.heading === heading);
  if (idx >= 0) sections[idx] = next; else sections.push(next);
  return joinSections(head, sections);
}

// Remove the section with the given heading (if present).
function stripHeading(targetText, heading) {
  const { head, sections } = splitSections(targetText);
  const kept = sections.filter(s => s.heading !== heading);
  return joinSections(head, kept);
}

// ----- public operations ---------------------------------------------------

// Which rule ids are currently present (by heading) in the target file.
function getRulesState(target) {
  const repoDir = getRulesRepoDir();
  const manifest = readManifest(repoDir);
  const state = {};
  if (!manifest) return state;
  const present = new Set(splitSections(readTarget(target)).sections.map(s => s.heading));
  for (const rule of manifest.rules) {
    const heading = headingOf(readRuleBody(repoDir, rule));
    state[rule.id] = !!heading && present.has(heading);
  }
  return state;
}

function backupTarget(target, log) {
  const file = getTargetFile(target);
  if (!fs.existsSync(file)) return;
  try {
    const backup = path.join(os.tmpdir(), 'smai-rules-backup-' + target + '-' + Date.now() + '.md');
    fs.copyFileSync(file, backup);
    if (log) log('[Rules] Backed up ' + file + ' → ' + backup);
  } catch (_) { /* best-effort */ }
}

function writeTarget(target, text, log) {
  const file = getTargetFile(target);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  if (log) log('[Rules] Wrote ' + file);
}

// Install (merge) the given rule ids into the target file.
function installRules(ids, target, logFn) {
  const log = logFn || function () {};
  const repoDir = getRulesRepoDir();
  if (!repoDir) return { ok: false, error: 'Rules source not found (src/rules)' };
  const manifest = readManifest(repoDir);
  if (!manifest) return { ok: false, error: 'Invalid or missing manifest.json' };
  const byId = new Map(manifest.rules.map(r => [r.id, r]));
  const preamble = readPreamble(repoDir);

  backupTarget(target, log);
  let text = readTarget(target);
  const applied = [];
  for (const id of ids || []) {
    const rule = byId.get(id);
    if (!rule) { log('[Rules] Unknown rule: ' + id); continue; }
    const body = readRuleBody(repoDir, rule);
    if (!body || !headingOf(body)) { log('[Rules] Skipped ' + id + ' (empty/no heading)'); continue; }
    text = mergeRule(text, body, preamble);
    applied.push(id);
    log('[Rules] Merged "' + headingOf(body) + '" into ' + target);
  }
  writeTarget(target, text, log);
  return { ok: true, target, applied };
}

// Remove the given rule ids' sections from the target file.
function removeRules(ids, target, logFn) {
  const log = logFn || function () {};
  const repoDir = getRulesRepoDir();
  if (!repoDir) return { ok: false, error: 'Rules source not found (src/rules)' };
  const manifest = readManifest(repoDir);
  if (!manifest) return { ok: false, error: 'Invalid or missing manifest.json' };
  const byId = new Map(manifest.rules.map(r => [r.id, r]));

  const file = getTargetFile(target);
  if (!fs.existsSync(file)) return { ok: true, target, removed: [] };
  backupTarget(target, log);
  let text = readTarget(target);
  const removed = [];
  for (const id of ids || []) {
    const rule = byId.get(id);
    if (!rule) continue;
    const heading = headingOf(readRuleBody(repoDir, rule));
    if (!heading) continue;
    text = stripHeading(text, heading);
    removed.push(id);
    log('[Rules] Removed "' + heading + '" from ' + target);
  }
  writeTarget(target, text, log);
  return { ok: true, target, removed };
}

module.exports = {
  getRulesRepoDir,
  readManifest,
  getRulesState,
  installRules,
  removeRules,
  // exported for tests
  _internal: { headingOf, splitSections, joinSections, mergeRule, stripHeading }
};
