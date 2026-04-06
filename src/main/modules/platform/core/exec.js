'use strict';

const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const https = require('https');
const http = require('http');

const EXEC_OPTIONS = {
  windowsHide: true,
  env: process.env,
  maxBuffer: 10 * 1024 * 1024
};

function runShellCommand(command, timeoutMs = 15000) {
  return new Promise((resolve) => {
    exec(command, Object.assign({ timeout: timeoutMs }, EXEC_OPTIONS), (error, stdout) => {
      if (error) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// Same as runShellCommand but returns stderr on failure for error reporting
function runShellCommandVerbose(command, timeoutMs = 15000) {
  return new Promise((resolve) => {
    exec(command, Object.assign({ timeout: timeoutMs }, EXEC_OPTIONS), (error, stdout, stderr) => {
      if (error) {
        const msg = (stderr || error.message || '').trim();
        console.error('[exec:FAIL]', command.slice(0, 120), '→', msg.slice(0, 200));
        resolve({ success: false, output: null, error: msg || 'Command failed', command });
      } else {
        resolve({ success: true, output: stdout.trim(), error: null, command });
      }
    });
  });
}

function runCommand(command, timeoutMs = 5000) {
  return runShellCommand(command, timeoutMs);
}

function which(binary) {
  const command = process.platform === 'win32' ? `where ${binary}` : `which ${binary}`;
  return runShellCommand(command, 3000);
}

function getArch() {
  return os.arch();
}

function isLinux() {
  return process.platform === 'linux';
}

function isWindows() {
  return process.platform === 'win32';
}

function downloadFile(url, destPath) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    const request = protocol.get(url, {
      headers: { 'User-Agent': 'AITool/2.0' }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        resolve({ success: false, error: `HTTP ${response.statusCode}` });
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve({ success: true, finalUrl: url });
      });
    });

    request.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch (_) {}
      resolve({ success: false, error: err.message });
    });

    request.setTimeout(120000, () => {
      request.destroy();
      file.close();
      try { fs.unlinkSync(destPath); } catch (_) {}
      resolve({ success: false, error: 'Download timeout' });
    });
  });
}

function checkInternet(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = https.get('https://clients3.google.com/generate_204', {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'AITool/2.0' }
    }, (res) => {
      res.resume(); // drain body to free socket
      resolve(res.statusCode === 204 || res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function claudeCmd(args) {
  return isWindows() ? `cmd /c claude ${args}` : `claude ${args}`;
}

/**
 * Run install steps elevated via a single UAC prompt, with per-step progress.
 * steps: [{id, command}] — each step writes status markers to a temp file.
 * onProgress(status): called with "INSTALLING:id" or "DONE:id" as each step runs.
 * The .bat runs in a hidden CMD window — no visible console.
 */
function runElevatedBatch(steps, onProgress, timeoutMs = 600000) {
  const { execFile } = require('child_process');
  const pathMod = require('path');
  return new Promise((resolve) => {
    const tmpDir = os.tmpdir();
    const ts = Date.now();
    const tmpBat = pathMod.join(tmpDir, `smai-install-${ts}.bat`);
    const statusFile = pathMod.join(tmpDir, `smai-status-${ts}.txt`);

    // Build .bat with per-step status markers
    let batContent = '@echo off\r\n';
    for (const step of steps) {
      batContent += `echo INSTALLING:${step.id} > "${statusFile}"\r\n`;
      batContent += `${step.command}\r\n`;
      batContent += `echo DONE:${step.id} > "${statusFile}"\r\n`;
    }
    batContent += `echo ALLDONE > "${statusFile}"\r\n`;

    try {
      fs.writeFileSync(tmpBat, batContent, 'utf8');
    } catch (err) {
      return resolve({ success: false, error: 'Failed to write install script: ' + err.message });
    }

    // Poll status file for per-step progress updates
    let pollInterval = null;
    let lastStatus = '';
    if (onProgress) {
      pollInterval = setInterval(() => { // 1s is sufficient for UI feedback
        try {
          const status = fs.readFileSync(statusFile, 'utf8').trim();
          if (status && status !== lastStatus) {
            lastStatus = status;
            onProgress(status);
          }
        } catch (_) {}
      }, 1000);
    }

    // Write a .ps1 wrapper to avoid quoting hell with inline -Command
    const tmpPs1 = pathMod.join(tmpDir, `smai-elevate-${ts}.ps1`);
    const ps1Content = `$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c "${tmpBat}"' -Verb RunAs -Wait -WindowStyle Hidden -PassThru\r\nexit $p.ExitCode`;
    try { fs.writeFileSync(tmpPs1, ps1Content, 'utf8'); } catch (_) {}

    const psPath = pathMod.join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'
    );
    const psArgs = [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpPs1
    ];

    execFile(psPath, psArgs, { timeout: timeoutMs, windowsHide: true }, (error) => {
      try { fs.unlinkSync(tmpPs1); } catch (_) {}
      if (pollInterval) clearInterval(pollInterval);

      // Final read before cleanup — catch ALLDONE if last poll missed it
      try {
        const finalStatus = fs.readFileSync(statusFile, 'utf8').trim();
        if (finalStatus && finalStatus !== lastStatus && onProgress) onProgress(finalStatus);
        lastStatus = finalStatus || lastStatus;
      } catch (_) {}

      const allDone = lastStatus.includes('ALLDONE');
      try { fs.unlinkSync(tmpBat); } catch (_) {}
      try { fs.unlinkSync(statusFile); } catch (_) {}

      if (error && !allDone) {
        console.error('[elevated-batch:FAIL]', error.message || error, 'lastStatus:', lastStatus);
        resolve({ success: false, error: 'UAC elevation cancelled or failed: ' + (error.message || '') });
      } else {
        console.log('[elevated-batch:OK] allDone:', allDone, 'steps:', steps.length);
        resolve({ success: true, error: null });
      }
    });
  });
}

module.exports = {
  runCommand,
  runShellCommand,
  runShellCommandVerbose,
  which,
  getArch,
  isLinux,
  isWindows,
  downloadFile,
  claudeCmd,
  runElevatedBatch,
  checkInternet
};
