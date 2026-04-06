'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function refreshPath() {
  const home = os.homedir();
  const additions = [];
  const nvmDir = path.join(home, '.nvm', 'versions', 'node');

  if (fs.existsSync(nvmDir)) {
    try {
      const versions = fs.readdirSync(nvmDir).sort().reverse();
      if (versions.length > 0) {
        additions.push(path.join(nvmDir, versions[0], 'bin'));
      }
    } catch (_) {}
  }

  additions.push(path.join(home, '.local', 'bin'));

  if (additions.length > 0) {
    const currentPath = process.env.PATH || '';
    const newParts = additions.filter((entry) => !currentPath.includes(entry));
    if (newParts.length > 0) {
      process.env.PATH = newParts.join(path.delimiter) + path.delimiter + currentPath;
    }
  }
}

module.exports = { refreshPath };
