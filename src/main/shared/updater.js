'use strict';

/**
 * updater.js
 *
 * Checks GitHub Releases for a newer version of AI Tool and, on Linux,
 * installs the .deb via `sudo -S apt-get install` using a sudo password the
 * user enters at runtime (never stored). The repo is PUBLIC, so the GitHub
 * API and asset downloads work unauthenticated; a locally authenticated gh
 * token is used only opportunistically to raise the rate limit.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { app } = require('electron');

const REPO = 'enginyilmaaz/ai_tools';
const API = `https://api.github.com/repos/${REPO}`;

function parseVersion(v) {
  return String(v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
}

function isNewer(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// Optional gh token, only to raise the unauthenticated rate limit. Never required.
function ghToken() {
  try {
    const home = os.homedir();
    const PATH = [process.env.PATH || '', '/usr/local/bin', '/usr/bin', '/bin', '/snap/bin', path.join(home, '.local', 'bin'), '/opt/homebrew/bin'].filter(Boolean).join(path.delimiter);
    const out = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', timeout: 5000, env: { ...process.env, PATH } }).trim();
    if (/^gh[a-z]_|^github_pat_/.test(out)) return out;
  } catch (_) {}
  return null;
}

function authHeaders() {
  const h = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'ai-tool-updater' };
  const t = ghToken();
  if (t) h.Authorization = `token ${t}`;
  return h;
}

function pickAsset(assets) {
  if (process.platform === 'linux') return assets.find(a => /linux-deb\.deb$/.test(a.name));
  if (process.platform === 'win32') return assets.find(a => /windows\.exe$/.test(a.name));
  return null;
}

async function checkForUpdate() {
  const current = app.getVersion();
  try {
    const res = await fetch(`${API}/releases/latest`, { headers: authHeaders() });
    if (!res.ok) return { available: false, reason: `http-${res.status}` };
    const data = await res.json();
    const latest = (data.tag_name || '').replace(/^v/, '');
    if (!latest) return { available: false, reason: 'no-tag' };
    const asset = pickAsset(data.assets || []);
    const available = isNewer(latest, current) && !!asset;
    return {
      available,
      current,
      latest,
      reason: available ? null : (!asset ? 'no-asset' : 'up-to-date'),
      assetUrl: asset ? asset.browser_download_url : null,
      assetName: asset ? asset.name : null,
      releaseUrl: data.html_url || `https://github.com/${REPO}/releases/latest`,
      installable: process.platform === 'linux'
    };
  } catch (err) {
    return { available: false, reason: err.message };
  }
}

// Public-repo asset: download straight from browser_download_url (no auth).
async function downloadAsset(assetUrl, assetName, onProgress) {
  if (!assetUrl) throw new Error('No asset URL');
  const res = await fetch(assetUrl, { headers: { 'User-Agent': 'ai-tool-updater' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);

  const total = parseInt(res.headers.get('content-length') || '0', 10);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tool-update-'));
  const dest = path.join(dir, assetName || 'update.deb');

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (onProgress) onProgress(received, total);
    }
    fs.writeFileSync(dest, Buffer.concat(chunks.map(c => Buffer.from(c))));
  } else {
    const buf = Buffer.from(await res.arrayBuffer());
    if (onProgress) onProgress(buf.length, total || buf.length);
    fs.writeFileSync(dest, buf);
  }
  return dest;
}

let _privEscape = null;
function needsPrivEscape() {
  if (_privEscape !== null) return _privEscape;
  _privEscape = false;
  if (process.platform !== 'linux') return false;
  try {
    const m = fs.readFileSync('/proc/self/status', 'utf8').match(/NoNewPrivs:\s*(\d)/);
    if (!m || m[1] !== '1') return false;
    if (!process.env.XDG_RUNTIME_DIR) return false;
    execFileSync('bash', ['-lc', 'command -v systemd-run'], { timeout: 4000 });
    _privEscape = true;
  } catch (_) { _privEscape = false; }
  return _privEscape;
}

function validateSudo(sudoPassword) {
  return new Promise((resolve) => {
    const sudoArgs = ['-S', '-k', '-v'];
    const cmd = needsPrivEscape() ? 'systemd-run' : 'sudo';
    const args = needsPrivEscape()
      ? ['--user', '--pipe', '--wait', '--collect', '--quiet', '--', 'sudo', ...sudoArgs]
      : sudoArgs;
    const proc = spawn(cmd, args, { env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stdout.on('data', () => {});
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => resolve({ ok: false, error: err.message }));
    proc.on('close', (code) => {
      if (code === 0) { resolve({ ok: true }); return; }
      const wrongPw = /incorrect password|Sorry, try again|authentication failure/i.test(stderr);
      resolve({ ok: false, error: wrongPw ? 'Incorrect sudo password' : (stderr.trim().split('\n').slice(-2).join('\n') || `sudo exited ${code}`) });
    });
    proc.stdin.write(sudoPassword + '\n');
    proc.stdin.end();
  });
}

// AI_TOOL_INAPP_UPDATE=1 is preserved through sudo so the package postinst can
// tell an in-app update (relaunches itself) from a manual dpkg (kills stale).
function installDeb(debPath, sudoPassword) {
  return new Promise((resolve) => {
    const sudoArgs = ['-S', '-k', '--preserve-env=AI_TOOL_INAPP_UPDATE', 'apt-get', 'install', '-y', debPath];
    const cmd = needsPrivEscape() ? 'systemd-run' : 'sudo';
    const args = needsPrivEscape()
      ? ['--user', '--pipe', '--wait', '--collect', '--quiet', '--', 'sudo', ...sudoArgs]
      : sudoArgs;
    const proc = spawn(cmd, args, {
      env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive', AI_TOOL_INAPP_UPDATE: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stderr = '';
    proc.stdout.on('data', () => {});
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => resolve({ success: false, error: err.message }));
    proc.on('close', (code) => {
      if (code === 0) { resolve({ success: true }); }
      else {
        const wrongPw = /incorrect password|Sorry, try again|authentication failure/i.test(stderr);
        resolve({ success: false, error: wrongPw ? 'Incorrect sudo password' : (stderr.trim().split('\n').slice(-3).join('\n') || `apt-get exited ${code}`) });
      }
    });
    proc.stdin.write(sudoPassword + '\n');
    proc.stdin.end();
  });
}

module.exports = { checkForUpdate, downloadAsset, installDeb, validateSudo, isNewer, parseVersion };
