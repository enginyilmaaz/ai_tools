'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getPaths } = require('./platform');

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

  // 1. Bundled (production) — inside asar
  const appRoot = path.join(__dirname, '..', '..');
  add(path.join(appRoot, 'skills'));
  add(path.join(appRoot, 'Skills'));

  // 2. Dev — relative to project root
  const projectRoot = path.join(__dirname, '..', '..', '..');
  add(path.join(projectRoot, 'src', 'skills'));
  add(path.join(projectRoot, 'src', 'Skills'));

  // 3. Parent directories
  add(path.join(projectRoot, '..', 'claude-skills'));
  add(path.join(projectRoot, '..', '.claude', 'skills'));

  // 4. User locations
  const home = os.homedir();
  add(path.join(home, '.claude', 'skills'));
  add(path.join(home, 'claude-skills'));
  add(path.join(home, 'Documents', 'claude-skills'));
  add(path.join(home, 'Desktop', 'claude-skills'));

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

function installHooksForSkills(skillNames, repoPath, logFn) {
  const log = logFn || function () {};

  // Load all available hooks from both root and general-skills hooks.json
  const allHooks = [];
  const hookFiles = [
    path.join(repoPath, 'hooks.json'),
    path.join(repoPath, 'general-skills', 'hooks.json')
  ];
  for (const hooksJsonPath of hookFiles) {
    if (!fs.existsSync(hooksJsonPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
      if (Array.isArray(data.UserPromptSubmit)) {
        allHooks.push(...data.UserPromptSubmit);
      }
      log(`[Hooks] Loaded ${(data.UserPromptSubmit || []).length} hooks from ${hooksJsonPath}`);
    } catch (err) {
      log(`[Hooks] Failed to parse ${hooksJsonPath}: ${err.message}`);
    }
  }

  if (allHooks.length === 0) {
    log('[Hooks] No hooks found, skipping');
    return;
  }

  // Build code → hook entry lookup
  const hooksByCode = {};
  for (const h of allHooks) {
    if (h.code) hooksByCode[h.code] = h;
  }

  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (_) {
      settings = {};
    }
  }

  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.UserPromptSubmit)) settings.hooks.UserPromptSubmit = [];

  let added = 0;
  for (const skillName of skillNames) {
    const hookCodes = SKILL_HOOK_MAP[skillName];
    if (!hookCodes) continue;

    for (const hookCode of hookCodes) {
      const hookEntry = hooksByCode[hookCode];
      if (!hookEntry) continue;

      const alreadyExists = settings.hooks.UserPromptSubmit.some(h => h.code === hookCode);
      if (alreadyExists) {
        log(`[Hooks] ${hookCode} already exists, skipping`);
        continue;
      }

      settings.hooks.UserPromptSubmit.push(hookEntry);
      log(`[Hooks] Added ${hookCode} for skill ${skillName}`);
      added++;
    }
  }

  if (added > 0) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    log(`[Hooks] settings.json updated (${added} hooks added)`);
  }
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

function installCodexHooksForSkills(skillNames, repoPath, logFn) {
  const log = logFn || function () {};

  // Load all available hooks from both root and general-skills hooks.json
  const allHooks = [];
  const hookFiles = [
    path.join(repoPath, 'hooks.json'),
    path.join(repoPath, 'general-skills', 'hooks.json')
  ];
  for (const hooksJsonPath of hookFiles) {
    if (!fs.existsSync(hooksJsonPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
      if (Array.isArray(data.UserPromptSubmit)) {
        allHooks.push(...data.UserPromptSubmit);
      }
      log(`[CodexHooks] Loaded ${(data.UserPromptSubmit || []).length} hooks from ${hooksJsonPath}`);
    } catch (err) {
      log(`[CodexHooks] Failed to parse ${hooksJsonPath}: ${err.message}`);
    }
  }

  if (allHooks.length === 0) {
    log('[CodexHooks] No hooks found, skipping');
    return;
  }

  // Build code → hook entry lookup
  const hooksByCode = {};
  for (const h of allHooks) {
    if (h.code) hooksByCode[h.code] = h;
  }

  const codexHooksPath = path.join(os.homedir(), '.codex', 'hooks.json');
  let codexConfig = { hooks: { UserPromptSubmit: [] } };
  if (fs.existsSync(codexHooksPath)) {
    try {
      codexConfig = JSON.parse(fs.readFileSync(codexHooksPath, 'utf8'));
    } catch (_) {
      codexConfig = { hooks: { UserPromptSubmit: [] } };
    }
  }

  if (!codexConfig.hooks) codexConfig.hooks = {};
  if (!Array.isArray(codexConfig.hooks.UserPromptSubmit)) codexConfig.hooks.UserPromptSubmit = [];

  let added = 0;
  for (const skillName of skillNames) {
    const hookCodes = SKILL_HOOK_MAP[skillName];
    if (!hookCodes) continue;

    for (const hookCode of hookCodes) {
      const hookEntry = hooksByCode[hookCode];
      if (!hookEntry || !hookEntry.hooks || !hookEntry.hooks[0]) continue;

      // Check if hook already exists by searching for the skill name in the jq command
      const alreadyExists = codexConfig.hooks.UserPromptSubmit.some(h => {
        if (!h.hooks || !h.hooks[0]) return false;
        const cmd = h.hooks[0].command || '';
        return cmd.includes(skillName);
      });
      if (alreadyExists) {
        log(`[CodexHooks] ${hookCode} already exists for ${skillName}, skipping`);
        continue;
      }

      // Transform to Codex format: change "invoke the X skill using the Skill tool" to "Use the X skill"
      const sourceHook = JSON.parse(JSON.stringify(hookEntry.hooks[0]));
      if (sourceHook.command) {
        sourceHook.command = sourceHook.command.replace(
          /You MUST invoke the (\S+) skill using the Skill tool BEFORE doing anything else\./g,
          'Use the $1 skill before doing anything else.'
        );
      }

      const codexHookEntry = {
        hooks: [sourceHook]
      };

      codexConfig.hooks.UserPromptSubmit.push(codexHookEntry);
      log(`[CodexHooks] Added ${hookCode} for skill ${skillName}`);
      added++;
    }
  }

  if (added > 0) {
    fs.mkdirSync(path.dirname(codexHooksPath), { recursive: true });
    fs.writeFileSync(codexHooksPath, JSON.stringify(codexConfig, null, 2), 'utf8');
    log(`[CodexHooks] hooks.json updated (${added} hooks added)`);
  }
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
    const before = codexConfig.hooks.UserPromptSubmit.length;
    codexConfig.hooks.UserPromptSubmit = codexConfig.hooks.UserPromptSubmit.filter(h => {
      if (!h.hooks || !h.hooks[0]) return true;
      const cmd = h.hooks[0].command || '';
      return !cmd.includes(skillName);
    });
    if (codexConfig.hooks.UserPromptSubmit.length < before) {
      log(`[CodexHooks] Removed hooks for skill ${skillName}`);
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
  installHooksForSkills,
  removeHooksForSkills,
  installCodexHooksForSkills,
  removeCodexHooksForSkills,
  removeSkills
};
