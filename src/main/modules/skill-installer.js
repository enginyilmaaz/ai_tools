'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { getPaths } = require('./platform');

function ensureJqInstalled(log) {
  // Check if jq is available
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(cmd, ['jq'], { timeout: 3000, windowsHide: true });
    return; // jq found
  } catch (_) {}

  log('[Hooks] jq not found — installing (required for auto-trigger hooks)...');
  try {
    if (process.platform === 'win32') {
      execFileSync('winget', ['install', '-e', '--id', 'jqlang.jq',
        '--accept-package-agreements', '--accept-source-agreements'],
        { timeout: 60000, windowsHide: true });
    } else {
      execFileSync('sudo', ['apt-get', 'install', '-y', 'jq'],
        { timeout: 30000 });
    }
    log('[Hooks] jq installed successfully');
  } catch (err) {
    log('[Hooks] WARNING: jq install failed — hooks may not work. Install jq manually.');
  }
}

// Minimal command-style hook set. Only skills that are triggered by an
// explicit user directive (commit, analyze, etc.) or a specific identifier
// pattern (ERP-[0-9]+) have a matching auto-trigger hook.
const HOOK_SKILL_MAP = {
  'GEN_HOOK_COMMIT': 'commit',
  'GEN_HOOK_ANALYZE': 'analyze',
  'GEN_HOOK_OPTIMIZE': 'optimize',
  'GEN_HOOK_CODE_REVIEW': 'code-review'
};

// Reverse map: skill name → hook code(s) (array, since a skill can have multiple hooks)
const SKILL_HOOK_MAP = {};
for (const [code, skill] of Object.entries(HOOK_SKILL_MAP)) {
  if (!SKILL_HOOK_MAP[skill]) SKILL_HOOK_MAP[skill] = [];
  SKILL_HOOK_MAP[skill].push(code);
}

function getSkillsDirectory(target) {
  const paths = getPaths();
  return target === 'codex' ? paths.codexSkillsDir : paths.skillsDir;
}

function ensureSkillsDirectoryExists(target) {
  const dir = getSkillsDirectory(target);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getSkillsRepoDir() {
  const candidates = getSkillsRepoCandidates();
  for (const c of candidates) {
    if (isSkillsSourceDirectory(c)) return c;
  }
  return null;
}

function getSkillsRepoCandidates() {
  const seen = new Set();
  const result = [];

  function add(p) {
    if (!p) return;
    try {
      const norm = path.resolve(p).toLowerCase();
      if (seen.has(norm)) return;
      seen.add(norm);
      result.push(path.resolve(p));
    } catch (_) {}
  }

  // Only read from src/assets/skills (bundled submodule; public flat layout).
  const projectRoot = path.join(__dirname, '..', '..', '..');
  add(path.join(projectRoot, 'src', 'assets', 'skills'));
  add(path.join(projectRoot, 'src', 'assets', 'Skills'));

  return result;
}

function isSkillsSourceDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return false;
    const entries = fs.readdirSync(dirPath);
    const foundInRoot = entries.some(e => {
      const sub = path.join(dirPath, e);
      try {
        return fs.statSync(sub).isDirectory() && fs.existsSync(path.join(sub, 'SKILL.md'));
      } catch (_) { return false; }
    });
    if (foundInRoot) return true;

    // Also check general-skills/ subdirectory
    const generalSkillsDir = path.join(dirPath, 'general-skills');
    if (fs.existsSync(generalSkillsDir) && fs.statSync(generalSkillsDir).isDirectory()) {
      const gsEntries = fs.readdirSync(generalSkillsDir);
      return gsEntries.some(e => {
        const sub = path.join(generalSkillsDir, e);
        try {
          return fs.statSync(sub).isDirectory() && fs.existsSync(path.join(sub, 'SKILL.md'));
        } catch (_) { return false; }
      });
    }
    return false;
  } catch (_) {
    return false;
  }
}

function installSkills(repoPath, selectedSkills, target, logFn) {
  const skillsDir = ensureSkillsDirectoryExists(target);
  const results = [];
  const log = logFn || function () {};

  // Backup dir for existing skills
  const backupDir = path.join(os.tmpdir(), 'smai-skills-backup-' + Date.now());

  for (const skill of selectedSkills) {
    // Try root first, then general-skills/
    let src = path.join(repoPath, skill);
    if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
      src = path.join(repoPath, 'general-skills', skill);
    }
    const dest = path.join(skillsDir, skill);

    try {
      if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
        log(`[${skill}] Source not found at ${src}`);
        results.push({ name: skill, success: false, message: 'Source not found' });
        continue;
      }

      // Backup existing skill before overwrite
      if (fs.existsSync(dest)) {
        const backupDest = path.join(backupDir, skill);
        fs.mkdirSync(backupDir, { recursive: true });
        copyDirRecursive(dest, backupDest);
        log(`[${skill}] Backed up existing → ${backupDest}`);
        fs.rmSync(dest, { recursive: true, force: true });
        log(`[${skill}] Deleted existing`);
      }

      copyDirRecursive(src, dest);
      log(`[${skill}] Copied from ${src}`);

      results.push({ name: skill, success: true, message: '' });
    } catch (err) {
      log(`[${skill}] FAILED — ${err.message}`);
      results.push({ name: skill, success: false, message: err.message });
    }
  }

  // Clean up backup if all succeeded
  const allOk = results.every(r => r.success);
  if (allOk && fs.existsSync(backupDir)) {
    try {
      fs.rmSync(backupDir, { recursive: true, force: true });
      log('[Skills] Backup cleaned up (all installed successfully)');
    } catch (_) {}
  } else if (fs.existsSync(backupDir)) {
    log(`[Skills] Backup kept at ${backupDir} (some installs failed)`);
  }

  log('[Skills] Reload: restart Claude Code or run /mcp to apply changes');
  return results;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.writeFileSync(destPath, fs.readFileSync(srcPath));
    }
  }
}

function getSkillsDir(target) {
  return getSkillsDirectory(target);
}

// Load full hook entries (code → entry) from the bundled hooks.json files.
function loadHookEntriesByCode() {
  const repoDir = getSkillsRepoDir();
  const byCode = {};
  if (!repoDir) return byCode;
  const hookFiles = [
    path.join(repoDir, 'hooks.json'),
    path.join(repoDir, 'general-skills', 'hooks.json')
  ];
  for (const hooksJsonPath of hookFiles) {
    if (!fs.existsSync(hooksJsonPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
      for (const entry of (data.UserPromptSubmit || [])) {
        if (entry && entry.code) byCode[entry.code] = entry;
      }
    } catch (_) {}
  }
  return byCode;
}

function installHooksForSkills(skillNames, logFn) {
  const log = logFn || function () {};
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const entriesByCode = loadHookEntriesByCode();

  // Nothing to install for these skills → skip (don't even touch settings.json).
  const codesToInstall = [];
  for (const skillName of skillNames) {
    const codes = SKILL_HOOK_MAP[skillName];
    if (codes) for (const c of codes) if (entriesByCode[c]) codesToInstall.push({ code: c, skill: skillName });
  }
  if (codesToInstall.length === 0) return;

  ensureJqInstalled(log);

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
    catch (err) { log(`[Hooks] Failed to parse settings.json: ${err.message}`); return; }
  }
  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};
  if (!Array.isArray(settings.hooks.UserPromptSubmit)) settings.hooks.UserPromptSubmit = [];

  const canonByCode = loadCanonicalCommandsByCode();

  for (const { code, skill } of codesToInstall) {
    const source = entriesByCode[code];
    // Upsert: remove by code OR by canonical command text, then append fresh entry.
    const canonicalCmd = canonByCode[code];
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(h =>
      h.code !== code && !hookCommandMatches(h, canonicalCmd)
    );
    const fresh = JSON.parse(JSON.stringify(source));
    fresh.code = code;
    settings.hooks.UserPromptSubmit.push(fresh);
    log(`[Hooks] Installed ${code} for skill ${skill}`);
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  log('[Hooks] settings.json updated');
}

function installCodexHooksForSkills(skillNames, logFn) {
  const log = logFn || function () {};
  const codexHooksPath = path.join(os.homedir(), '.codex', 'hooks.json');
  const entriesByCode = loadHookEntriesByCode();

  const codesToInstall = [];
  for (const skillName of skillNames) {
    const codes = SKILL_HOOK_MAP[skillName];
    if (codes) for (const c of codes) if (entriesByCode[c]) codesToInstall.push({ code: c, skill: skillName });
  }
  if (codesToInstall.length === 0) return;

  ensureJqInstalled(log);

  let codexConfig = {};
  if (fs.existsSync(codexHooksPath)) {
    try { codexConfig = JSON.parse(fs.readFileSync(codexHooksPath, 'utf8')); }
    catch (err) { log(`[CodexHooks] Failed to parse hooks.json: ${err.message}`); return; }
  }
  if (!codexConfig.hooks || typeof codexConfig.hooks !== 'object') codexConfig.hooks = {};
  if (!Array.isArray(codexConfig.hooks.UserPromptSubmit)) codexConfig.hooks.UserPromptSubmit = [];

  const canonByCode = loadCanonicalCommandsByCode();

  for (const { code, skill } of codesToInstall) {
    const source = entriesByCode[code];
    const canonicalCmd = canonByCode[code];
    codexConfig.hooks.UserPromptSubmit = codexConfig.hooks.UserPromptSubmit.filter(h =>
      h.code !== code && !hookCommandMatches(h, canonicalCmd)
    );
    const innerHook = source && source.hooks && source.hooks[0];
    if (!innerHook) continue;
    codexConfig.hooks.UserPromptSubmit.push({ code, hooks: [JSON.parse(JSON.stringify(innerHook))] });
    log(`[CodexHooks] Installed ${code} for skill ${skill}`);
  }

  const codexDir = path.dirname(codexHooksPath);
  fs.mkdirSync(codexDir, { recursive: true });
  fs.writeFileSync(codexHooksPath, JSON.stringify(codexConfig, null, 2), 'utf8');
  log('[CodexHooks] hooks.json updated');
}

// Load canonical command strings per hook code from the bundled hooks.json
// files. Older installs wrote hooks without a `code` property, so we must
// fall back to matching by command text to clean them up.
function loadCanonicalCommandsByCode() {
  const repoDir = getSkillsRepoDir();
  const byCode = {};
  if (!repoDir) return byCode;
  const hookFiles = [
    path.join(repoDir, 'hooks.json'),
    path.join(repoDir, 'general-skills', 'hooks.json')
  ];
  for (const hooksJsonPath of hookFiles) {
    if (!fs.existsSync(hooksJsonPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
      for (const entry of (data.UserPromptSubmit || [])) {
        const code = entry.code;
        const cmd = entry && entry.hooks && entry.hooks[0] && entry.hooks[0].command;
        if (code && cmd) byCode[code] = cmd;
      }
    } catch (_) {}
  }
  return byCode;
}

function hookCommandMatches(hookEntry, canonicalCmd) {
  const cmd = hookEntry && hookEntry.hooks && hookEntry.hooks[0] && hookEntry.hooks[0].command;
  if (!cmd || !canonicalCmd) return false;
  // Normalize the known jq bug-fix drift: `else {} end` vs `else empty end`.
  const norm = s => s.replace(/else\s+\{\}\s+end/g, 'else empty end');
  return norm(cmd) === norm(canonicalCmd);
}

function removeHooksForSkills(skillNames, logFn) {
  const log = logFn || function () {};
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

  if (!fs.existsSync(settingsPath)) {
    log('[Hooks] settings.json not found, nothing to remove');
    return;
  }

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    log(`[Hooks] Failed to parse settings.json: ${err.message}`);
    return;
  }

  if (!settings.hooks || !Array.isArray(settings.hooks.UserPromptSubmit)) {
    log('[Hooks] No UserPromptSubmit hooks found');
    return;
  }

  const canonByCode = loadCanonicalCommandsByCode();

  for (const skillName of skillNames) {
    const hookCodes = SKILL_HOOK_MAP[skillName];
    if (!hookCodes) continue;

    for (const hookCode of hookCodes) {
      const canonicalCmd = canonByCode[hookCode];
      const before = settings.hooks.UserPromptSubmit.length;
      settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(h =>
        h.code !== hookCode && !hookCommandMatches(h, canonicalCmd)
      );
      if (settings.hooks.UserPromptSubmit.length < before) {
        log(`[Hooks] Removed ${hookCode} for skill ${skillName}`);
      }
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  log('[Hooks] settings.json updated');
}

function removeCodexHooksForSkills(skillNames, logFn) {
  const log = logFn || function () {};
  const codexHooksPath = path.join(os.homedir(), '.codex', 'hooks.json');

  if (!fs.existsSync(codexHooksPath)) {
    log('[CodexHooks] hooks.json not found, nothing to remove');
    return;
  }

  let codexConfig;
  try {
    codexConfig = JSON.parse(fs.readFileSync(codexHooksPath, 'utf8'));
  } catch (err) {
    log(`[CodexHooks] Failed to parse hooks.json: ${err.message}`);
    return;
  }

  if (!codexConfig.hooks || !Array.isArray(codexConfig.hooks.UserPromptSubmit)) {
    log('[CodexHooks] No UserPromptSubmit hooks found');
    return;
  }

  const canonByCode = loadCanonicalCommandsByCode();

  for (const skillName of skillNames) {
    const hookCodes = SKILL_HOOK_MAP[skillName];
    if (!hookCodes) continue;

    for (const hookCode of hookCodes) {
      const canonicalCmd = canonByCode[hookCode];
      const before = codexConfig.hooks.UserPromptSubmit.length;
      codexConfig.hooks.UserPromptSubmit = codexConfig.hooks.UserPromptSubmit.filter(h =>
        h.code !== hookCode && !hookCommandMatches(h, canonicalCmd)
      );
      if (codexConfig.hooks.UserPromptSubmit.length < before) {
        log(`[CodexHooks] Removed ${hookCode} for skill ${skillName}`);
      }
    }
  }

  fs.writeFileSync(codexHooksPath, JSON.stringify(codexConfig, null, 2), 'utf8');
  log('[CodexHooks] hooks.json updated');
}

function removeSkills(skillNames, target, logFn) {
  const log = logFn || function () {};
  const skillsDir = getSkillsDirectory(target);
  const results = [];

  for (const skill of skillNames) {
    const dest = path.join(skillsDir, skill);
    try {
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
        log(`[${skill}] Removed from ${dest}`);
        results.push({ name: skill, success: true, message: '' });
      } else {
        log(`[${skill}] Not found in ${skillsDir}, skipping`);
        results.push({ name: skill, success: true, message: 'Not installed' });
      }
    } catch (err) {
      log(`[${skill}] FAILED — ${err.message}`);
      results.push({ name: skill, success: false, message: err.message });
    }
  }

  if (target === 'codex') {
    removeCodexHooksForSkills(skillNames, logFn);
  } else {
    removeHooksForSkills(skillNames, logFn);
  }
  log('[Skills] Reload: restart Claude Code or run /mcp to apply changes');
  return results;
}

module.exports = {
  getSkillsDirectory,
  ensureSkillsDirectoryExists,
  getSkillsRepoDir,
  getSkillsRepoCandidates,
  isSkillsSourceDirectory,
  installSkills,
  getSkillsDir,
  installHooksForSkills,
  installCodexHooksForSkills,
  removeHooksForSkills,
  removeCodexHooksForSkills,
  removeSkills
};
