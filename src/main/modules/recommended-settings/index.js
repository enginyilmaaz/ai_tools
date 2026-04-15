'use strict';

const vscodeSettings = require('./vscode-settings');
const aliases = require('./aliases');
const ctxMenus = require('./context-menus');
const { detectCapabilities, pythonNautilusInstalled } = require('./detect');

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
    case 'ctxmenu':       return ctxMenus.isApplied({ id: item.id, brand: item.payload.brand });
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
    case 'ctxmenu':       return ctxMenus.revert({ id: item.id, brand: item.payload.brand });
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
  let ctxmenuAffected = false;

  // Pre-flight: prompt pkexec exactly ONCE if python3-nautilus is missing.
  const hasCtxmenu = ids.some(id => {
    const it = byId(id);
    return it && it.kind === 'ctxmenu';
  });
  let prereqError = null;
  if (hasCtxmenu && process.platform === 'linux' && !pythonNautilusInstalled()) {
    const pre = await ctxMenus.installPrerequisites(logger);
    if (!pre.success) prereqError = pre.message || 'Prerequisite install failed';
  }

  for (let i = 0; i < ids.length; i++) {
    const item = byId(ids[i]);
    if (!item) {
      if (logger) logger('apply #' + (i + 1) + '/' + total + ' ' + ids[i] + ': unknown id');
      if (onItem) onItem({ id: ids[i], success: false, message: 'Unknown item', done: i + 1, total });
      continue;
    }
    if (item.kind === 'ctxmenu' && prereqError) {
      if (logger) logger('apply #' + (i + 1) + '/' + total + ' ' + item.id + ': prereq failed — ' + prereqError);
      if (onItem) onItem({ id: item.id, success: false, message: prereqError, done: i + 1, total });
      continue;
    }
    if (logger) logger('apply #' + (i + 1) + '/' + total + ' ' + item.id + ' (' + item.kind + ')');
    let res;
    try { res = applyItem(item); }
    catch (e) { res = { success: false, message: e.message }; }
    if (res && res.success) {
      ok++;
      if (item.kind === 'ctxmenu') ctxmenuAffected = true;
      if (logger) logger('  -> OK');
    } else {
      if (logger) logger('  -> FAILED ' + (res && res.message ? res.message : '(no message)'));
    }
    if (onItem) onItem({ id: item.id, success: !!(res && res.success), message: res && res.message, done: i + 1, total });
  }
  return { ok, total, ctxmenuAffected };
}

function revertMany(ids, onItem) {
  const total = ids.length;
  let ok = 0;
  let ctxmenuAffected = false;
  for (let i = 0; i < ids.length; i++) {
    const item = byId(ids[i]);
    if (!item) {
      if (onItem) onItem({ id: ids[i], success: false, message: 'Unknown item', done: i + 1, total });
      continue;
    }
    let res;
    try { res = revertItem(item); }
    catch (e) { res = { success: false, message: e.message }; }
    if (res && res.success) {
      ok++;
      if (item.kind === 'ctxmenu') ctxmenuAffected = true;
    }
    if (onItem) onItem({ id: item.id, success: !!(res && res.success), message: res && res.message, done: i + 1, total });
  }
  return { ok, total, ctxmenuAffected };
}

module.exports = { getStatus, applyMany, revertMany, ITEMS };
