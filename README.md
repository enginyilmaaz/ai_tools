# AI Tool

Electron desktop application for managing development tools, Claude Code skills, and MCP servers with a graphical interface.

## Project Structure

- `src/main` — Electron main process, preload, IPC handlers, and platform modules
- `src/renderer` — Renderer UI, pages, assets, and static docs
- `src/config` — Runtime constants and all language files
- `src/skills` — Claude skills git submodule used by the installer and bundled builds

## Features

### Main Window
- **System Info** — Live system dashboard (OS, CPU usage, RAM, disk, uptime) with real-time updates every 3 seconds. Click uptime row to toggle between uptime and boot time.
- **Quick Access** — One-click shortcuts to Dev Tools, IDE Tweaks, Skills, MCP & Plugins, and Best Practices pages

### Dev Tools (Subwindow)
- **Tool Management** — Detect, install, and uninstall core dev tools (Node.js/NVM, Git, Claude CLI, Codex CLI, VS Code, extensions, Claude Desktop, Codex App) with table layout
- **Single UAC** — Windows installs use a single elevated batch script (one admin prompt for all tools)
- **Silent Install** — All installers run silently in the background with per-tool progress (Queued → Installing → Installed)
- **Internet Check** — Verifies connectivity before starting downloads
- **Split Button** — Install Selected / Remove Selected with dropdown toggle

### Skills (Subwindow)
- **Skills Catalog** — Browse and install general-purpose Claude Code skills from a two-column layout
- **Skills Guide** — Detailed documentation for each skill with search, examples, and auto-trigger info
- **Dual Target** — Install to Claude or Codex with split dropdown button

### MCP & Plugins (Subwindow)
- **MCP Servers** — Install, configure, and remove MCP servers (Postman, Atlassian, GitHub, PostgreSQL, Figma)
- **Plugins** — Install and remove Claude Code plugins (Superpowers, Playwright, TypeScript LSP, etc.)
- **Icon-only Actions** — Compact per-row buttons with tooltip labels

### Platform Support
- **Windows** — winget, direct download fallbacks, NVM setup.exe, GitHub API-resolved URLs
- **Linux** — apt/dpkg with pkexec elevation, NVM via curl install script
- **Rounded Corners** — Transparent frameless windows with 8px border-radius

### General
- **Multi-language** — Full English and Turkish UI with runtime language switching
- **Theming** — Dark, light, and system-auto theme modes
- **Logs Panel** — Collapsible log viewer in the footer bar with copy support
- **Instant Launch** — App opens immediately with a loading spinner; heavy initialization runs asynchronously

## Requirements

- Node.js 20+
- Yarn 1.x
- Git

## Development

```bash
git clone --recurse-submodules https://github.com/enginyilmaaz/ai_tools.git
cd ai_tools
yarn install --frozen-lockfile
yarn start
```

## Build

Windows installer + portable:

```powershell
yarn build:win
```

Windows portable only:

```powershell
yarn build:win:portable
```

Linux `.deb`:

```bash
yarn build:linux
```

Linux AppImage:

```bash
yarn build:standalone
```

## Tech Stack

- Electron 33
- HTML / CSS / JavaScript (vanilla, no framework)
- electron-builder

## Notes

- `src/skills` is a git submodule — clone with `--recurse-submodules`.
- All visible UI strings live under `src/config/languages`.
- On Linux, sudo sessions are cached per app session via a temporary sudoers entry (cleaned up on exit).
- On Windows, all elevated installs run in a single UAC-approved batch script (no per-tool admin prompts).
- Claude CLI uninstall follows the [official method](https://code.claude.com/docs/en/setup#uninstall-claude-code) — removes `~/.local/bin/claude` and `~/.local/share/claude`, with npm fallback.
