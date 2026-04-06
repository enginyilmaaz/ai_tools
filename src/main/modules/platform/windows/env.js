'use strict';

const { execSync } = require('child_process');

function refreshPath() {
  try {
    const machinePath = execSync(
      'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path',
      { encoding: 'utf8' }
    );
    const userPath = execSync('reg query "HKCU\\Environment" /v Path', { encoding: 'utf8' });

    const extract = (regOutput) => {
      const match = regOutput.match(/REG_(?:EXPAND_)?SZ\s+(.*)/);
      return match ? match[1].trim() : '';
    };

    const merged = extract(machinePath) + ';' + extract(userPath);
    if (merged.length > 2) {
      process.env.PATH = merged;
    }
  } catch (_) {}
}

module.exports = { refreshPath };
