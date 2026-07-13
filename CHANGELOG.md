# Changelog

<!-- changelog-entries:start -->
## v2.0.14 - 2026-07-13
- feat: Global Claude Rules manager — a new "Global Rules" window that merges individual `## rule` sections into the global instruction files (`~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`); install merges a rule's section idempotently, remove strips it, and per-target badges show which rules are already present
- feat: bundle the public `enginyilmaaz/ai_rules` repo as the new `src/rules` submodule (manifest.json + preamble.md + rules/<id>.md) so adding or editing a rule is a repo edit with no app rebuild
- chore: sync upstream 5b11a76..9b705d8 — point src/rules at the canonical public `enginyilmaaz/ai_rules`; skipped the vfd skill (SmartMarine-specific) and kept the fork's own `docs/`

## v2.0.13 - 2026-07-13
- feat: in-app auto-update via GitHub Releases — About-page "Check for Updates" with inline status and an update dialog; on Linux the `.deb` self-installs with a runtime sudo password (never stored) and the app relaunches itself, other platforms open the releases page
- feat: Ponytail plugin — custom marketplace support in the MCP & Plugins catalog
- security: validate plugin id / installId / marketplace against a strict allowlist before any shell exec during plugin install
- chore: drop hookify, learning-output-style, csharp-lsp, microsoft-docs, and postgres from the MCP & Plugins catalog (mirrors upstream)
- chore: sync upstream f13e9af..5b11a76 — skipped the Global Claude Rules manager (depends on a private sm_ai_rules repo with no public counterpart), the vfd skill (SmartMarine-specific), and the sm_ai_skills submodule bumps (this fork ships its own general_ai_skills)

## v2.0.12 - 2026-06-20
- feat: add coding-conventions skill to the general catalog — proactively applies coding standards while writing code; placed right after code-review as its proactive twin (Linux + Windows catalogs, EN/TR strings, skill-usage page)
- chore: bump src/skills submodule 2feed0e -> 8ae9bc3 — adds coding-conventions, syncs code-review, removes general-coding (never exposed in the catalog), strips SmartMarine references

## v2.0.11 - 2026-06-20
- feat: MCP/Plugin catalog gains 13 new general entries (context7, sentry, csharp-lsp, microsoft-docs, mcp-server-dev, learning-output-style, session-report, chrome-devtools-mcp, playground, hookify, ralph-loop, claude-md-management, feature-dev) — _allIntegrations rows, EN+TR guide chapters, and placeholder monogram icons
- feat: deb postinst kills the old running instance (build/deb-after-install.sh via deb.afterInstall) so an upgrade immediately serves the fresh asar and bundled skills
- chore: sync upstream 4bff5d9..f13e9af — skipped dm/sp catalog guides and the sm_ai_skills submodule bumps (not applicable to this general-only fork; general_ai_skills submodule already current)

## v2.0.10 - 2026-04-22
- refactor: drop jira-api and playwright skills from the general catalog (both removed downstream); trim HOOK_SKILL_MAP and i18n accordingly
- chore: bump src/skills submodule — removes jira-api/playwright skills and trims hooks.json to COMMIT/ANALYZE/OPTIMIZE/CODE_REVIEW

## v2.0.9 - 2026-04-22
- fix: removeSkills returns results array (no more "Cannot read properties of undefined" crash); hook cleanup now matches by code OR canonical command text (normalizes `else {} end` → `else empty end`) so stale entries without a code property are also removed
- feat: reinstate auto-trigger hooks on skill install — installHooksForSkills upserts by code or command; handleInstallSkills calls install (not remove) so enabling a skill gives the user its trigger hook back

## v2.0.8 - 2026-04-17
- refactor: stop auto-installing hooks on skill install; on install clean up any previously-installed hook entries instead (matched by hook `code`); uninstall behavior unchanged

## v2.0.7 - 2026-04-15
- feat: Recommended Settings subpage replaces editor-settings flow — per-key VS Code apply/revert, per-alias bash/cmd, Windows HKCU context-menu writer, Linux Nautilus context-menu (python3-nautilus) with restart support
- feat: Nautilus context menu integration — claude/codex/vscode entries with theme icons, bash -ic profile sourcing, subwindow restore after restart, PID-based kill with pkexec restart
- perf: disable GPU compositing on Windows/macOS when running inside a VM (VMware/VirtualBox/Hyper-V/Parallels/QEMU)

## v2.0.6 - 2026-04-06
- feat: plugin install checks Claude CLI login status, opens terminal for login, auto-retries after 10 seconds

## v2.0.5 - 2026-04-06
- fix: Claude Desktop/Codex App detection via winget install and AppxPackage
- fix: Claude Desktop detection via Squirrel + AppxPackage + winget
- fix: NVM install via winget --override VERYSILENT, nvm off not deactivate
- fix: npm not found for Codex CLI, increase detection timeouts

## v2.0.4 - 2026-04-06
- fix: Claude Desktop/Codex App detection via process list and Get-AppxPackage with version
- fix: NVM for Windows path detection improvements

## v2.0.3 - 2026-04-06
- fix: Node.js detection via nvm current, remove PS profile (security error)
- fix: install detection retry 3→5 with PATH inject, add ccskip alias
- fix: shell alias display — proper section names, cleaner labels
- feat: add CMD aliases on Windows alongside PowerShell

## v2.0.2 - 2026-04-06
- ci: update GitHub Actions workflow asset slug to ai-tool

## v2.0.1 - 2026-04-06
- Initial release — forked from smartmarine_ai_app, rebranded to AI Tool
- refactor: remove all SmartMarine/ERP references, keep only general-purpose skills
- refactor: remove project-scanner module (no longer needed without ERP detection)
- refactor: simplify skills catalog to general skills only (analyze, code-review, optimize, commit, jira-api, s3-download, playwright, fullstack-scaffold, nodejs-backend-scaffold, nextjs-frontend-scaffold)
- refactor: simplify skills UI — single category, two-column layout, no requirement checks
- refactor: clean skill-usage guide and i18n — remove all ERP skill entries and descriptions
- refactor: update package.json, about page, window titles, icons, and user-agent strings
- feat: new app icons for light and dark themes
- feat: add .source file to track upstream sync point

---

## Pre-fork history (smartmarine_ai_app)

## v1.0.138 - 2026-04-02
- remove: completely remove Cursor IDE support

## v1.0.137 - 2026-03-31
- fix: centralize Linux elevated installs behind a shared pkexec/sudo wrapper
- feat: install VS Code on Ubuntu via official apt repository

## v1.0.136 - 2026-03-31
- fix: install Node.js via apt first on Linux, fallback to nvm if apt fails
- fix: terminal collapse toggle

## v1.0.135 - 2026-03-31
- fix: remove pkexec pre-auth to avoid double password prompt
- feat: add install dependency checks
- feat: add terminal logging for MCP server and Skills operations

## v1.0.134 - 2026-03-31
- fix: use native polkit dialog (pkexec) for Linux elevated installs
- feat: show detailed error messages when tool installations fail

## v1.0.133 - 2026-03-31
- feat: add apt repository setup step before Linux installs

## v1.0.132 - 2026-03-31
- feat: add in-app sudo password dialog for Linux installs

## v1.0.131 - 2026-03-31
- fix: prompt for sudo password once via pkexec before Linux installs

## v1.0.130 - 2026-03-31
- fix: auto-open terminal panel during check and install

## v1.0.129 - 2026-03-31
- fix: hide unavailable tools from install list

## v1.0.128 - 2026-03-31
- refactor: remove the extra install step, start installation directly from main screen

## v1.0.127 - 2026-03-31
- fix: improve Skills subwindow responsiveness and generate Linux desktop launchers

## v1.0.126 - 2026-03-31
- refactor(ci): consolidate release automation into a single Build and Release workflow

## v1.0.125 - 2026-03-31
- fix(ci): align release workflows with semver flow

## v1.0.124 - 2026-03-31
- fix(ci): fetch private skills submodule via SKILLS_REPO_TOKEN

## v1.0.123 - 2026-03-31
- refine: use normal font weight for Skills command chips

## v1.0.122 - 2026-03-31
- refine: reorder Skills action buttons

## v1.0.121 - 2026-03-30
- refactor: tighten Skills dialog spacing, restore side-by-side cards

## v1.0.120 - 2026-03-30
- feat: add jira-api and s3-download to general Skills catalog
- refactor: move bundled skills submodule to src/skills

## v1.0.119 - 2026-03-30
- feat: add separate Claude and Codex skill install actions with prerequisite checks

## v1.0.118 - 2026-03-30
- feat: filter Skills catalog by detected repositories
- fix: move Atlassian/PostgreSQL MCP setup to user scope

## v1.0.117 - 2026-03-30
- fix: dark-mode window frame separation

## v1.0.116 - 2026-03-30
- fix: dark app icon variant and GitHub icon visibility in dark mode

## v1.0.115 - 2026-03-30
- refactor: align subwindow theme tokens, titlebar controls, and dark-mode app icons

## v1.0.114 - 2026-03-30
- fix: sync theme and language changes across all open windows

## v1.0.113 - 2026-03-30
- fix: restore MCP edit modal prefills, add integration icon

## v1.0.112 - 2026-03-30
- fix: streamline PostgreSQL MCP edit/install actions

## v1.0.111 - 2026-03-30
- fix: use bundled pg client for PostgreSQL test connection

## v1.0.110 - 2026-03-30
- fix: switch Postman MCP installation to official remote OAuth server

## v1.0.109 - 2026-03-30
- fix: keep MCP server cards side by side

## v1.0.108 - 2026-03-30
- refactor: remove legacy platform shim modules
- build: add Linux build-and-install flow

## v1.0.107 - 2026-03-29
- refactor: split platform modules into core, linux, and windows layers
- feat: refine Skills catalog layout and selection flow

## v1.0.106 - 2026-03-26
- feat: add MCP Servers page with GitHub, PostgreSQL, Postman, Jira, Figma integration

## v1.0.105 - 2026-03-25
- feat: add analyze, code-review, optimize skills

## v1.0.104 - 2026-03-25
- feat: add Skill Usage page with per-skill documentation, search, and pagination

## v1.0.103 - 2026-03-25
- docs: collapsible README screenshots

## v1.0.102 - 2026-03-24
- feat: add README screenshots

## v1.0.101 - 2026-03-24
- Restore portable release asset with stable filenames

## v1.0.100 - 2026-03-24
- Simplify step 3 completion messaging

## v1.0.99 - 2026-03-24
- Simplify step 3 completion messaging

## v1.0.98 - 2026-03-24
- Exclude all locale folders from setup payload

## v1.0.97 - 2026-03-24
- Limit languages and generate lang json files

## v1.0.96 - 2026-03-24
- Use multi-file setup payload and externalize resources

## v1.0.95 - 2026-03-24
- Add exit option and fix post install launch

## v1.0.94 - 2026-03-24
- Switch setup packaging from NSIS to Inno Setup

## v1.0.93 - 2026-03-24
- Use framework-dependent payload for setup installer

## v1.0.92 - 2026-03-24
- Use Skills submodule for bundled app skills

## v1.0.91 - 2026-03-24
- Remove optional skill scan flow from Windows app

## v1.0.90 - 2026-03-24
- Add erp-role-permission skill to bundle lists

## v1.0.89 - 2026-03-24
- Fix skills source detection and clarify UI

## v1.0.88 - 2026-03-24
- Fix Claude Desktop Appx detection

## v1.0.87 - 2026-03-24
- Stabilize Claude Desktop version lookup via winget

## v1.0.86 - 2026-03-24
- Require Claude CLI to be callable from PATH

## v1.0.85 - 2026-03-24
- Use installed programs list for Claude Desktop checks

## v1.0.84 - 2026-03-23
- Fix skills source fallback and desktop detection

## v1.0.83 - 2026-03-23
- Fix Claude Desktop version fallback label

## v1.0.82 - 2026-03-23
- Fix install diagnostics and Claude CLI PATH handling

## v1.0.81 - 2026-03-23
- Improve installer fallbacks and progress feedback

## v1.0.80 - 2026-03-23
- Internal maintenance

## v1.0.79 - 2026-03-23
- Refine best practices actions and translations

## v1.0.78 - 2026-03-23
- Internal maintenance

## v1.0.77 - 2026-03-23
- Add skills step search and align step actions

## v1.0.76 - 2026-03-23
- Add Git SCM prerequisite and tighten editor rules

## v1.0.75 - 2026-03-23
- Refine install flow and add silent mode

## v1.0.74 - 2026-03-23
- fix main layout

## v1.0.73 - 2026-03-23
- feat(dev-tools): refresh icons and log startup

## v1.0.72 - 2026-03-22
- fix(best-practices): allow selecting help text

## v1.0.71 - 2026-03-22
- fix(best-practices): align footer with subpage layout

## v1.0.70 - 2026-03-22
- refactor(subwindow): keep header and footer fixed

## v1.0.69 - 2026-03-22
- refactor(best-practices): split scroll panel from fixed footer nav

## v1.0.68 - 2026-03-22
- fix(best-practices): prevent footer overlap with content

## v1.0.67 - 2026-03-22
- style(best-practices): align toc and card layout

## v1.0.66 - 2026-03-22
- feat(best-practices): increase toc width and min window height

## v1.0.65 - 2026-03-22
- fix(best-practices): keep toc sidebar sticky in subwindow

## v1.0.64 - 2026-03-22
- feat(best-practices): add collapsible toc sections with sticky sidebar

## v1.0.63 - 2026-03-22
- fix(build): align runtime version metadata with semver release

## v1.0.62 - 2026-03-22
- feat(best-practices): add nested toc items for section headings

## v1.0.61 - 2026-03-22
- feat(best-practices): add localized best-practices subwindow with toc search

## v1.0.60 - 2026-03-22
- fix(about): align card paddings

## v1.0.59 - 2026-03-22
- fix(about): add app icon and align layout

## v1.0.58 - 2026-03-22
- fix(ui): sync theme across windows

## v1.0.57 - 2026-03-22
- ci: restore CSS minify step in GitHub Actions

## v1.0.56 - 2026-03-22
- ci: align workflow assembly version

## v1.0.55 - 2026-03-22
- build: remove build-info manifest output

## v1.0.54 - 2026-03-22
- build: switch to short display version

## v1.0.53 - 2026-03-22
- build: emit versioned artifacts and manifest

## v1.0.52 - 2026-03-22
- build: use unix epoch display version

## v1.0.51 - 2026-03-22
- build: avoid local git mutations while stamping version

## v1.0.50 - 2026-03-22
- build: stamp product version metadata in linux build

## v1.0.49 - 2026-03-22
- i18n: rename prerequisites section to dev tools

## v1.0.48 - 2026-03-22
- Internal maintenance

## v1.0.47 - 2026-03-22
- build: fix assembly version format
- ui: align about window layout

## v1.0.46 - 2026-03-22
- build: align local scripts with CI metadata stamping

## v1.0.45 - 2026-03-22
- Internal maintenance

## v1.0.44 - 2026-03-22
- Fix install-selected payload lifetime and dark theme variable override

## v1.0.43 - 2026-03-22
- Make build scripts executable

## v1.0.42 - 2026-03-22
- Stream install steps to UI logs and stabilize completion events

## v1.0.41 - 2026-03-22
- Improve install progress logs and harden completion flow

## v1.0.40 - 2026-03-22
- Align UI pattern and move remaining inline localization to language files

## v1.0.39 - 2026-03-21
- fix: prereq toolbar flex-wrap

## v1.0.38 - 2026-03-21
- fix: visible install windows, sequential installs, reset buttons

## v1.0.37 - 2026-03-21
- fix: About page style alignment

## v1.0.36 - 2026-03-21
- feat: replace legacy About window with web-based SubWindow flow

## v1.0.35 - 2026-03-21
- fix: complete i18n — translate all inline strings, remove CSS minifier

## v1.0.34 - 2026-03-21
- refactor: move all inline i18n strings into JS

## v1.0.33 - 2026-03-21
- Internal maintenance

## v1.0.32 - 2026-03-21
- fix: install progress serialization and theme toggle

## v1.0.31 - 2026-03-21
- fix: check handlers, lang persistence, editor badges

## v1.0.30 - 2026-03-21
- refactor: i18n system — shared language classes, auto-detect, Bridge.lang() pattern

## v1.0.29 - 2026-03-21
- fix: Turkish translations for prerequisites

## v1.0.28 - 2026-03-20
- fix: bypass PostWebMessage for system info and checks

## v1.0.27 - 2026-03-20
- fix: enrich PATH for admin mode, simplify ClaudeDesktop check

## v1.0.26 - 2026-03-20
- fix: theme defaults, system info serialization, parallel check

## v1.0.25 - 2026-03-20
- feat: full prerequisites system with Check All, Select All, Install Selected

## v1.0.24 - 2026-03-20
- fix: data-theme, safe system info fallback, async RunCommand

## v1.0.23 - 2026-03-20
- fix: About window uses shared browser environment

## v1.0.22 - 2026-03-20
- feat: About opens as separate window

## v1.0.21 - 2026-03-20
- ci: move CSS minification to GitHub Actions

## v1.0.20 - 2026-03-20
- fix: regenerate minified CSS

## v1.0.19 - 2026-03-20
- refactor: rebuild CSS, inline about page, fix header icon

## v1.0.18 - 2026-03-20
- Internal maintenance

## v1.0.17 - 2026-03-20
- fix: RunCommand deadlock — read stdout/stderr async before WaitForExit

## v1.0.16 - 2026-03-20
- fix: cards side by side layout
- feat: header app icon, hamburger menu with About dialog

## v1.0.15 - 2026-03-20
- feat: system info card, separate check buttons per prereq

## v1.0.14 - 2026-03-20
- Internal maintenance

## v1.0.13 - 2026-03-20
- perf: remove extra build targets and add dependency cache

## v1.0.12 - 2026-03-20
- fix: AssemblyVersion injection, language toggle updates all UI

## v1.0.11 - 2026-03-20
- fix: manual Check button, Turkish i18n

## v1.0.10 - 2026-03-20
- Internal maintenance

## v1.0.9 - 2026-03-20
- fix: auto-retry prereq check, Turkish characters, language toggle

## v1.0.8 - 2026-03-20
- ci: x64 only, single exe output

## v1.0.7 - 2026-03-20
- feat: wizard steps, NVM node install, install-aware navigation

## v1.0.6 - 2026-03-19
- feat: single-file desktop build with embedded UI + skills

## v1.0.5 - 2026-03-19
- Internal maintenance

## v1.0.4 - 2026-03-19
- fix: custom icon, missing imports
- feat: TR/EN language toggle, theme toggle, auto-install standard skills

## v1.0.3 - 2026-03-19
- Internal maintenance

## v1.0.2 - 2026-03-19
- feat: dark/light/system theme, auto-scan, toast notifications

## v1.0.1 - 2026-03-19
- feat: initial app with CI, portable releases, bundled skills
<!-- changelog-entries:end -->
