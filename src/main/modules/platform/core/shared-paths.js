'use strict';

const os = require('os');
const path = require('path');

const home = os.homedir();

const SharedPaths = {
  claudeDir: path.join(home, '.claude'),
  skillsDir: path.join(home, '.claude', 'skills'),
  codexDir: path.join(home, '.codex'),
  codexSkillsDir: path.join(home, '.codex', 'skills'),
  settingsJson: path.join(home, '.claude', 'settings.json'),
  // Global instruction files the "Global Claude Rules" feature merges rules into.
  claudeRulesFile: path.join(home, '.claude', 'CLAUDE.md'),
  codexRulesFile: path.join(home, '.codex', 'AGENTS.md')
};

module.exports = { SharedPaths };
