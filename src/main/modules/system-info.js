'use strict';

const os = require('os');
const { execFile } = require('child_process');

function shortCpuName(model) {
  if (!model) return 'Unknown';
  // "Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz" → "Intel i7-10750H @ 2.60GHz"
  // "AMD Ryzen 9 5900X 12-Core Processor" → "AMD Ryzen 9 5900X"
  return model
    .replace(/\(R\)/gi, '')
    .replace(/\(TM\)/gi, '')
    .replace(/\s+CPU\s+/i, ' ')
    .replace(/\s+Processor/i, '')
    .replace(/\d+-Core\s*/i, '')
    .replace(/Core\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function runAsync(command, args, timeout) {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: 'utf8', timeout: timeout || 5000 }, (err, stdout) => {
      resolve(err ? '' : (stdout || '').trim());
    });
  });
}

async function getAsync() {
  const [osDesc, disk, boot] = await Promise.all([
    getOsDescriptionAsync(),
    getDiskInfoAsync(),
    Promise.resolve(getBootTime())
  ]);

  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();

  return {
    os: osDesc,
    arch: os.arch(),
    cpuName: shortCpuName(cpus[0]?.model),
    cpuCores: cpus.length,
    totalRamGB: (totalMem / (1024 * 1024 * 1024)).toFixed(1),
    usedRamGB: (usedMem / (1024 * 1024 * 1024)).toFixed(1),
    ramPercent: Math.round((usedMem / totalMem) * 100),
    ...disk,
    bootTime: boot
  };
}

// Synchronous version kept for backward compatibility
function get() {
  const { execSync } = require('child_process');

  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();

  return {
    os: getOsDescriptionSync(execSync),
    arch: os.arch(),
    cpuName: shortCpuName(cpus[0]?.model),
    cpuCores: cpus.length,
    totalRamGB: (totalMem / (1024 * 1024 * 1024)).toFixed(1),
    usedRamGB: (usedMem / (1024 * 1024 * 1024)).toFixed(1),
    ramPercent: Math.round((usedMem / totalMem) * 100),
    ...getDiskInfoSync(execSync),
    bootTime: getBootTime()
  };
}

async function getOsDescriptionAsync() {
  if (process.platform === 'win32') {
    return os.version ? `${os.version()} (${os.release()})` : `Windows ${os.release()}`;
  }
  // Using execFile with sh -c to avoid shell injection — all args are static strings
  const out = await runAsync('sh', ['-c', "lsb_release -d -s 2>/dev/null || cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'\"' -f2 || echo 'Linux'"]);
  return out || `Linux ${os.release()}`;
}

function getOsDescriptionSync(execSync) {
  if (process.platform === 'win32') {
    return os.version ? `${os.version()} (${os.release()})` : `Windows ${os.release()}`;
  }
  try {
    const name = execSync("lsb_release -d -s 2>/dev/null || cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'\"' -f2 || echo 'Linux'", { encoding: 'utf8' }).trim();
    return name || `Linux ${os.release()}`;
  } catch (_) {
    return `Linux ${os.release()}`;
  }
}

async function getDiskInfoAsync() {
  try {
    if (process.platform === 'win32') {
      return await getWindowsDiskInfo();
    } else {
      const out = await runAsync('df', ['-B1', '/']);
      const lines = out.split('\n');
      const parts = (lines[1] || '').split(/\s+/);
      const total = parseInt(parts[1]) || 0;
      const used = parseInt(parts[2]) || 0;
      const free = parseInt(parts[3]) || 0;
      return {
        diskTotal: (total / (1024 * 1024 * 1024)).toFixed(0),
        diskFree: (free / (1024 * 1024 * 1024)).toFixed(0),
        diskPercent: total > 0 ? Math.round((used / total) * 100) : 0
      };
    }
  } catch (_) {
    return { diskTotal: '0', diskFree: '0', diskPercent: 0 };
  }
}

async function getWindowsDiskInfo() {
  // Use Node.js fs.statfs (available since Node 18.15) — no external commands needed
  const fsPromises = require('fs').promises;
  try {
    const stats = await fsPromises.statfs('C:\\');
    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bfree;
    return {
      diskTotal: (total / (1024 * 1024 * 1024)).toFixed(0),
      diskFree: (free / (1024 * 1024 * 1024)).toFixed(0),
      diskPercent: total > 0 ? Math.round(((total - free) / total) * 100) : 0
    };
  } catch (_) {
    return { diskTotal: '0', diskFree: '0', diskPercent: 0 };
  }
}

function getDiskInfoSync(execSyncFn) {
  try {
    if (process.platform === 'win32') {
      const stats = require('fs').statfsSync('C:\\');
      const total = stats.bsize * stats.blocks;
      const free = stats.bsize * stats.bfree;
      return {
        diskTotal: (total / (1024 * 1024 * 1024)).toFixed(0),
        diskFree: (free / (1024 * 1024 * 1024)).toFixed(0),
        diskPercent: total > 0 ? Math.round(((total - free) / total) * 100) : 0
      };
    } else {
      const out = execSyncFn("df -B1 / | tail -1", { encoding: 'utf8', timeout: 5000 });
      const parts = out.trim().split(/\s+/);
      const total = parseInt(parts[1]) || 0;
      const used = parseInt(parts[2]) || 0;
      const free = parseInt(parts[3]) || 0;
      return {
        diskTotal: (total / (1024 * 1024 * 1024)).toFixed(0),
        diskFree: (free / (1024 * 1024 * 1024)).toFixed(0),
        diskPercent: total > 0 ? Math.round((used / total) * 100) : 0
      };
    }
  } catch (_) {
    return { diskTotal: '0', diskFree: '0', diskPercent: 0 };
  }
}

function getBootTime() {
  const uptimeSec = os.uptime();
  const bootDate = new Date(Date.now() - uptimeSec * 1000);
  const y = bootDate.getFullYear();
  const m = String(bootDate.getMonth() + 1).padStart(2, '0');
  const d = String(bootDate.getDate()).padStart(2, '0');
  const h = String(bootDate.getHours()).padStart(2, '0');
  const min = String(bootDate.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

module.exports = { get, getAsync };
