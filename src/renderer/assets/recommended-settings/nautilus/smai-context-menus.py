#!/usr/bin/env python3
"""
SmartMarine AI — Consolidated Nautilus context-menu provider.

Replaces the previous three separate files (smai-open-{claude,codex,vscode}.py)
with a single Nautilus.MenuProvider that registers all three menu items.
Loading one .py instead of three cuts Nautilus startup time roughly in half
on slower machines because the expensive `from gi.repository import
Nautilus, GObject` chain is paid once, not three times.

Per-action enable/disable is preserved via a tiny JSON file:

    ~/.local/share/smartmarine-ai/ctx-menu.json
    { "claude": true, "codex": true, "vscode": false }

Missing or unreadable config means "all disabled". The Recommended
Settings page apply/revert keeps this file in sync.
"""

import json
import os
import shlex
import subprocess

import gi
# Nautilus 46+ (Nautilus 4.0 API) requires an explicit version request.
try:
    gi.require_version('Nautilus', '4.0')
except ValueError:
    try:
        gi.require_version('Nautilus', '3.0')
    except ValueError:
        pass
from gi.repository import Nautilus, GObject  # noqa: E402


CONFIG_PATH = os.path.expanduser('~/.local/share/smartmarine-ai/ctx-menu.json')

CLAUDE_CMD = 'claude --dangerously-skip-permissions --effort max'
CODEX_CMD  = 'codex --sandbox danger-full-access -c model_reasoning_effort="xhigh"'

# Three logical actions, resolved against the JSON config at menu-render time.
ACTIONS = (
    # (flag_key,  menu_id,          label,                 cmd,         in_terminal)
    ('claude',   'SmaiOpenClaude', 'Open in Claude Code', CLAUDE_CMD,  True),
    ('codex',    'SmaiOpenCodex',  'Open in Codex CLI',   CODEX_CMD,   True),
    ('vscode',   'SmaiOpenVscode', 'Open in VS Code',     'code',      False),
)


def _read_enabled():
    """Read enable-flags JSON. Returns dict; empty if missing/bad."""
    try:
        with open(CONFIG_PATH, 'r') as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _run_in_terminal(_mi, cmd, path):
    # bash -ic so .bashrc's nvm / ~/.local/bin PATH additions are sourced —
    # Ubuntu's default .bashrc short-circuits for non-interactive shells.
    subprocess.Popen([
        'gnome-terminal', '--working-directory=' + path, '--',
        'bash', '-ic', cmd + '; exec bash'
    ])


def _run_gui(_mi, cmd, path):
    # 'code' (and anything without its own terminal) still benefits from
    # .bashrc sourcing in case PATH is sparse.
    subprocess.Popen([
        'bash', '-ic', cmd + ' ' + shlex.quote(path)
    ])


class SmaiContextMenus(GObject.GObject, Nautilus.MenuProvider):

    def _items_for_path(self, path):
        if not path:
            return []
        enabled = _read_enabled()
        items = []
        for flag, name, label, cmd, in_terminal in ACTIONS:
            if not enabled.get(flag):
                continue
            mi = Nautilus.MenuItem(name=name, label=label, tip='')
            if in_terminal:
                mi.connect('activate', _run_in_terminal, cmd, path)
            else:
                mi.connect('activate', _run_gui, cmd, path)
            items.append(mi)
        return items

    # *args supports both nautilus-python 1.1 (window, files) and 1.2+ (files).
    def get_file_items(self, *args):
        files = args[-1] if args else []
        if not files:
            return []
        f = files[0]
        try:
            if not f.is_directory():
                return []
        except Exception:
            return []
        try:
            path = f.get_location().get_path()
        except Exception:
            return []
        return self._items_for_path(path)

    def get_background_items(self, *args):
        folder = args[-1] if args else None
        if folder is None:
            return []
        try:
            path = folder.get_location().get_path()
        except Exception:
            return []
        return self._items_for_path(path)
