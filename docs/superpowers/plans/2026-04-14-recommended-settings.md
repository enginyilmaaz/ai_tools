# Recommended Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-shot "Apply IDE Tweaks" QuickAccess action with a granular **Recommended Settings** subpage (cloned from MCP/Plugins) that lets the user checkbox-select individual VS Code settings, shell aliases, and right-click context-menu integrations, then Apply Selected or Revert Selected.

**Architecture:** Renderer page at `src/renderer/js/pages/recommended-settings.js` mirrors the MCP page (two-column card layout, master select-all, split primary/dropdown buttons). Main process gains a `src/main/modules/recommended-settings/` module tree with an item registry (13 items across 3 kinds: `vscodeSetting`, `alias`, `ctxmenu`), per-kind apply/revert handlers, and platform-specific context-menu writers (HKCU `.reg` on Windows, direct `python3-nautilus` extensions on Linux/Nautilus — we ship our own `.py` files under `src/renderer/assets/recommended-settings/nautilus/`). Items are filtered at render time based on capability detection (VS Code / Claude / Codex binaries installed, plus `ctxmenuSupported` which requires either Windows or Linux+Nautilus).

**Tech Stack:** Electron 33.4.11, vanilla JS (no framework), `fs` + `child_process` for OS-level writes, `reg.exe` on Windows, `pkexec` + `apt` + `nautilus -q` on Linux.

**Spec reference:** `docs/superpowers/specs/2026-04-14-recommended-settings-design.md`

---

## File Map

### New files
- `src/main/modules/recommended-settings/index.js` — orchestrator, item registry
- `src/main/modules/recommended-settings/detect.js` — capability detection
- `src/main/modules/recommended-settings/vscode-settings.js` — per-key VS Code apply/revert/isApplied
- `src/main/modules/recommended-settings/aliases.js` — per-alias apply/revert/isApplied
- `src/main/modules/recommended-settings/context-menus/index.js` — platform dispatcher
- `src/main/modules/recommended-settings/context-menus/windows.js` — HKCU `.reg` writer
- `src/main/modules/recommended-settings/context-menus/linux-nautilus.js` — python3-nautilus installer + .py copy/remove
- `src/renderer/js/pages/recommended-settings.js` — renderer page (MCP clone)
- `src/renderer/assets/recommended-settings/claude.svg`
- `src/renderer/assets/recommended-settings/codex.svg`
- `src/renderer/assets/recommended-settings/vscode.svg`
- `src/renderer/assets/recommended-settings/platform/claude.ico`
- `src/renderer/assets/recommended-settings/platform/claude.png`
- `src/renderer/assets/recommended-settings/platform/codex.ico`
- `src/renderer/assets/recommended-settings/platform/codex.png`
- `src/renderer/assets/recommended-settings/platform/vscode.ico`
- `src/renderer/assets/recommended-settings/platform/vscode.png`
- `src/renderer/assets/recommended-settings/nautilus/smai-open-claude.py`
- `src/renderer/assets/recommended-settings/nautilus/smai-open-codex.py`
- `src/renderer/assets/recommended-settings/nautilus/smai-open-vscode.py`

### Modified files
- `src/renderer/js/subwindow.js` — register new `recommended-settings` page
- `src/renderer/js/app.js` — change `wtApplySettings` click handler, delete `_applyEditorSettings()`
- `src/main/ipc-handlers.js` — add new IPC cases, remove obsolete ones
- `src/main/modules/editor-settings.js` — strip `applyAllEditorSettings` / PS profile logic (replaced by new module tree)
- `src/renderer/styles.css` — clone MCP card CSS as `rs-*`, add kind-badge colours
- `src/config/languages/en.json` — add 30 new `Rs*` keys + `QuickAccessApplySettingsTooltip`
- `src/config/languages/tr.json` — same keys in Turkish

### Unchanged — no edits required
- `package.json` build config (our new files are under `src/**/*` which is already in the `files` glob)
- `.github/workflows/release-build.yml` (existing CI builds .deb/.AppImage/.exe for the Electron app; no step changes needed for this feature)

### Deleted
- Nothing outright. The `RECOMMENDED_SETTINGS` / `BASH_ALIASES` constants in `editor-settings.js` are relocated, not removed, so the final editor-settings.js shrinks to helper utilities only.

### Renderer security note
The renderer uses plain DOM construction (`document.createElement`, `textContent`, `setAttribute`, `appendChild`) rather than string concatenation into `innerHTML`. Static markup that ships at render time (the top-level page chrome returned from `render()`) is a fixed template with no user data, so string-returning patterns inherited from `mcp-servers.js` are retained there; dynamic row construction is built via DOM APIs.

---

## Task 1: Icon assets + Python Nautilus extension templates

**Files:**
- Create: `src/renderer/assets/recommended-settings/claude.svg`, `codex.svg`, `vscode.svg`
- Create: `src/renderer/assets/recommended-settings/platform/claude.{ico,png}`, `codex.{ico,png}`, `vscode.{ico,png}`
- Create: `src/renderer/assets/recommended-settings/nautilus/smai-open-claude.py`, `smai-open-codex.py`, `smai-open-vscode.py`

Everything ships automatically under the existing `"files": ["src/**/*"]`
glob in `package.json` — no electron-builder config changes, no GitHub Actions
workflow changes.

- [ ] **Step 1: Create letter-monogram SVGs for the 3 brands**

Create simple 24×24 SVG monograms (the engineer can later replace with
official brand SVGs if appropriate):

```bash
mkdir -p src/renderer/assets/recommended-settings/platform \
         src/renderer/assets/recommended-settings/nautilus
```

`src/renderer/assets/recommended-settings/claude.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect width="24" height="24" rx="5" fill="#D97757"/>
  <text x="12" y="16" font-family="-apple-system, Segoe UI, sans-serif" font-size="12" font-weight="700"
        fill="#fff" text-anchor="middle">C</text>
</svg>
```

`src/renderer/assets/recommended-settings/codex.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect width="24" height="24" rx="5" fill="#10A37F"/>
  <text x="12" y="16" font-family="-apple-system, Segoe UI, sans-serif" font-size="12" font-weight="700"
        fill="#fff" text-anchor="middle">X</text>
</svg>
```

`src/renderer/assets/recommended-settings/vscode.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect width="24" height="24" rx="5" fill="#2482FF"/>
  <text x="12" y="16" font-family="-apple-system, Segoe UI, sans-serif" font-size="10" font-weight="700"
        fill="#fff" text-anchor="middle">VS</text>
</svg>
```

- [ ] **Step 2: Generate platform `.ico` and `.png` from the SVGs**

```bash
for NAME in claude codex vscode; do
  convert "src/renderer/assets/recommended-settings/${NAME}.svg" \
    -background none -resize 64x64 \
    "src/renderer/assets/recommended-settings/platform/${NAME}.png"
  convert "src/renderer/assets/recommended-settings/${NAME}.svg" \
    -background none -define icon:auto-resize=16,24,32,48 \
    "src/renderer/assets/recommended-settings/platform/${NAME}.ico"
done
ls src/renderer/assets/recommended-settings/platform/
```

Expected: 6 files (3 `.ico`, 3 `.png`). If ImageMagick is missing,
`sudo apt install -y imagemagick` first.

- [ ] **Step 3: Create the 3 Python Nautilus extension templates**

`src/renderer/assets/recommended-settings/nautilus/smai-open-claude.py`:
```python
#!/usr/bin/env python3
"""SmartMarine AI — Nautilus context-menu action: Open in Claude Code"""
import os
import subprocess
from gi.repository import Nautilus, GObject

CMD   = 'claude --dangerously-skip-permissions --effort max'
LABEL = 'Open in Claude Code'
ICON  = os.path.expanduser('~/.local/share/smartmarine-ai/icons/claude.png')


def _icon_uri():
    return 'file://' + ICON if os.path.exists(ICON) else ''


class SmaiOpenClaude(GObject.GObject, Nautilus.MenuProvider):
    def _item(self, target_path):
        mi = Nautilus.MenuItem(
            name='SmaiOpenClaude',
            label=LABEL,
            tip='',
            icon=_icon_uri(),
        )
        mi.connect('activate', self._run, target_path)
        return mi

    def _run(self, _mi, path):
        subprocess.Popen([
            'gnome-terminal', '--working-directory=' + path, '--',
            'bash', '-lc', CMD + '; exec bash'
        ])

    def get_file_items(self, files):
        if not files:
            return []
        f = files[0]
        if not f.is_directory():
            return []
        path = f.get_location().get_path()
        return [self._item(path)] if path else []

    def get_background_items(self, folder):
        path = folder.get_location().get_path()
        return [self._item(path)] if path else []
```

`src/renderer/assets/recommended-settings/nautilus/smai-open-codex.py`:
Copy the Claude file and change:
- Top docstring → `"""SmartMarine AI — Nautilus context-menu action: Open in Codex CLI"""`
- `CMD` → `'codex --sandbox danger-full-access -c model_reasoning_effort="xhigh"'`
- `LABEL` → `'Open in Codex CLI'`
- `ICON` → `~/.local/share/smartmarine-ai/icons/codex.png`
- Class name → `SmaiOpenCodex`
- `name='SmaiOpenCodex'`

`src/renderer/assets/recommended-settings/nautilus/smai-open-vscode.py`:
Copy and change:
- Top docstring → `"""SmartMarine AI — Nautilus context-menu action: Open in VS Code"""`
- `LABEL` → `'Open in VS Code'`
- `ICON` → `~/.local/share/smartmarine-ai/icons/vscode.png`
- Class name → `SmaiOpenVscode`
- `name='SmaiOpenVscode'`
- Replace `_run` body with:
  ```python
  def _run(self, _mi, path):
      subprocess.Popen(['code', path])
  ```
  (VS Code is a GUI launcher; no terminal wrapper needed.)

- [ ] **Step 4: Verify all files exist**

```bash
ls src/renderer/assets/recommended-settings/
ls src/renderer/assets/recommended-settings/platform/
ls src/renderer/assets/recommended-settings/nautilus/
python3 -m py_compile src/renderer/assets/recommended-settings/nautilus/smai-open-claude.py && \
python3 -m py_compile src/renderer/assets/recommended-settings/nautilus/smai-open-codex.py && \
python3 -m py_compile src/renderer/assets/recommended-settings/nautilus/smai-open-vscode.py && \
echo "python syntax OK"
```

Expected: listings show expected files; Python syntax check prints "python syntax OK".

(`py_compile` only validates syntax — the `gi` import will not resolve when
python3-nautilus isn't installed but syntax check still passes.)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/assets/recommended-settings/
git commit -m "feat(recommended-settings): add icon assets and Python Nautilus extension templates"
```

---

## Task 2: Add i18n keys

**Files:**
- Modify: `src/config/languages/en.json`
- Modify: `src/config/languages/tr.json`

- [ ] **Step 1: Add English keys**

Open `src/config/languages/en.json`. Preserve existing keys and append the following block near the bottom (before the closing `}`; follow the trailing-comma style of the existing file — add a comma to the previous last entry first):

```json
"RsTitle": "Recommended Settings",
"RsDescription": "Enable VS Code tweaks, shell aliases, and right-click context menus for Claude Code, Codex CLI, and VS Code.",
"RsBadgeVscode": "VS",
"RsBadgeAlias": "AL",
"RsBadgeCtxMenu": "CM",
"RsVsSkipPerms": "VS Code — Skip Permissions",
"RsVsPermMode": "VS Code — Bypass Permission Mode",
"RsVsGitAutofetch": "VS Code — Git Auto Fetch",
"RsVsMinimap": "VS Code — Disable Minimap",
"RsVsSticky": "VS Code — Disable Terminal Sticky Scroll",
"RsVsChatAi": "VS Code — Disable AI Chat Features",
"RsAliasCcskip": "ccskip (Claude, skip perms + max effort)",
"RsAliasClaudeSkip": "claude-skip (same as ccskip)",
"RsAliasCxskip": "cxskip (Codex, full-access + xhigh)",
"RsAliasCodexSkip": "codex-skip (same as cxskip)",
"RsCtxClaude": "Open in Claude Code",
"RsCtxCodex": "Open in Codex CLI",
"RsCtxVscode": "Open in VS Code",
"RsApplySelected": "Apply Selected",
"RsRevertSelected": "Revert Selected",
"RsSelectAll": "Select All",
"RsSelectNone": "Select None",
"RsApplyingNProgress": "Applying {done}/{total}...",
"RsApplyDoneN": "{ok} of {total} applied",
"RsRevertDoneN": "{ok} of {total} reverted",
"RsItemApplyFail": "Failed: {reason}",
"RsPyNautilusNeedInstall": "The 'python3-nautilus' package is required for Nautilus right-click integration. Install it now (sudo prompt will appear)?",
"RsPyNautilusInstalling": "Installing python3-nautilus...",
"RsPyNautilusInstallFail": "Installation failed or was cancelled.",
"RsPyNautilusRestart": "Reloading Nautilus...",
"QuickAccessApplySettingsTooltip": "Open Recommended Settings page"
```

- [ ] **Step 2: Add Turkish keys**

Open `src/config/languages/tr.json`. Append matching keys (same identifiers, Turkish values):

```json
"RsTitle": "Önerilen Ayarlar",
"RsDescription": "VS Code ayarlarını, shell alias'larını ve sağ tık menülerini Claude Code / Codex CLI / VS Code için tek yerden yönet.",
"RsBadgeVscode": "VS",
"RsBadgeAlias": "AL",
"RsBadgeCtxMenu": "CM",
"RsVsSkipPerms": "VS Code — İzin Onaylarını Atla",
"RsVsPermMode": "VS Code — Bypass İzin Modu",
"RsVsGitAutofetch": "VS Code — Git Otomatik Fetch",
"RsVsMinimap": "VS Code — Minimap'i Kapat",
"RsVsSticky": "VS Code — Terminal Sticky Scroll'u Kapat",
"RsVsChatAi": "VS Code — AI Chat Özelliklerini Kapat",
"RsAliasCcskip": "ccskip (Claude, izin atla + max effort)",
"RsAliasClaudeSkip": "claude-skip (ccskip ile aynı)",
"RsAliasCxskip": "cxskip (Codex, tam erişim + xhigh)",
"RsAliasCodexSkip": "codex-skip (cxskip ile aynı)",
"RsCtxClaude": "Claude Code ile Aç",
"RsCtxCodex": "Codex CLI ile Aç",
"RsCtxVscode": "VS Code ile Aç",
"RsApplySelected": "Seçilenleri Uygula",
"RsRevertSelected": "Seçilenleri Geri Al",
"RsSelectAll": "Tümünü Seç",
"RsSelectNone": "Hiçbirini Seçme",
"RsApplyingNProgress": "Uygulanıyor {done}/{total}...",
"RsApplyDoneN": "{ok}/{total} uygulandı",
"RsRevertDoneN": "{ok}/{total} geri alındı",
"RsItemApplyFail": "Başarısız: {reason}",
"RsPyNautilusNeedInstall": "Nautilus sağ tık entegrasyonu için 'python3-nautilus' paketi gerekli. Şimdi kurulsun mu (sudo onayı istenir)?",
"RsPyNautilusInstalling": "python3-nautilus kuruluyor...",
"RsPyNautilusInstallFail": "Kurulum başarısız veya iptal edildi.",
"RsPyNautilusRestart": "Nautilus yeniden yükleniyor...",
"QuickAccessApplySettingsTooltip": "Önerilen Ayarlar sayfasını aç"
```

- [ ] **Step 3: Verify both JSON files parse**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/config/languages/en.json','utf8')); console.log('en OK')"
node -e "JSON.parse(require('fs').readFileSync('src/config/languages/tr.json','utf8')); console.log('tr OK')"
```

Expected: `en OK` and `tr OK`.

- [ ] **Step 4: Commit**

```bash
git add src/config/languages/en.json src/config/languages/tr.json
git commit -m "feat(recommended-settings): add i18n keys for en and tr"
```

---

## Task 3: Main — `detect.js` capability detection module

**Files:**
- Create: `src/main/modules/recommended-settings/detect.js`

- [ ] **Step 1: Create the module**

Create `src/main/modules/recommended-settings/detect.js` with this content:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function binaryInstalled(name) {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    execFileSync(cmd, [name], { timeout: 3000, windowsHide: true, stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

function vscodeInstalled() {
  const paths = process.platform === 'win32' ? [
    path.join(process.env.PROGRAMFILES || '', 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd')
  ] : [
    '/usr/bin/code', '/usr/share/code/bin/code', '/snap/bin/code'
  ];
  for (const p of paths) if (fs.existsSync(p)) return true;
  return binaryInstalled(process.platform === 'win32' ? 'code.cmd' : 'code');
}

function detectLinuxFM() {
  if (process.platform !== 'linux') return null;
  try {
    const out = execFileSync('xdg-mime', ['query', 'default', 'inode/directory'], {
      timeout: 2000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (out.toLowerCase().includes('nautilus')) return 'nautilus';
    if (out.toLowerCase().includes('dolphin')) return 'dolphin';
    if (out.toLowerCase().includes('thunar')) return 'thunar';
    if (out.toLowerCase().includes('nemo')) return 'nemo';
  } catch (_) {}

  const desk = (process.env.XDG_CURRENT_DESKTOP || '').toLowerCase();
  if (desk.includes('gnome') && binaryInstalled('nautilus')) return 'nautilus';
  if (desk.includes('kde') && binaryInstalled('dolphin')) return 'dolphin';
  if (desk.includes('xfce') && binaryInstalled('thunar')) return 'thunar';
  if (desk.includes('cinnamon') && binaryInstalled('nemo')) return 'nemo';

  if (binaryInstalled('nautilus')) return 'nautilus';
  return null;
}

function pythonNautilusInstalled() {
  if (process.platform !== 'linux') return false;
  // Check common install locations for the python3-nautilus runtime
  const candidates = [
    '/usr/lib/python3/dist-packages/gi/overrides/Nautilus.py',
    '/usr/lib/python3/dist-packages/nautilus/__init__.py',
    '/usr/share/nautilus-python'
  ];
  if (candidates.some(p => fs.existsSync(p))) return true;
  // Fallback: `dpkg -s python3-nautilus` succeeds
  try {
    execFileSync('dpkg', ['-s', 'python3-nautilus'], {
      timeout: 3000, stdio: 'ignore', windowsHide: true
    });
    return true;
  } catch (_) { return false; }
}

function detectCapabilities() {
  const fm = detectLinuxFM();
  return {
    vscode: vscodeInstalled(),
    claude: binaryInstalled('claude'),
    codex:  binaryInstalled('codex'),
    platform: process.platform,
    fileManager: fm,
    ctxmenuSupported:
      process.platform === 'win32' ||
      (process.platform === 'linux' && fm === 'nautilus'),
    pythonNautilusInstalled: pythonNautilusInstalled()
  };
}

module.exports = {
  binaryInstalled,
  vscodeInstalled,
  detectLinuxFM,
  pythonNautilusInstalled,
  detectCapabilities
};
```

- [ ] **Step 2: Verify module by ad-hoc node invocation**

```bash
node -e "console.log(JSON.stringify(require('./src/main/modules/recommended-settings/detect').detectCapabilities(), null, 2))"
```

Expected: JSON with `vscode`, `claude`, `codex`, `platform`, `fileManager`, `ctxmenuSupported`, `actionsForNautilusInstalled`. Values reflect the real system. Should not throw.

- [ ] **Step 3: Commit**

```bash
git add src/main/modules/recommended-settings/detect.js
git commit -m "feat(recommended-settings): add capability detection module"
```

---

## Task 4: Main — `vscode-settings.js` per-key apply/revert

**Files:**
- Create: `src/main/modules/recommended-settings/vscode-settings.js`

- [ ] **Step 1: Create the module**

```js
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function settingsPath() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appdata, 'Code', 'User', 'settings.json');
  }
  return path.join(home, '.config', 'Code', 'User', 'settings.json');
}

function stripJsonComments(text) {
  return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function readSettings() {
  const p = settingsPath();
  if (!fs.existsSync(p)) return {};
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch (_) {
    try { return JSON.parse(stripJsonComments(raw)); }
    catch (_) { return {}; }
  }
}

function writeSettings(obj) {
  const p = settingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function isApplied(key, expectedValue) {
  const current = readSettings();
  return Object.prototype.hasOwnProperty.call(current, key) && current[key] === expectedValue;
}

function apply(key, value) {
  const current = readSettings();
  current[key] = value;
  writeSettings(current);
  return { success: true };
}

function revert(key) {
  const current = readSettings();
  if (Object.prototype.hasOwnProperty.call(current, key)) {
    delete current[key];
    writeSettings(current);
  }
  return { success: true };
}

module.exports = { settingsPath, isApplied, apply, revert };
```

- [ ] **Step 2: Verify by round-trip**

```bash
node -e "
const m = require('./src/main/modules/recommended-settings/vscode-settings');
const K = 'claudeCode.smaiRoundtripProbe';
console.log('before:', m.isApplied(K, true));
m.apply(K, true);
console.log('after apply:', m.isApplied(K, true));
m.revert(K);
console.log('after revert:', m.isApplied(K, true));
"
```

Expected: `before: false`, `after apply: true`, `after revert: false`. No exception.

- [ ] **Step 3: Commit**

```bash
git add src/main/modules/recommended-settings/vscode-settings.js
git commit -m "feat(recommended-settings): add per-key VS Code settings apply/revert"
```

---

## Task 5: Main — `aliases.js` per-alias apply/revert

**Files:**
- Create: `src/main/modules/recommended-settings/aliases.js`

- [ ] **Step 1: Create the module**

```js
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MARKER_HEAD = '# smai-recommended-alias:';

function bashrcPath() { return path.join(os.homedir(), '.bashrc'); }
function winCmdPath(name) {
  return path.join(os.homedir(), '.local', 'bin', name + '.cmd');
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function isAppliedLinux(name, command) {
  const p = bashrcPath();
  if (!fs.existsSync(p)) return false;
  const content = fs.readFileSync(p, 'utf8');
  const exact = `alias ${name}='${command}'`;
  return content.includes(exact);
}

function applyLinux(name, command) {
  const p = bashrcPath();
  if (!fs.existsSync(p)) {
    return { success: false, message: '.bashrc not found' };
  }
  let content = fs.readFileSync(p, 'utf8');
  const exact = `alias ${name}='${command}'`;
  if (content.includes(exact)) return { success: true };
  content = content.replace(new RegExp(`^alias ${escapeRegex(name)}=.*$`, 'gm'), '');
  content = content.trimEnd() + '\n' + `${MARKER_HEAD} ${name}\n` + exact + '\n';
  fs.writeFileSync(p, content, 'utf8');
  return { success: true };
}

function revertLinux(name, command) {
  const p = bashrcPath();
  if (!fs.existsSync(p)) return { success: true };
  let content = fs.readFileSync(p, 'utf8');
  const exact = `alias ${name}='${command}'`;
  if (!content.includes(exact)) return { success: true };
  content = content.replace(new RegExp(`^${escapeRegex(MARKER_HEAD)}\\s+${escapeRegex(name)}\\s*\\n`, 'gm'), '');
  content = content.split('\n').filter(line => line !== exact).join('\n');
  fs.writeFileSync(p, content, 'utf8');
  return { success: true };
}

function isAppliedWindows(name, command) {
  const p = winCmdPath(name);
  if (!fs.existsSync(p)) return false;
  const expected = `@echo off\r\n${command} %*`;
  return fs.readFileSync(p, 'utf8').trim() === expected.trim();
}

function applyWindows(name, command) {
  const p = winCmdPath(name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `@echo off\r\n${command} %*`, 'utf8');
  return { success: true };
}

function revertWindows(name) {
  const p = winCmdPath(name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return { success: true };
}

function isApplied(name, command) {
  return process.platform === 'win32' ? isAppliedWindows(name, command) : isAppliedLinux(name, command);
}

function apply(name, command) {
  return process.platform === 'win32' ? applyWindows(name, command) : applyLinux(name, command);
}

function revert(name, command) {
  return process.platform === 'win32' ? revertWindows(name) : revertLinux(name, command);
}

module.exports = { isApplied, apply, revert };
```

- [ ] **Step 2: Verify by round-trip**

```bash
node -e "
const m = require('./src/main/modules/recommended-settings/aliases');
const N='smai-probe'; const C='echo probe';
console.log('before:', m.isApplied(N, C));
console.log('apply:', m.apply(N, C));
console.log('after apply:', m.isApplied(N, C));
console.log('revert:', m.revert(N, C));
console.log('after revert:', m.isApplied(N, C));
"
```

Expected: before false, after apply true, after revert false.

- [ ] **Step 3: Commit**

```bash
git add src/main/modules/recommended-settings/aliases.js
git commit -m "feat(recommended-settings): add per-alias apply/revert for bash and cmd"
```

---

## Task 6: Main — `context-menus/windows.js` HKCU `.reg` writer

**Files:**
- Create: `src/main/modules/recommended-settings/context-menus/windows.js`

- [ ] **Step 1: Create the module**

```js
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ICON_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'smartmarine-ai', 'icons'
);

function iconPathFor(brand) { return path.join(ICON_DIR, `${brand}.ico`); }

function sourceIcon(brand) {
  const packaged = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'src', 'renderer', 'assets', 'recommended-settings', 'platform', `${brand}.ico`);
  const dev = path.join(__dirname, '..', '..', '..', '..', 'renderer', 'assets', 'recommended-settings', 'platform', `${brand}.ico`);
  return fs.existsSync(packaged) ? packaged : dev;
}

function ensureIcon(brand) {
  fs.mkdirSync(ICON_DIR, { recursive: true });
  const dst = iconPathFor(brand);
  if (fs.existsSync(dst)) return dst;
  fs.copyFileSync(sourceIcon(brand), dst);
  return dst;
}

function regAdd(keyPath, valueName, data) {
  const args = ['add', keyPath];
  if (valueName === '') args.push('/ve'); else args.push('/v', valueName);
  args.push('/d', data, '/f');
  execFileSync('reg.exe', args, { windowsHide: true, timeout: 5000 });
}

function regDelete(keyPath) {
  try {
    execFileSync('reg.exe', ['delete', keyPath, '/f'], { windowsHide: true, timeout: 5000 });
  } catch (_) { /* idempotent */ }
}

function regQuery(keyPath) {
  try {
    execFileSync('reg.exe', ['query', keyPath], { windowsHide: true, timeout: 5000, stdio: 'ignore' });
    return true;
  } catch (_) { return false; }
}

function keyBase(id) { return `HKCU\\Software\\Classes\\Directory\\shell\\SmaiOpen${id}`; }
function keyBackground(id) { return `HKCU\\Software\\Classes\\Directory\\Background\\shell\\SmaiOpen${id}`; }

function isApplied({ id }) {
  return regQuery(keyBase(id)) && regQuery(keyBackground(id));
}

function apply({ id, label, brand, runCmd, runInTerminal }) {
  const icon = ensureIcon(brand);
  const cmdline = runInTerminal
    ? `cmd.exe /k pushd "%V" && ${runCmd}`
    : `${runCmd} "%V"`;

  for (const root of [keyBase(id), keyBackground(id)]) {
    regAdd(root, '', label);
    regAdd(root, 'Icon', icon);
    regAdd(root + '\\command', '', cmdline);
  }
  return { success: true };
}

function revert({ id }) {
  regDelete(keyBase(id));
  regDelete(keyBackground(id));
  return { success: true };
}

module.exports = { apply, revert, isApplied };
```

Notes:
- `runInTerminal: true` for Claude/Codex (persistent shell needed)
- `runInTerminal: false` for VS Code (launches GUI; command becomes `code "%V"`)

- [ ] **Step 2: Verify parse on Linux dev machine**

```bash
node -e "require('./src/main/modules/recommended-settings/context-menus/windows'); console.log('parses OK')"
```

Expected: `parses OK`.

- [ ] **Step 3: Verify end-to-end on Windows (Windows machine only)**

On a Windows test machine:

```powershell
node -e "require('./src/main/modules/recommended-settings/context-menus/windows').apply({id:'ProbeVscode', label:'smai probe', brand:'vscode', runCmd:'code', runInTerminal:false})"
reg query "HKCU\Software\Classes\Directory\shell\SmaiOpenProbeVscode"
# Right-click a folder → "smai probe" should appear
node -e "require('./src/main/modules/recommended-settings/context-menus/windows').revert({id:'ProbeVscode'})"
reg query "HKCU\Software\Classes\Directory\shell\SmaiOpenProbeVscode"
# Should fail with "ERROR: The system was unable to find..."
```

- [ ] **Step 4: Commit**

```bash
git add src/main/modules/recommended-settings/context-menus/windows.js
git commit -m "feat(recommended-settings): add Windows HKCU registry context-menu writer"
```

---

## Task 7: Main — `context-menus/linux-nautilus.js`

**Files:**
- Create: `src/main/modules/recommended-settings/context-menus/linux-nautilus.js`

- [ ] **Step 1: Create the module**

```js
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const EXT_DIR  = path.join(os.homedir(), '.local', 'share', 'nautilus-python', 'extensions');
const ICON_DIR = path.join(os.homedir(), '.local', 'share', 'smartmarine-ai', 'icons');

function pyFileName(id) { return `smai-open-${id}.py`; }
function extPathFor(id) { return path.join(EXT_DIR, pyFileName(id)); }
function iconPathFor(brand) { return path.join(ICON_DIR, `${brand}.png`); }

function assetBase() {
  // Packaged app (asar-unpacked): resourcesPath/app.asar.unpacked/src/renderer/assets/recommended-settings/
  const packaged = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'src', 'renderer', 'assets', 'recommended-settings');
  if (fs.existsSync(packaged)) return packaged;
  // Dev: ../../../../renderer/assets/recommended-settings from this file
  return path.join(__dirname, '..', '..', '..', '..', 'renderer', 'assets', 'recommended-settings');
}

function sourcePy(id) { return path.join(assetBase(), 'nautilus', pyFileName(id)); }
function sourceIcon(brand) { return path.join(assetBase(), 'platform', `${brand}.png`); }

function ensureIcon(brand) {
  fs.mkdirSync(ICON_DIR, { recursive: true });
  const dst = iconPathFor(brand);
  if (fs.existsSync(dst)) return dst;
  const src = sourceIcon(brand);
  if (!fs.existsSync(src)) return null;
  fs.copyFileSync(src, dst);
  return dst;
}

function installPythonNautilus(logger) {
  return new Promise((resolve) => {
    if (logger) logger({ type: 'log', data: { message: 'Installing python3-nautilus via pkexec...' } });
    const proc = spawn('pkexec', ['apt', 'install', '-y', 'python3-nautilus'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, message: `pkexec/apt exited ${code}: ${stderr.slice(0, 500)}` });
      }
    });
    proc.on('error', (err) => resolve({ success: false, message: err.message }));
  });
}

function nautilusReload() {
  try { execFileSync('nautilus', ['-q'], { timeout: 5000, stdio: 'ignore' }); } catch (_) {}
}

function isApplied({ id }) {
  return fs.existsSync(extPathFor(id));
}

function apply({ id, brand }) {
  const src = sourcePy(id);
  if (!fs.existsSync(src)) {
    return { success: false, message: `Python extension source missing: ${src}` };
  }
  ensureIcon(brand);
  fs.mkdirSync(EXT_DIR, { recursive: true });
  fs.copyFileSync(src, extPathFor(id));
  nautilusReload();
  return { success: true };
}

function revert({ id }) {
  const p = extPathFor(id);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    nautilusReload();
  }
  return { success: true };
}

module.exports = { apply, revert, isApplied, installPythonNautilus };
```

- [ ] **Step 2: Verify module parses and the `.py` source files are locatable**

```bash
node -e "
const m = require('./src/main/modules/recommended-settings/context-menus/linux-nautilus');
console.log('exports:', Object.keys(m));
"
node -e "
const path = require('path');
const fs = require('fs');
const base = path.resolve('src/renderer/assets/recommended-settings/nautilus');
for (const id of ['ctx-claude','ctx-codex','ctx-vscode']) {
  const pyName = 'smai-open-' + id + '.py';
  console.log(pyName, fs.existsSync(path.join(base, pyName)) ? 'OK' : 'MISSING');
}
"
```

Expected: exports listed; all three `.py` files print OK.

**Do NOT** call `apply()` or `installPythonNautilus()` in this task — that
would touch the live system and trigger `pkexec`. End-to-end verification
happens in Task 16.

- [ ] **Step 3: Commit**

```bash
git add src/main/modules/recommended-settings/context-menus/linux-nautilus.js
git commit -m "feat(recommended-settings): add Linux Nautilus context-menu writer (python3-nautilus)"
```

---

## Task 8: Main — `context-menus/index.js` platform dispatcher

**Files:**
- Create: `src/main/modules/recommended-settings/context-menus/index.js`

- [ ] **Step 1: Create the module**

```js
'use strict';

const windowsImpl = require('./windows');
const linuxImpl = require('./linux-nautilus');

function pick() {
  if (process.platform === 'win32') return windowsImpl;
  if (process.platform === 'linux') return linuxImpl;
  return null;
}

function apply(item) {
  const impl = pick();
  if (!impl) return { success: false, message: 'Unsupported platform' };
  return impl.apply(item);
}

function revert(item) {
  const impl = pick();
  if (!impl) return { success: false, message: 'Unsupported platform' };
  return impl.revert(item);
}

function isApplied(item) {
  const impl = pick();
  if (!impl) return false;
  return impl.isApplied(item);
}

function installPrerequisites(logger) {
  if (process.platform === 'linux') return linuxImpl.installPythonNautilus(logger);
  return Promise.resolve({ success: true });
}

module.exports = { apply, revert, isApplied, installPrerequisites };
```

- [ ] **Step 2: Verify parse**

```bash
node -e "const m = require('./src/main/modules/recommended-settings/context-menus'); console.log(Object.keys(m))"
```

Expected: `[ 'apply', 'revert', 'isApplied', 'installPrerequisites' ]`.

- [ ] **Step 3: Commit**

```bash
git add src/main/modules/recommended-settings/context-menus/index.js
git commit -m "feat(recommended-settings): add context-menu platform dispatcher"
```

---

## Task 9: Main — `recommended-settings/index.js` orchestrator + registry

**Files:**
- Create: `src/main/modules/recommended-settings/index.js`

- [ ] **Step 1: Create the module**

```js
'use strict';

const vscodeSettings = require('./vscode-settings');
const aliases = require('./aliases');
const ctxMenus = require('./context-menus');
const { detectCapabilities } = require('./detect');

const CLAUDE_CMD = 'claude --dangerously-skip-permissions --effort max';
const CODEX_CMD  = 'codex --sandbox danger-full-access -c model_reasoning_effort="xhigh"';

const ITEMS = [
  // VS Code settings
  { id:'vs-skip-perms',     group:'vscode', nameKey:'RsVsSkipPerms',     requires:['vscode'],
    kind:'vscodeSetting', payload:{ key:'claudeCode.allowDangerouslySkipPermissions', value:true } },
  { id:'vs-perm-mode',      group:'vscode', nameKey:'RsVsPermMode',      requires:['vscode'],
    kind:'vscodeSetting', payload:{ key:'claudeCode.initialPermissionMode', value:'bypassPermissions' } },
  { id:'vs-git-autofetch',  group:'vscode', nameKey:'RsVsGitAutofetch',  requires:['vscode'],
    kind:'vscodeSetting', payload:{ key:'git.autofetch', value:true } },
  { id:'vs-minimap-off',    group:'vscode', nameKey:'RsVsMinimap',       requires:['vscode'],
    kind:'vscodeSetting', payload:{ key:'editor.minimap.enabled', value:false } },
  { id:'vs-sticky-off',     group:'vscode', nameKey:'RsVsSticky',        requires:['vscode'],
    kind:'vscodeSetting', payload:{ key:'terminal.integrated.stickyScroll.enabled', value:false } },
  { id:'vs-chat-ai-off',    group:'vscode', nameKey:'RsVsChatAi',        requires:['vscode'],
    kind:'vscodeSetting', payload:{ key:'chat.disableAIFeatures', value:true } },
  // Aliases
  { id:'alias-ccskip',      group:'alias',  nameKey:'RsAliasCcskip',     requires:['claude'],
    kind:'alias', payload:{ name:'ccskip',      cmd: CLAUDE_CMD } },
  { id:'alias-claude-skip', group:'alias',  nameKey:'RsAliasClaudeSkip', requires:['claude'],
    kind:'alias', payload:{ name:'claude-skip', cmd: CLAUDE_CMD } },
  { id:'alias-cxskip',      group:'alias',  nameKey:'RsAliasCxskip',     requires:['codex'],
    kind:'alias', payload:{ name:'cxskip',      cmd: CODEX_CMD } },
  { id:'alias-codex-skip',  group:'alias',  nameKey:'RsAliasCodexSkip',  requires:['codex'],
    kind:'alias', payload:{ name:'codex-skip',  cmd: CODEX_CMD } },
  // Context menus
  { id:'ctx-claude',  group:'ctxmenu', nameKey:'RsCtxClaude', requires:['claude','ctxmenuSupported'],
    kind:'ctxmenu', payload:{ label:'Open in Claude Code', brand:'claude', runCmd: CLAUDE_CMD, runInTerminal:true } },
  { id:'ctx-codex',   group:'ctxmenu', nameKey:'RsCtxCodex',  requires:['codex','ctxmenuSupported'],
    kind:'ctxmenu', payload:{ label:'Open in Codex CLI',   brand:'codex',  runCmd: CODEX_CMD, runInTerminal:true } },
  { id:'ctx-vscode',  group:'ctxmenu', nameKey:'RsCtxVscode', requires:['vscode','ctxmenuSupported'],
    kind:'ctxmenu', payload:{ label:'Open in VS Code',     brand:'vscode', runCmd:'code',      runInTerminal:false } }
];

function isVisible(item, capabilities) {
  return item.requires.every(k => capabilities[k]);
}

function isApplied(item) {
  switch (item.kind) {
    case 'vscodeSetting': return vscodeSettings.isApplied(item.payload.key, item.payload.value);
    case 'alias':         return aliases.isApplied(item.payload.name, item.payload.cmd);
    case 'ctxmenu':       return ctxMenus.isApplied({ id: item.id });
    default: return false;
  }
}

function applyItem(item) {
  switch (item.kind) {
    case 'vscodeSetting': return vscodeSettings.apply(item.payload.key, item.payload.value);
    case 'alias':         return aliases.apply(item.payload.name, item.payload.cmd);
    case 'ctxmenu':       return ctxMenus.apply({ id: item.id, ...item.payload });
    default: return { success: false, message: `Unknown kind ${item.kind}` };
  }
}

function revertItem(item) {
  switch (item.kind) {
    case 'vscodeSetting': return vscodeSettings.revert(item.payload.key);
    case 'alias':         return aliases.revert(item.payload.name, item.payload.cmd);
    case 'ctxmenu':       return ctxMenus.revert({ id: item.id });
    default: return { success: false, message: `Unknown kind ${item.kind}` };
  }
}

function getStatus() {
  const capabilities = detectCapabilities();
  const items = ITEMS.map(it => ({
    id: it.id,
    group: it.group,
    nameKey: it.nameKey,
    kind: it.kind,
    visible: isVisible(it, capabilities),
    alreadyApplied: isVisible(it, capabilities) ? isApplied(it) : false
  }));
  return { capabilities, items };
}

function byId(id) { return ITEMS.find(it => it.id === id) || null; }

async function applyMany(ids, onItem, logger) {
  const total = ids.length;
  let ok = 0;
  for (let i = 0; i < ids.length; i++) {
    const item = byId(ids[i]);
    if (!item) {
      if (onItem) onItem({ id: ids[i], success: false, message: 'Unknown item', done: i + 1, total });
      continue;
    }
    if (item.kind === 'ctxmenu' && process.platform === 'linux') {
      const pre = await ctxMenus.installPrerequisites(logger);
      if (!pre.success) {
        if (onItem) onItem({ id: item.id, success: false, message: pre.message || 'Prereq install failed', done: i + 1, total });
        continue;
      }
    }
    let res;
    try { res = applyItem(item); }
    catch (e) { res = { success: false, message: e.message }; }
    if (res && res.success) ok++;
    if (onItem) onItem({ id: item.id, success: !!(res && res.success), message: res && res.message, done: i + 1, total });
  }
  return { ok, total };
}

function revertMany(ids, onItem) {
  const total = ids.length;
  let ok = 0;
  for (let i = 0; i < ids.length; i++) {
    const item = byId(ids[i]);
    if (!item) {
      if (onItem) onItem({ id: ids[i], success: false, message: 'Unknown item', done: i + 1, total });
      continue;
    }
    let res;
    try { res = revertItem(item); }
    catch (e) { res = { success: false, message: e.message }; }
    if (res && res.success) ok++;
    if (onItem) onItem({ id: item.id, success: !!(res && res.success), message: res && res.message, done: i + 1, total });
  }
  return { ok, total };
}

module.exports = { getStatus, applyMany, revertMany, ITEMS };
```

- [ ] **Step 2: Verify `getStatus()` shape**

```bash
node -e "
const m = require('./src/main/modules/recommended-settings');
const s = m.getStatus();
console.log('capabilities:', s.capabilities);
console.log('items count:', s.items.length);
console.log('visible count:', s.items.filter(i => i.visible).length);
console.log('applied count:', s.items.filter(i => i.alreadyApplied).length);
"
```

Expected: capabilities object populated, items count = 13, visible count reasonable for the host, applied count reflects current state.

- [ ] **Step 3: Commit**

```bash
git add src/main/modules/recommended-settings/index.js
git commit -m "feat(recommended-settings): add orchestrator with item registry"
```

---

## Task 10: Main — Register subpage and add new IPC cases

**Files:**
- Modify: `src/renderer/js/subwindow.js` (lines 8–16)
- Modify: `src/main/ipc-handlers.js` (lines ~11 and ~200–226 plus handlers at the bottom)

- [ ] **Step 1: Register the subpage in `subwindow.js`**

In `src/renderer/js/subwindow.js`, modify the `pageConfig` object:

```js
var pageConfig = {
    about: { scriptPath: 'js/pages/about.js', globalName: 'AboutPage' },
    'best-practices': { scriptPath: 'js/pages/best-practices.js', globalName: 'BestPracticesPage' },
    'skill-usage': { scriptPath: 'js/pages/skill-usage.js', globalName: 'SkillUsagePage' },
    skills: { scriptPath: 'js/pages/skills.js', globalName: 'SkillsPage' },
    'mcp-guide': { scriptPath: 'js/pages/mcp-guide.js', globalName: 'McpGuidePage' },
    'mcp-servers': { scriptPath: 'js/pages/mcp-servers.js', globalName: 'McpServersPage' },
    'dev-tools': { scriptPath: 'js/pages/dev-tools.js', globalName: 'DevToolsPage' },
    'recommended-settings': { scriptPath: 'js/pages/recommended-settings.js', globalName: 'RecommendedSettingsPage' }
};
```

- [ ] **Step 2: Add the import and new cases in `ipc-handlers.js`**

At the top of `src/main/ipc-handlers.js`, next to the existing `editorSettings = require(...)` line, add:

```js
const recommendedSettings = require('./modules/recommended-settings');
```

In the switch/case block around line 200–226, add these new cases and **delete** the existing `getEditorSettings` and `applyEditorSettings` cases:

```js
      case 'openRecommendedSettings':
        if (_createSubWindow) _createSubWindow('recommended-settings');
        break;

      // ==================== Recommended Settings ====================
      case 'getRecommendedSettings':
        handleGetRecommendedSettings(sender);
        break;

      case 'applyRecommendedSettings':
        handleApplyRecommendedSettings(sender, data);
        break;

      case 'revertRecommendedSettings':
        handleRevertRecommendedSettings(sender, data);
        break;
```

- [ ] **Step 3: Add the handler functions**

Below the existing handler definitions (replacing the old `handleGetEditorSettings` / `handleApplyEditorSettings` if present):

```js
function handleGetRecommendedSettings(sender) {
  try {
    const status = recommendedSettings.getStatus();
    sender.send('bridge-reply', { type: 'recommendedSettingsStatus', data: status });
  } catch (err) {
    sender.send('bridge-reply', { type: 'recommendedSettingsStatus', data: { error: err.message } });
  }
}

async function handleApplyRecommendedSettings(sender, data) {
  const ids = (data && Array.isArray(data.ids)) ? data.ids : [];
  const wrapped = wrapSenderWithMainLog(sender);
  const onItem = (r) => sender.send('bridge-reply', { type: 'recommendedSettingResult', data: r });
  const logger = (m) => wrapped.send('bridge-reply', m);
  try {
    const summary = await recommendedSettings.applyMany(ids, onItem, logger);
    sender.send('bridge-reply', { type: 'recommendedSettingsBatchDone', data: { mode: 'apply', ...summary } });
  } catch (err) {
    sender.send('bridge-reply', { type: 'recommendedSettingsBatchDone', data: { mode: 'apply', error: err.message } });
  }
}

function handleRevertRecommendedSettings(sender, data) {
  const ids = (data && Array.isArray(data.ids)) ? data.ids : [];
  const onItem = (r) => sender.send('bridge-reply', { type: 'recommendedSettingResult', data: r });
  try {
    const summary = recommendedSettings.revertMany(ids, onItem);
    sender.send('bridge-reply', { type: 'recommendedSettingsBatchDone', data: { mode: 'revert', ...summary } });
  } catch (err) {
    sender.send('bridge-reply', { type: 'recommendedSettingsBatchDone', data: { mode: 'revert', error: err.message } });
  }
}
```

- [ ] **Step 4: Launch the app to verify**

```bash
npm run dev
```

Expected: window opens, no "Cannot find module" or ReferenceError. Close the app.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/js/subwindow.js src/main/ipc-handlers.js
git commit -m "feat(recommended-settings): register subpage and wire IPC cases"
```

---

## Task 11: Renderer — page skeleton (static markup)

**Files:**
- Create: `src/renderer/js/pages/recommended-settings.js`

- [ ] **Step 1: Create the file with `render()` and empty `afterRender`**

The renderer uses DOM construction APIs (`document.createElement`, `textContent`, `setAttribute`, `appendChild`) for dynamic content. Only the top-level static page chrome is returned as a string template (this matches the SubWindow framework contract — see `subwindow.js` which does `container.innerHTML = page.render()` with trusted static markup produced in this function).

Create `src/renderer/js/pages/recommended-settings.js`:

```js
// Recommended Settings Page — runs inside SubWindow. Mirrors MCP page structure.
window.RecommendedSettingsPage = {

    _allItems: [
        { id:'vs-skip-perms',     group:'vscode',  nameKey:'RsVsSkipPerms',     requires:['vscode'], brand:'vscode', badge:'vscode' },
        { id:'vs-perm-mode',      group:'vscode',  nameKey:'RsVsPermMode',      requires:['vscode'], brand:'vscode', badge:'vscode' },
        { id:'vs-git-autofetch',  group:'vscode',  nameKey:'RsVsGitAutofetch',  requires:['vscode'], brand:'vscode', badge:'vscode' },
        { id:'vs-minimap-off',    group:'vscode',  nameKey:'RsVsMinimap',       requires:['vscode'], brand:'vscode', badge:'vscode' },
        { id:'vs-sticky-off',     group:'vscode',  nameKey:'RsVsSticky',        requires:['vscode'], brand:'vscode', badge:'vscode' },
        { id:'vs-chat-ai-off',    group:'vscode',  nameKey:'RsVsChatAi',        requires:['vscode'], brand:'vscode', badge:'vscode' },
        { id:'alias-ccskip',      group:'alias',   nameKey:'RsAliasCcskip',     requires:['claude'], brand:'claude', badge:'alias' },
        { id:'alias-claude-skip', group:'alias',   nameKey:'RsAliasClaudeSkip', requires:['claude'], brand:'claude', badge:'alias' },
        { id:'alias-cxskip',      group:'alias',   nameKey:'RsAliasCxskip',     requires:['codex'],  brand:'codex',  badge:'alias' },
        { id:'alias-codex-skip',  group:'alias',   nameKey:'RsAliasCodexSkip',  requires:['codex'],  brand:'codex',  badge:'alias' },
        { id:'ctx-claude',        group:'ctxmenu', nameKey:'RsCtxClaude',       requires:['claude','ctxmenuSupported'], brand:'claude', badge:'ctxmenu' },
        { id:'ctx-codex',         group:'ctxmenu', nameKey:'RsCtxCodex',        requires:['codex','ctxmenuSupported'],  brand:'codex',  badge:'ctxmenu' },
        { id:'ctx-vscode',        group:'ctxmenu', nameKey:'RsCtxVscode',       requires:['vscode','ctxmenuSupported'], brand:'vscode', badge:'ctxmenu' }
    ],

    _capabilities: null,
    _appliedMap: {},
    _inFlight: false,

    _L: function (k) { return (window.Bridge && Bridge.lang && Bridge.lang(k)) || k; },

    render: function () {
        var L = this._L;
        // Static template only — no user data interpolated; row content is
        // built later via DOM APIs in _renderList().
        return '' +
        '<div class="subpage-layout rs-page-layout">' +
            '<div class="rs-page-header">' +
                '<span class="mi" style="font-size:20px;color:var(--accent-blue)">tune</span>' +
                '<span style="font-size:14px;font-weight:600">' + L('RsTitle') + '</span>' +
            '</div>' +
            '<div class="rs-page-scroll">' +
                '<p class="rs-desc" style="margin-bottom:8px"></p>' +
                '<div style="display:flex;align-items:center;margin-bottom:8px;padding-left:8px">' +
                    '<label class="skills-master-toggle" id="rs-select-all" style="cursor:pointer">' +
                        '<span class="skills-row-check">' +
                            '<input id="rs-master-toggle" type="checkbox" checked>' +
                            '<span class="skills-row-check-mark"></span>' +
                        '</span>' +
                        '<span id="rs-master-label" class="skills-master-toggle-label"></span>' +
                    '</label>' +
                '</div>' +
                '<div class="rs-two-col">' +
                    '<div class="card rs-col-card"><div class="card-body" style="padding:8px">' +
                        '<div id="rs-list-left" class="rs-list"></div>' +
                    '</div></div>' +
                    '<div class="card rs-col-card"><div class="card-body" style="padding:8px">' +
                        '<div id="rs-list-right" class="rs-list"></div>' +
                    '</div></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;padding:8px 0 4px">' +
                    '<div class="split-btn-group" id="rs-split-group">' +
                        '<button id="rs-apply-btn" class="btn btn-primary split-btn-main">' +
                            '<span class="mi btn-icon">download_done</span> <span id="rs-apply-label"></span>' +
                        '</button>' +
                        '<button id="rs-split-toggle" class="btn btn-primary split-btn-toggle">' +
                            '<span class="mi">arrow_drop_down</span>' +
                        '</button>' +
                        '<div id="rs-split-menu" class="split-btn-menu">' +
                            '<button id="rs-revert-btn" class="split-btn-menu-item">' +
                                '<span class="mi">undo</span> <span id="rs-revert-label"></span>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="bp-page-actions subpage-footer" style="justify-content:flex-end">' +
                '<button class="btn btn-secondary" id="rs-close-btn">' +
                    '<span class="mi btn-icon">close</span> <span id="rs-close-label"></span>' +
                '</button>' +
            '</div>' +
        '</div>';
    },

    afterRender: function () {
        var L = this._L;
        // Populate translated static text via textContent (no innerHTML)
        var desc = document.querySelector('.rs-desc'); if (desc) desc.textContent = L('RsDescription');
        var masterLabel = document.getElementById('rs-master-label'); if (masterLabel) masterLabel.textContent = L('RsSelectNone');
        var applyLabel = document.getElementById('rs-apply-label'); if (applyLabel) applyLabel.textContent = L('RsApplySelected');
        var revertLabel = document.getElementById('rs-revert-label'); if (revertLabel) revertLabel.textContent = L('RsRevertSelected');
        var closeLabel = document.getElementById('rs-close-label'); if (closeLabel) closeLabel.textContent = L('BtnClose');
        // Full wiring added in Task 12.
    }
};
```

- [ ] **Step 2: Smoke test**

`npm run dev`, then from the main window DevTools console:

```js
Bridge.send('openRecommendedSettings');
```

Expected: subwindow opens showing header "Recommended Settings", description text, Select All checkbox, two empty card columns, Apply Selected / Revert Selected split button, Close button. List is empty (filled in Task 12).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/js/pages/recommended-settings.js
git commit -m "feat(recommended-settings): add renderer page skeleton"
```

---

## Task 12: Renderer — `afterRender()` wiring, list rendering via DOM APIs, batch flow

**Files:**
- Modify: `src/renderer/js/pages/recommended-settings.js`

- [ ] **Step 1: Replace `afterRender` and append helper methods**

Replace the placeholder `afterRender` with the real implementation, and append all the helper methods below it. Keep the existing `render()` function and `_allItems` array unchanged. The resulting file should be this full structure (copy verbatim — do not paraphrase):

```js
    afterRender: function () {
        var self = this;
        var L = this._L;

        // Translated static labels
        var desc = document.querySelector('.rs-desc'); if (desc) desc.textContent = L('RsDescription');
        var masterLabel = document.getElementById('rs-master-label'); if (masterLabel) masterLabel.textContent = L('RsSelectNone');
        var applyLabel = document.getElementById('rs-apply-label'); if (applyLabel) applyLabel.textContent = L('RsApplySelected');
        var revertLabel = document.getElementById('rs-revert-label'); if (revertLabel) revertLabel.textContent = L('RsRevertSelected');
        var closeLabel = document.getElementById('rs-close-label'); if (closeLabel) closeLabel.textContent = L('BtnClose');

        // Close
        var closeBtn = document.getElementById('rs-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', function () { Bridge.send('closeWindow'); });

        // Master toggle
        var master = document.getElementById('rs-master-toggle');
        if (master) {
            master.addEventListener('change', function () {
                var checked = master.checked;
                document.querySelectorAll('.rs-row-cb').forEach(function (cb) { cb.checked = checked; });
                masterLabel.textContent = checked ? L('RsSelectNone') : L('RsSelectAll');
            });
        }

        // Split button
        var splitGroup = document.getElementById('rs-split-group');
        var splitToggle = document.getElementById('rs-split-toggle');
        if (splitToggle && splitGroup) {
            splitToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                splitGroup.classList.toggle('show');
            });
            document.addEventListener('click', function (e) {
                if (!splitGroup.contains(e.target)) splitGroup.classList.remove('show');
            });
        }

        var applyBtn = document.getElementById('rs-apply-btn');
        if (applyBtn) applyBtn.addEventListener('click', function () { self._runBatch('apply'); });

        var revertBtn = document.getElementById('rs-revert-btn');
        if (revertBtn) revertBtn.addEventListener('click', function () {
            if (splitGroup) splitGroup.classList.remove('show');
            self._runBatch('revert');
        });

        // Bridge events
        Bridge.on('recommendedSettingsStatus', function (d) { self._onStatus(d); });
        Bridge.on('recommendedSettingResult', function (d) { self._onItemResult(d); });
        Bridge.on('recommendedSettingsBatchDone', function (d) { self._onBatchDone(d); });

        // Initial fetch
        Bridge.send('getRecommendedSettings');
    },

    _onStatus: function (status) {
        if (!status || status.error) {
            this._capabilities = {};
            this._renderList([]);
            return;
        }
        this._capabilities = status.capabilities || {};
        var serverById = {};
        (status.items || []).forEach(function (i) { serverById[i.id] = i; });
        this._appliedMap = {};
        var self = this;
        this._allItems.forEach(function (it) {
            var s = serverById[it.id];
            if (s) self._appliedMap[it.id] = !!s.alreadyApplied;
        });
        var visible = this._allItems.filter(function (it) {
            var s = serverById[it.id];
            return s && s.visible;
        });
        this._renderList(visible);
    },

    _renderList: function (visibleItems) {
        var L = this._L;
        var left = document.getElementById('rs-list-left');
        var right = document.getElementById('rs-list-right');
        if (!left || !right) return;
        left.replaceChildren(); right.replaceChildren();
        var splitAt = Math.ceil(visibleItems.length / 2);
        var self = this;
        visibleItems.forEach(function (item, idx) {
            var applied = !!self._appliedMap[item.id];
            var row = document.createElement('div');
            row.className = 'rs-row';

            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'rs-row-cb';
            cb.setAttribute('data-rs-id', item.id);
            cb.checked = !applied;
            row.appendChild(cb);

            var img = document.createElement('img');
            img.className = 'rs-row-icon';
            img.src = 'assets/recommended-settings/' + item.brand + '.svg';
            img.alt = '';
            row.appendChild(img);

            var info = document.createElement('div');
            info.className = 'rs-row-info';
            var name = document.createElement('div');
            name.className = 'rs-row-name';
            name.textContent = L(item.nameKey);
            info.appendChild(name);
            var badge = document.createElement('span');
            badge.className = 'rs-badge rs-badge-' + item.badge;
            badge.textContent = item.badge === 'vscode' ? L('RsBadgeVscode')
                              : item.badge === 'alias'  ? L('RsBadgeAlias')
                              : L('RsBadgeCtxMenu');
            info.appendChild(badge);
            row.appendChild(info);

            var status = document.createElement('div');
            status.className = 'rs-row-status';
            var dot = document.createElement('span');
            dot.className = 'rs-status ' + (applied ? 'rs-status-on' : 'rs-status-off');
            dot.textContent = applied ? '✓' : '·';
            dot.title = applied ? 'applied' : 'not applied';
            status.appendChild(dot);
            row.appendChild(status);

            (idx < splitAt ? left : right).appendChild(row);
        });
    },

    _selectedIds: function () {
        var ids = [];
        document.querySelectorAll('.rs-row-cb:checked').forEach(function (cb) {
            ids.push(cb.getAttribute('data-rs-id'));
        });
        return ids;
    },

    _runBatch: function (mode) {
        if (this._inFlight) return;
        var L = this._L;
        var ids = this._selectedIds();
        var self = this;
        if (mode === 'apply') {
            ids = ids.filter(function (id) { return !self._appliedMap[id]; });
        } else {
            ids = ids.filter(function (id) { return !!self._appliedMap[id]; });
        }
        if (!ids.length) {
            var tmpl = mode === 'apply' ? L('RsApplyDoneN') : L('RsRevertDoneN');
            this._toast('info', tmpl.replace('{ok}', 0).replace('{total}', 0));
            return;
        }
        this._inFlight = true;
        Bridge.send(mode === 'apply' ? 'applyRecommendedSettings' : 'revertRecommendedSettings', { ids: ids });
    },

    _onItemResult: function (r) {
        if (!r || !r.id) return;
        if (r.success) {
            this._appliedMap[r.id] = !this._appliedMap[r.id];
            var cb = document.querySelector('.rs-row-cb[data-rs-id="' + r.id + '"]');
            if (cb) {
                var row = cb.closest('.rs-row');
                if (row) {
                    var dot = row.querySelector('.rs-status');
                    if (dot) {
                        if (this._appliedMap[r.id]) {
                            dot.classList.remove('rs-status-off');
                            dot.classList.add('rs-status-on');
                            dot.textContent = '✓';
                        } else {
                            dot.classList.remove('rs-status-on');
                            dot.classList.add('rs-status-off');
                            dot.textContent = '·';
                        }
                    }
                }
            }
        } else if (r.message) {
            this._toast('error', this._L('RsItemApplyFail').replace('{reason}', r.message));
        }
    },

    _onBatchDone: function (d) {
        this._inFlight = false;
        if (!d) return;
        var L = this._L;
        var template = d.mode === 'revert' ? L('RsRevertDoneN') : L('RsApplyDoneN');
        var msg = template.replace('{ok}', d.ok || 0).replace('{total}', d.total || 0);
        this._toast('success', msg);
    },

    _toast: function (level, msg) {
        if (window.Toast && typeof Toast.show === 'function') Toast.show('', msg, level);
        else console.log('[rs toast:' + level + ']', msg);
    }
```

- [ ] **Step 2: Smoke test**

`npm run dev`, open the page via the QuickAccess button or `Bridge.send('openRecommendedSettings')` in the main window DevTools console. Expected:
- Rows populate in both cards
- Items for tools installed on this machine are visible; items for missing tools are hidden
- Already-applied items show unchecked checkbox + green `✓` status dot
- Toggling the master checkbox flips all visible rows

- [ ] **Step 3: Commit**

```bash
git add src/renderer/js/pages/recommended-settings.js
git commit -m "feat(recommended-settings): wire filter, DOM-based row rendering, and batch events"
```

---

## Task 13: Renderer — CSS for `rs-*` classes

**Files:**
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Append styles to `styles.css`**

Append at the end of `src/renderer/styles.css`:

```css
/* ================== Recommended Settings Page ================== */

.rs-page-layout { display: flex; flex-direction: column; height: 100%; }
.rs-page-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
.rs-page-scroll { flex: 1; overflow: auto; padding: 8px 12px; }
.rs-desc { font-size: 12px; color: var(--text-muted); }

.rs-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rs-col-card { margin: 0; }
.rs-list { display: flex; flex-direction: column; gap: 6px; }

.rs-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px; border-radius: 6px; background: var(--bg-elev);
}
.rs-row:hover { background: var(--bg-hover); }
.rs-row-cb { width: 16px; height: 16px; flex-shrink: 0; }
.rs-row-icon { width: 24px; height: 24px; flex-shrink: 0; }
.rs-row-info { flex: 1; min-width: 0; }
.rs-row-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rs-badge {
    display: inline-block; font-size: 10px; font-weight: 600;
    padding: 1px 6px; border-radius: 8px; margin-top: 2px;
    background: var(--bg-muted); color: var(--text-muted);
}
.rs-badge-vscode { background: rgba(36,130,255,0.18); color: #2482ff; }
.rs-badge-alias  { background: rgba(157,102,255,0.18); color: #9d66ff; }
.rs-badge-ctxmenu{ background: rgba(255,176,64,0.18); color: #ffb040; }

.rs-row-status { width: 18px; text-align: center; }
.rs-status-on  { color: #4caf50; font-weight: bold; }
.rs-status-off { color: var(--text-muted); opacity: 0.5; }
```

- [ ] **Step 2: Smoke test**

`npm run dev` → open the Recommended Settings page. Rows should have hover effect, coloured badges (blue/purple/orange), two equal-width cards, green check-marks on applied rows.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/styles.css
git commit -m "feat(recommended-settings): add CSS for rs-* page classes"
```

---

## Task 14: Rewire QuickAccess `wtApplySettings` button

**Files:**
- Modify: `src/renderer/js/app.js` (around lines 185–186 and 1320–1371)
- Modify: `src/main/ipc-handlers.js` (cleanup)
- Modify: `src/main/modules/editor-settings.js` (cleanup)

- [ ] **Step 1: Replace the click handler in `app.js`**

Find:

```js
var wtApplySettings = document.getElementById('wt-apply-settings');
if (wtApplySettings) wtApplySettings.addEventListener('click', function () { self._applyEditorSettings(); });
```

Replace with:

```js
var wtApplySettings = document.getElementById('wt-apply-settings');
if (wtApplySettings) {
    wtApplySettings.setAttribute('title', Bridge.lang('QuickAccessApplySettingsTooltip') || 'Open Recommended Settings page');
    wtApplySettings.addEventListener('click', function () { Bridge.send('openRecommendedSettings'); });
}
```

- [ ] **Step 2: Delete obsolete methods in `app.js`**

Remove the `_applyEditorSettings`, `_showEditorSettingsConfirm`, and `_onEditorSettingsApplied` methods (around line 1320) and any `Bridge.on('editorSettingsApplied', ...)` registration. Confirm:

```bash
grep -n "_applyEditorSettings\|editorSettingsApplied\|_showEditorSettingsConfirm\|_onEditorSettingsApplied" src/renderer/js/app.js
```

Expected: no matches. If any remain, remove them.

- [ ] **Step 3: Remove obsolete IPC handlers and editor-settings imports**

In `src/main/ipc-handlers.js`:
- Delete `handleGetEditorSettings` and `handleApplyEditorSettings` function definitions (if they remain).
- If no code still references `editorSettings`, remove the `const editorSettings = require('./modules/editor-settings')` line.

```bash
grep -n "editorSettings\|editor-settings" src/main/ipc-handlers.js
```

Expected: no matches (except possibly comments to be cleaned up).

In `src/main/modules/editor-settings.js`, remove the now-orphaned exports and internal functions: `applyAllEditorSettings`, `applyBashAliases`, `applyPowerShellAliases`, `applyCmdAliases`, `cleanupPsProfile`, plus the `BASH_ALIASES` and `RECOMMENDED_SETTINGS` constants and `SETTING_LABELS`. Keep `editorInstalled` if it is used elsewhere (check with grep below). If nothing is left exported, delete the entire file.

```bash
grep -rn "require.*editor-settings\|editorInstalled\|applyAllEditorSettings\|BASH_ALIASES\|RECOMMENDED_SETTINGS" src/main/
```

If `editorInstalled` is still referenced outside `editor-settings.js`, keep just that function. Otherwise delete `src/main/modules/editor-settings.js` entirely.

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

Expected: app launches, QuickAccess "Apply IDE Tweaks" button opens the Recommended Settings subwindow (not the old confirmation dialog). Tooltip shows "Open Recommended Settings page".

- [ ] **Step 5: Commit**

```bash
git add src/renderer/js/app.js src/main/ipc-handlers.js src/main/modules/editor-settings.js
git commit -m "refactor(recommended-settings): QuickAccess button opens subpage; remove old editor-settings flow"
```

---

## Task 15: End-to-end smoke — VS Code settings + aliases

**Files:** None modified (verification only).

- [ ] **Step 1: Apply a VS Code setting via the UI**

1. `npm run dev`
2. Open Recommended Settings
3. Uncheck every row except "VS Code — Disable Minimap"
4. Click "Apply Selected"
5. Toast shows "1 of 1 applied"
6. Row flips to `✓ applied`

- [ ] **Step 2: Verify `settings.json`**

```bash
grep -A1 "editor.minimap.enabled" ~/.config/Code/User/settings.json
```

Expected: `"editor.minimap.enabled": false,`

- [ ] **Step 3: Revert via the UI**

1. The minimap row's checkbox is now unchecked (because applied)
2. Check it
3. Open the split dropdown, click "Revert Selected"
4. Toast: "1 of 1 reverted"

```bash
grep "editor.minimap.enabled" ~/.config/Code/User/settings.json
```

Expected: no match.

- [ ] **Step 4: Repeat for an alias**

Apply `ccskip`:

```bash
grep "^alias ccskip=" ~/.bashrc
```

Expected: exactly one line, command matches `claude --dangerously-skip-permissions --effort max`.

Revert, then `grep` should return no match.

- [ ] **Step 5: No commit (verification only)**

If anything fails, go back to the relevant task (4 or 5), fix, re-commit, then rerun this task.

---

## Task 16: End-to-end — Linux Nautilus context menu (Linux+Nautilus machine only)

**Files:** None modified.

- [ ] **Step 1: Apply `ctx-claude` on a machine without python3-nautilus**

```bash
dpkg -s python3-nautilus 2>&1 | head -1
# Expected: "dpkg-query: package 'python3-nautilus' is not installed"
ls ~/.local/share/nautilus-python/extensions/smai-open-ctx-claude.py 2>&1 | head -1
# Expected: "No such file or directory"
```

1. `npm run dev`
2. Open Recommended Settings
3. Check only `ctx-claude` (Open in Claude Code) → Apply Selected
4. `pkexec` prompt appears → enter password
5. Toast: "1 of 1 applied"

- [ ] **Step 2: Verify package + extension file**

```bash
dpkg -s python3-nautilus | grep "^Status"
ls -la ~/.local/share/nautilus-python/extensions/smai-open-ctx-claude.py
ls -la ~/.local/share/smartmarine-ai/icons/claude.png
```

Expected: package installed; `.py` file copied; claude.png icon copied.

- [ ] **Step 3: Verify Nautilus menu**

1. Open Nautilus, navigate to any directory
2. Right-click a folder (or blank area inside a folder) → "Open in Claude Code" appears with Claude icon
3. Click it → gnome-terminal opens in that path, `claude ...` runs

If not appearing immediately, `nautilus -q` and relaunch.

- [ ] **Step 4: Revert**

1. In the page, check `ctx-claude` → Revert Selected

```bash
ls ~/.local/share/nautilus-python/extensions/smai-open-ctx-claude.py 2>&1 | head -1
# Expected: "No such file or directory"
```

Nautilus should no longer show the entry (may require `nautilus -q`). The
`python3-nautilus` system package remains installed (intentional).

- [ ] **Step 5: If any step failed**

Go back to Task 7 (linux-nautilus.js) or Task 9 (orchestrator), fix, re-commit.

---

## Task 17: End-to-end — Windows context menu (Windows machine only)

**Files:** None modified.

- [ ] **Step 1: Apply `ctx-claude`**

1. On a Windows machine with Claude CLI installed, run the app (packaged or `npm run dev`)
2. Open Recommended Settings
3. Check `ctx-claude` → Apply Selected
4. Toast: "1 of 1 applied"

- [ ] **Step 2: Verify registry**

```powershell
reg query "HKCU\Software\Classes\Directory\shell\SmaiOpenctx-claude"
reg query "HKCU\Software\Classes\Directory\Background\shell\SmaiOpenctx-claude"
```

Expected: both queries return key contents (default value = "Open in Claude Code", Icon path present, `\command` subkey contains cmdline).

- [ ] **Step 3: Verify menu**

Right-click a folder in Explorer → (Win11) "Show more options" → "Open in Claude Code" appears with icon. Click → cmd.exe opens at that path, `claude` runs.

- [ ] **Step 4: Revert**

1. Check `ctx-claude` in UI → Revert Selected
2. `reg query` should fail with "ERROR: unable to find the specified registry key"

- [ ] **Step 5: If any step failed**

Go back to Task 6 (windows.js), fix, re-commit.

---

## Task 18: Filter logic verification — hide unsupported items

**Files:** None modified.

- [ ] **Step 1: VS Code absent**

Simulate "no VS Code" on Linux by hiding the binary:

```bash
which code
sudo mv /usr/bin/code /usr/bin/code.disabled || true
```

`npm run dev` → open Recommended Settings. Expected:
- All 6 VS Code setting rows absent
- `ctx-vscode` absent
- VS Code-unrelated items (aliases, Claude/Codex context menus) still visible

Restore:

```bash
sudo mv /usr/bin/code.disabled /usr/bin/code || true
```

- [ ] **Step 2: Non-Nautilus FM**

```bash
xdg-mime default org.kde.dolphin.desktop inode/directory
```

Open Recommended Settings. Expected: all `ctx-*` rows absent; VS Code settings + aliases still present.

Restore:

```bash
xdg-mime default org.gnome.Nautilus.desktop inode/directory
```

- [ ] **Step 3: No commit (verification only)**

If the filter fails, in the page's DevTools console run `Bridge.send('getRecommendedSettings')` and inspect the event payload to debug.

---

## Task 19: Final cleanup

**Files:**
- Modify: `docs/superpowers/plans/2026-04-14-recommended-settings.md` (this plan)

- [ ] **Step 1: Tick all completed checkboxes**

In this plan file, flip every `- [ ]` to `- [x]` for each task's steps that were successfully completed.

- [ ] **Step 2: Search for lingering references**

```bash
grep -rn "applyAllEditorSettings\|_applyEditorSettings\|getEditorSettings\|applyEditorSettings" src/
```

Expected: no matches.

- [ ] **Step 3: Final UI walkthrough**

- `npm run dev`
- Click "Apply IDE Tweaks" → page opens
- Check every visible item → Apply Selected → all succeed, badges flip to ✓
- Close the page, reopen → all checkboxes now unchecked (because applied), badges show ✓
- Check every applied item → Revert Selected → all revert; badges flip back to `·`
- Close and reopen → all checkboxes checked again (because none applied)

- [ ] **Step 4: Commit plan tick-off**

```bash
git add docs/superpowers/plans/2026-04-14-recommended-settings.md
git commit -m "docs(recommended-settings): mark implementation plan complete"
```

---

## Rollout note

After merge, the QuickAccess "Apply IDE Tweaks" button changes behaviour: instead of applying all recommendations in one click, it opens the Recommended Settings page where the user picks items. Announce this in release notes and/or an in-app banner (outside scope of this plan).
