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

const HOOK_SKILL_MAP = {
  'GEN_HOOK_COMMIT': 'commit',
  'GEN_HOOK_PLAYWRIGHT': 'playwright',
  'GEN_HOOK_ANALYZE': 'analyze',
  'GEN_HOOK_OPTIMIZE': 'optimize',
  'GEN_HOOK_CODE_REVIEW': 'code-review',
  'GEN_HOOK_SCAFFOLD_FULLSTACK': 'fullstack-scaffold',
  'GEN_HOOK_SCAFFOLD_BACKEND': 'nodejs-backend-scaffold',
  'GEN_HOOK_SCAFFOLD_FRONTEND': 'nextjs-frontend-scaffold',
  'GEN_HOOK_JIRA_API': 'jira-api'
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

  // Only read from src/skills (bundled submodule). No external fallbacks.
  const projectRoot = path.join(__dirname, '..', '..', '..');
  add(path.join(projectRoot, 'src', 'skills'));
  add(path.join(projectRoot, 'src', 'Skills'));

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

  for (const skillName of skillNames) {
    const hookCodes = SKILL_HOOK_MAP[skillName];
    if (!hookCodes) continue;

    for (const hookCode of hookCodes) {
      const before = settings.hooks.UserPromptSubmit.length;
      settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(h => h.code !== hookCode);
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

  for (const skillName of skillNames) {
    const hookCodes = SKILL_HOOK_MAP[skillName];
    if (!hookCodes) continue;

    for (const hookCode of hookCodes) {
      const before = codexConfig.hooks.UserPromptSubmit.length;
      codexConfig.hooks.UserPromptSubmit = codexConfig.hooks.UserPromptSubmit.filter(h => h.code !== hookCode);
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

  for (const skill of skillNames) {
    const dest = path.join(skillsDir, skill);
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
      log(`[${skill}] Removed from ${dest}`);
    } else {
      log(`[${skill}] Not found in ${skillsDir}, skipping`);
    }
  }

  if (target === 'codex') {
    removeCodexHooksForSkills(skillNames, logFn);
  } else {
    removeHooksForSkills(skillNames, logFn);
  }
  log('[Skills] Reload: restart Claude Code or run /mcp to apply changes');
}

module.exports = {
  getSkillsDirectory,
  ensureSkillsDirectoryExists,
  getSkillsRepoDir,
  getSkillsRepoCandidates,
  isSkillsSourceDirectory,
  installSkills,
  getSkillsDir,
  removeHooksForSkills,
  removeCodexHooksForSkills,
  removeSkills
};
