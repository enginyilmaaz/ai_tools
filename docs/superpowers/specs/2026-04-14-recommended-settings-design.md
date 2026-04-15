# Recommended Settings Page — Design Spec

**Date:** 2026-04-14
**Status:** Design approved, pending implementation plan
**Target:** `smartmarine_ai_app` (Electron 33.4.11, cross-platform Win/Linux)

## Summary

Convert the existing one-shot "Apply IDE Tweaks" QuickAccess action into a full
**Recommended Settings** subpage modelled after the existing MCP/Plugins page.
The page presents three groups of items as a single flat checkbox list (split
across left/right cards) and exposes them through unified **Apply Selected** /
**Revert Selected** buttons:

1. **VS Code Settings** (6 items) — granular per-key apply/revert
2. **Shell Aliases** (4 items) — `ccskip`, `claude-skip`, `cxskip`, `codex-skip`
3. **Context Menus** (3 items) — right-click "Open in Claude Code", "Open in
   Codex CLI", "Open in VS Code" in the OS file manager

Items are hidden from the list when the underlying tool is not installed, and
context-menu items are additionally hidden on Linux when the detected file
manager is not Nautilus.

macOS is out of scope for v1.

---

## 1. Data Model

Single source of truth: `_allItems[]` inside
`src/renderer/js/pages/recommended-settings.js` (mirrors the MCP page's
`_allIntegrations[]`).

Each item has the shape:

```js
{
  id:        'stable-unique-id',
  group:     'vscode' | 'alias' | 'ctxmenu',
  nameKey:   'RsXxx',               // i18n key
  requires:  ['vscode'|'claude'|'codex'|'ctxmenuSupported', ...],
  kind:      'vscodeSetting' | 'alias' | 'ctxmenu',
  payload:   { ...kind-specific }
}
```

### Registry (13 items)

**Group: VSCode Settings** (`requires: ['vscode']`, kind: `vscodeSetting`)

| id | VS Code key | recommended value |
|---|---|---|
| `vs-skip-perms` | `claudeCode.allowDangerouslySkipPermissions` | `true` |
| `vs-perm-mode` | `claudeCode.initialPermissionMode` | `'bypassPermissions'` |
| `vs-git-autofetch` | `git.autofetch` | `true` |
| `vs-minimap-off` | `editor.minimap.enabled` | `false` |
| `vs-sticky-off` | `terminal.integrated.stickyScroll.enabled` | `false` |
| `vs-chat-ai-off` | `chat.disableAIFeatures` | `true` |

**Group: Aliases** (kind: `alias`)

| id | requires | name | command (expansion) |
|---|---|---|---|
| `alias-ccskip` | `['claude']` | `ccskip` | `claude --dangerously-skip-permissions --effort max` |
| `alias-claude-skip` | `['claude']` | `claude-skip` | `claude --dangerously-skip-permissions --effort max` |
| `alias-cxskip` | `['codex']` | `cxskip` | `codex --sandbox danger-full-access -c model_reasoning_effort="xhigh"` |
| `alias-codex-skip` | `['codex']` | `codex-skip` | `codex --sandbox danger-full-access -c model_reasoning_effort="xhigh"` |

**Group: Context Menus** (kind: `ctxmenu`)

| id | requires | label | runCmd (full expansion, not alias) |
|---|---|---|---|
| `ctx-claude` | `['claude','ctxmenuSupported']` | `Open in Claude Code` | `claude --dangerously-skip-permissions --effort max` |
| `ctx-codex` | `['codex','ctxmenuSupported']` | `Open in Codex CLI` | `codex --sandbox danger-full-access -c model_reasoning_effort="xhigh"` |
| `ctx-vscode` | `['vscode','ctxmenuSupported']` | `Open in VS Code` | `code .` (or `code "%V"` on Windows) |

### Capability detection

Main process emits the following structure on page open:

```js
{
  vscode: editorInstalled('vscode'),
  claude: binaryInstalled('claude'),
  codex:  binaryInstalled('codex'),
  platform: process.platform,
  fileManager: process.platform === 'linux' ? detectLinuxFM() : null,
  ctxmenuSupported:
    process.platform === 'win32' ||
    (process.platform === 'linux' && detectLinuxFM() === 'nautilus'),
  actionsForNautilusInstalled: isActionsForNautilusInstalled()
}
```

**Filter rule:** an item is rendered in the list iff every key in `requires[]`
is truthy in the capability map. Otherwise it is omitted entirely (not greyed
out).

`detectLinuxFM()` strategy, in order:
1. `xdg-mime query default inode/directory` → parse return (expect
   `org.gnome.Nautilus.desktop`)
2. Fallback: `$XDG_CURRENT_DESKTOP` contains `GNOME`
3. Fallback: `which nautilus` succeeds

Returns one of: `'nautilus' | 'dolphin' | 'thunar' | 'nemo' | null`.

### Already-applied detection (per item)

Read from the authoritative source at render time, no separate state file:

- `vscodeSetting`: parse `settings.json`, compare key presence + value equality
- `alias` (Linux): `.bashrc` contains `alias <name>='<cmd>'` line
- `alias` (Windows): `%USERPROFILE%\.local\bin\<name>.cmd` exists with
  matching content
- `ctxmenu` (Windows): `reg query HKCU\Software\Classes\Directory\shell\SmaiOpen<X>`
  exits 0
- `ctxmenu` (Linux): file `~/.local/share/nautilus-python/extensions/smai-open-<x>.py` exists

---

## 2. UI Layout

The page loads inside an Electron SubWindow (same mechanism as
`mcp-servers.js`) with the following structure:

```
┌─ [icon] Recommended Settings                                 ─┐
│                                                               │
│  [description paragraph]                                      │
│                                                               │
│  [☐] Select All / None                                        │
│                                                               │
│  ┌─ CARD (LEFT) ─────────┐  ┌─ CARD (RIGHT) ────────┐         │
│  │ ☑ [vs] Skip Perms  VS │  │ ☑ [cx] cxskip      AL │         │
│  │ ☑ [vs] Perm Mode   VS │  │ ☑ [cx] codex-skip  AL │         │
│  │ ☑ [vs] Git Autof.  VS │  │ ☑ [cc] Open Claude CM │         │
│  │ ☑ [vs] Minimap     VS │  │ ☑ [cx] Open Codex  CM │         │
│  │ ☑ [vs] Sticky      VS │  │ ☑ [vs] Open VSCode CM │         │
│  │ ☑ [vs] Chat AI     VS │  │                       │         │
│  │ ☑ [cc] ccskip      AL │  │                       │         │
│  └───────────────────────┘  └───────────────────────┘         │
│                                                               │
│                    [↓ Apply Selected ▼]   [Close]             │
│                       └─ Revert Selected ─┘                   │
└───────────────────────────────────────────────────────────────┘
```

### Differences from MCP page (cloned template)

| Element | MCP page | Recommended Settings page |
|---|---|---|
| Guide button | Present (`mcp-guide-btn`) | **Removed** |
| Two-column cards | `mcp-two-col` | `rs-two-col` (same CSS, new class) |
| Split of items L/R | `splitAt = 6` (hardcoded) | `splitAt = Math.ceil(visibleItems.length / 2)` |
| Row action buttons | Install / Remove / Edit per row | **None** (single channel: Apply/Revert Selected) |
| Type badge | `plugin` / `MCP` | `VS` / `AL` / `CM` with distinct colours |
| Primary button | `Install Selected` | `Apply Selected` |
| Dropdown item | `Remove Selected` | `Revert Selected` |

### Initial checkbox state

Mirrors MCP page convention:
- **Applied items:** checkbox **unchecked** (so user's default "Apply Selected"
  action targets not-yet-applied items)
- **Not-applied items:** checkbox **checked**

Applied items are visually distinguished by a muted/greyed row or check-mark
badge next to the name.

### Select All / None toggle

Only affects **visible** (filtered) items. Hidden items are never toggled.

### QuickAccess change

- The existing `wtApplySettings` button (`QuickAccessApplySettings`) no longer
  calls `_applyEditorSettings()` directly. Instead it opens the Recommended
  Settings subpage.
- No "Revert All" button added to QuickAccess — users may Select All + Revert
  Selected on the page to achieve the same effect.

---

## 3. Main Process Modules & IPC

### New file tree

```
src/main/modules/
├── recommended-settings/
│   ├── index.js                    # orchestrator: item registry + dispatch
│   ├── detect.js                   # capability detection
│   ├── vscode-settings.js          # per-key VS Code settings apply/revert
│   ├── aliases.js                  # per-alias bashrc/cmd apply/revert
│   └── context-menus/
│       ├── index.js                # platform dispatcher
│       ├── windows.js              # HKCU .reg writes + delete
│       └── linux-nautilus.js       # python3-nautilus install + .py copy/remove
└── platform/ (unchanged; editor-settings.js refactored)
```

### `editor-settings.js` refactor

The existing `applyAllEditorSettings()` orchestration is **removed**. Per-key
and per-alias functions are exported:

- `applyVscodeSetting(key, value)` / `revertVscodeSetting(key)`
- `applyAlias(name, command)` / `revertAlias(name)`
- `isVscodeSettingApplied(key, value)` / `isAliasApplied(name, command)`
- Existing exports `editorInstalled`, `getSettingsPaths` retained.

### IPC contract

New bridge-message cases in `ipc-handlers.js`:

| Request case | Payload | Response event(s) |
|---|---|---|
| `getRecommendedSettings` | – | `recommendedSettingsStatus` `{ capabilities, items: [{id, alreadyApplied}] }` |
| `applyRecommendedSettings` | `{ ids: string[] }` | `recommendedSettingResult {id, success, message}` per item + `recommendedSettingsBatchDone {ok, total}` |
| `revertRecommendedSettings` | `{ ids: string[] }` | same shape as apply |
| `installActionsForNautilus` | – | `actionsForNautilusInstallResult {success, message}` |

Results are emitted per-item so the renderer can update each row's badge live.
Items within one batch are processed **sequentially** (not in parallel) so the
UI can surface progress coherently and `pkexec` prompts do not stack.

### QuickAccess button wiring

The existing `wtApplySettings` click handler in `app.js` currently calls
`_applyEditorSettings()` directly. Replace the body with an IPC call to open
the new subpage (re-using the same SubWindow mechanism as MCP/Plugins). The
`_applyEditorSettings()` renderer function is deleted along with its
`getEditorSettings` + `applyEditorSettings` IPC cases in `ipc-handlers.js`
(the per-key functions replace it).

### Context-menu item apply flow — Windows

1. Copy icon to `%APPDATA%\smartmarine-ai\icons\<name>.ico` (from app
   resources, if not already present).
2. `reg.exe add HKCU\Software\Classes\Directory\shell\SmaiOpen<X> /ve /d "Open in ..." /f`
3. `reg.exe add .../SmaiOpen<X> /v Icon /d "<icon path>" /f`
4. `reg.exe add .../SmaiOpen<X>\command /ve /d "<cmdline>" /f`
5. Repeat steps 2–4 under `Directory\Background\shell\SmaiOpen<X>` so the
   action also appears when right-clicking the blank area of an open folder.

No UAC prompt required (HKCU). VS Code runCmd uses `code "%V"`; Claude/Codex
use `cmd.exe /k pushd "%V" && <full command>`.

### Context-menu item apply flow — Linux (Nautilus)

We do not bundle or ship `actions-for-nautilus`. Instead we ship our own
minimal Python extensions (one file per action, ~40 lines) that depend only
on the standard Debian/Ubuntu package `python3-nautilus`.

1. If `!pythonNautilusInstalled()`, emit `pythonNautilusNeedInstall`.
   Renderer shows confirm modal (`RsPyNautilusNeedInstall`). On consent:
   `pkexec apt install -y python3-nautilus`.
2. Copy our bundled Python extension template for this action from app
   resources (`src/renderer/assets/recommended-settings/nautilus/smai-open-<x>.py`)
   to `~/.local/share/nautilus-python/extensions/smai-open-<x>.py`.
3. Copy icon to `~/.local/share/smartmarine-ai/icons/<brand>.png`.
4. Run `nautilus -q` to reload Nautilus so the extension is picked up.

The Python extension template (one per action) looks like:

```python
#!/usr/bin/env python3
import os, subprocess
from gi.repository import Nautilus, GObject

CMD   = 'claude --dangerously-skip-permissions --effort max'
LABEL = 'Open in Claude Code'
ICON  = os.path.expanduser('~/.local/share/smartmarine-ai/icons/claude.png')

class SmaiOpenClaude(GObject.GObject, Nautilus.MenuProvider):
    def _item(self, target_path):
        mi = Nautilus.MenuItem(
            name='SmaiOpenClaude', label=LABEL,
            tip='', icon='file://' + ICON if os.path.exists(ICON) else ''
        )
        mi.connect('activate', self._run, target_path)
        return mi

    def _run(self, _mi, path):
        subprocess.Popen([
            'gnome-terminal', '--working-directory=' + path, '--',
            'bash', '-lc', CMD + '; exec bash'
        ])

    def get_file_items(self, files):
        if not files: return []
        f = files[0]
        if not f.is_directory(): return []
        return [self._item(f.get_location().get_path())]

    def get_background_items(self, folder):
        return [self._item(folder.get_location().get_path())]
```

Each of the three actions (`claude`, `codex`, `vscode`) has its own file
with a unique class name (`SmaiOpenClaude`, `SmaiOpenCodex`, `SmaiOpenVscode`)
and hardcoded `CMD` / `LABEL` / `ICON`. The VS Code variant uses
`subprocess.Popen(['code', path])` instead of a terminal wrapper because
`code` is a GUI launcher.

Failure modes:
- `pkexec` missing or user denied → item apply fails with
  `RsPyNautilusInstallFail` toast, other selected items continue.
- `apt install` error → same.

### Context-menu item revert flow

**Windows:** `reg.exe delete HKCU\Software\Classes\Directory\shell\SmaiOpen<X> /f`
plus `...\Directory\Background\shell\SmaiOpen<X> /f`.

**Linux:** `rm ~/.local/share/nautilus-python/extensions/smai-open-<x>.py` and
run `nautilus -q`. The `python3-nautilus` system package is **not**
uninstalled (keep idempotent — the user may re-apply later).

---

## 4. Icon Assets & Nautilus Extensions

Shipped in the app repo once (all under `src/renderer/assets/recommended-settings/`):

```
src/renderer/assets/recommended-settings/
├── claude.svg                   # used by renderer row rendering
├── codex.svg
├── vscode.svg
├── platform/
│   ├── claude.ico               # Windows context menu
│   ├── claude.png               # Linux context menu (referenced by .py)
│   ├── codex.ico
│   ├── codex.png
│   ├── vscode.ico
│   └── vscode.png
└── nautilus/
    ├── smai-open-claude.py      # Nautilus-Python extension (one class)
    ├── smai-open-codex.py
    └── smai-open-vscode.py
```

All files ship via the existing `package.json` `"files": ["src/**/*"]`
glob — **no change to electron-builder config, no change to the GitHub
Actions workflow `.github/workflows/release-build.yml`** is required.

On apply, `.ico` / `.png` / `.py` are copied to user-stable locations:

- Windows: `%APPDATA%\smartmarine-ai\icons\<name>.ico`
- Linux icons: `~/.local/share/smartmarine-ai/icons/<name>.png`
- Linux extensions: `~/.local/share/nautilus-python/extensions/smai-open-<x>.py`

---

## 5. Revert Edge Cases

| Scenario | Behaviour |
|---|---|
| VS Code setting revert, user manually changed value | Delete the key outright. Prior manual value is **not** restored. |
| Alias revert, user edited `.bashrc` manually | Only remove a line that matches `alias <name>='<exact our cmd>'`. If user changed the command, leave it alone. |
| Context-menu revert, `config.json` corrupt | Log and skip, toast warning. |
| `python3-nautilus` package uninstall | Not performed on revert. Keep the system package idempotent; remove only our `.py` file. |
| VS Code uninstalled between apply and revert | Filter hides the item; config entry remains orphaned. Acceptable (rare case, trivially cleanable by re-apply-then-revert after re-install). |
| `pkexec` missing on minimal Linux | `isActionsForNautilusInstalled()` stays false; user is shown message to install the package manually. |

---

## 6. i18n Keys

New keys added to `src/config/languages/en.json` and `tr.json` (subset — full
list in Section 5 of brainstorm, reproduced here for the spec):

```
RsTitle, RsDescription, RsBadgeVscode, RsBadgeAlias, RsBadgeCtxMenu,
RsVsSkipPerms, RsVsPermMode, RsVsGitAutofetch, RsVsMinimap, RsVsSticky,
RsVsChatAi,
RsAliasCcskip, RsAliasClaudeSkip, RsAliasCxskip, RsAliasCodexSkip,
RsCtxClaude, RsCtxCodex, RsCtxVscode,
RsApplySelected, RsRevertSelected, RsSelectAll, RsSelectNone,
RsApplyingNProgress, RsApplyDoneN, RsRevertDoneN, RsItemApplyFail,
RsPyNautilusNeedInstall, RsPyNautilusInstalling, RsPyNautilusInstallFail, RsPyNautilusRestart
```

`QuickAccessApplySettings` (existing) is retained; add
`QuickAccessApplySettingsTooltip` → "Open Recommended Settings page".

---

## 7. Test Strategy

No automated test infrastructure is added as part of v1 (project does not
currently have renderer-level E2E; spinning that up is out of scope).

**Manual test matrix** — executed before release:

### Linux (Ubuntu 24, GNOME 46, Nautilus)

- [ ] VS Code not installed → VS Code rows hidden; context-menu `Open in VS Code` hidden
- [ ] Claude not installed → `ccskip`, `claude-skip`, `ctx-claude` hidden
- [ ] Codex not installed → `cxskip`, `codex-skip`, `ctx-codex` hidden
- [ ] Nautilus not default FM (e.g. user switched to Dolphin on GNOME) → all `ctx-*` rows hidden
- [ ] `python3-nautilus` not installed → apply any ctx item shows install modal; pkexec prompt; installs; `.py` extension copied; entry visible in Nautilus after restart
- [ ] Apply Selected → per-row badge updates; toast shows `N/M applied`
- [ ] Revert Selected → the `smai-open-<x>.py` file removed from extensions dir; Nautilus reload shows entry gone
- [ ] Other user-installed Nautilus extensions are untouched (only `smai-open-*.py` files are managed)
- [ ] `.bashrc` alias lines inserted cleanly; revert only removes exact matches
- [ ] VS Code settings applied by key only; other user keys preserved

### Windows 10 & 11

- [ ] `.reg` write to HKCU (no UAC prompt)
- [ ] Right-click on folder → "Open Claude Code" appears (under "Show more options" on Win11)
- [ ] Right-click on folder blank area → same entry appears
- [ ] Click → `cmd.exe` opens in that folder and runs full expanded command
- [ ] Revert → `reg query` returns no key; menu entry gone
- [ ] Missing VS Code/Claude/Codex → corresponding rows hidden
- [ ] Icon displays correctly in context menu

---

## 8. Out of Scope (v1)

- macOS context menus (Services / Automator Quick Action) — tracked as follow-up
- VS Code Insiders / VSCodium detection (only stock `code`)
- User-customisable alias names or commands (4 aliases hardcoded)
- User-customisable context-menu labels (3 labels hardcoded)
- Automated E2E tests
- Linux file managers other than Nautilus (Dolphin/Thunar/Nemo)
- Non-Debian Linux distributions for `python3-nautilus` installation via apt
  (Fedora/Arch users must install the equivalent package manually; apply
  fails gracefully with an install-hint toast)
- Reverting to a prior VS Code setting value (revert deletes the key only)

---

## 9. Open Questions

None remaining — all ambiguities resolved during brainstorm. Proceed to
implementation plan.
