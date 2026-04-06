'use strict';

const os = require('os');
const path = require('path');

const home = os.homedir();

const SharedPaths = {
  claudeDir: path.join(home, '.claude'),
  skillsDir: path.join(home, '.claude', 'skills'),
  codexDir: path.join(home, '.codex'),
  codexSkillsDir: path.join(home, '.codex', 'skills'),
  settingsJson: path.join(home, '.claude', 'settings.json')
};

module.exports = { SharedPaths };
