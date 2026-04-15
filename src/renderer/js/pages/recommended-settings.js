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
                '<div class="rs-two-col" id="rs-two-col">' +
                    '<div class="card rs-col-card"><div class="card-body" style="padding:8px">' +
                        '<div id="rs-list-left" class="rs-list"></div>' +
                    '</div></div>' +
                    '<div class="card rs-col-card"><div class="card-body" style="padding:8px">' +
                        '<div id="rs-list-right" class="rs-list"></div>' +
                    '</div></div>' +
                '</div>' +
                '<div class="card rs-empty-card hidden" id="rs-empty-card">' +
                    '<div class="card-body rs-empty-body">' +
                        '<span class="mi rs-empty-icon">info</span>' +
                        '<div class="rs-empty-text" id="rs-empty-text"></div>' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;padding:8px 0 4px">' +
                    '<div class="split-btn-group" id="rs-split-group">' +
                        '<button id="rs-apply-btn" class="btn btn-primary split-btn-main">' +
                            '<span class="mi btn-icon">download</span> <span id="rs-apply-label"></span>' +
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
        '</div>' +
        '<div id="rs-restart-overlay" class="modal-overlay hidden">' +
            '<div class="modal-dialog">' +
                '<div class="modal-header"><span class="modal-title" id="rs-restart-title"></span></div>' +
                '<div class="modal-body" id="rs-restart-body"></div>' +
                '<div class="modal-footer">' +
                    '<button id="rs-restart-later" class="btn btn-secondary"></button>' +
                    '<button id="rs-restart-yes" class="btn btn-primary"></button>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

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

        // Restart-Nautilus modal buttons
        var restartYes = document.getElementById('rs-restart-yes');
        if (restartYes) restartYes.addEventListener('click', function () {
            self._setRestartBtnBusy(true);
            Bridge.send('restartFileManager');
        });
        var restartLater = document.getElementById('rs-restart-later');
        if (restartLater) restartLater.addEventListener('click', function () { self._hideRestartConfirm(); });

        // Bridge events
        Bridge.on('recommendedSettingsStatus', function (d) { self._onStatus(d); });
        Bridge.on('recommendedSettingResult', function (d) { self._onItemResult(d); });
        Bridge.on('recommendedSettingsBatchDone', function (d) { self._onBatchDone(d); });
        Bridge.on('fileManagerRestartResult', function (d) {
            self._hideRestartConfirm();
            if (!d) return;
            var L = self._L;
            if (d.success) {
                var bits = [];
                if (typeof d.killed === 'number' && d.killed > 0) {
                    bits.push(L('RsRestartKilledN').replace('{n}', d.killed));
                } else if (d.note === 'not_running') {
                    bits.push(L('RsRestartNotRunning'));
                }
                if (typeof d.restored === 'number' && d.restored > 0) {
                    bits.push(L('RsRestartRestoredN').replace('{n}', d.restored));
                    if (typeof d.unresolved === 'number' && d.unresolved > 0) {
                        bits.push(L('RsRestartUnresolvedN').replace('{n}', d.unresolved));
                    }
                } else if (d.opened) {
                    bits.push(L('RsRestartFreshWindow'));
                    if (d.openMethod) bits.push('(' + d.openMethod + ')');
                } else if (d.attempts && d.attempts.length) {
                    // No fallback worked — surface the first failure so the
                    // user can see which launcher path is broken in their env.
                    bits.push('open failed: ' + d.attempts.map(function (a) { return a.method + '=' + a.error; }).join(', '));
                }
                self._toast(L('RsRestartedTitle'), bits.join(' · '), 'success', 7000);
            } else {
                self._toast(L('RsRestartFailed'), d.message || '', 'error', 8000);
            }
        });

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
        var twoCol = document.getElementById('rs-two-col');
        var emptyCard = document.getElementById('rs-empty-card');
        var emptyText = document.getElementById('rs-empty-text');
        var splitBtnGroup = document.getElementById('rs-split-group');

        if (!visibleItems || visibleItems.length === 0) {
            // Merged empty-state card, two-col cards and Apply/Revert hidden.
            if (twoCol) twoCol.classList.add('hidden');
            if (emptyCard) emptyCard.classList.remove('hidden');
            if (emptyText) emptyText.textContent = L('RsNothingAvailable') ||
                'No tweaks can be applied on this system.';
            if (splitBtnGroup) splitBtnGroup.classList.add('hidden');
            return;
        }

        if (twoCol) twoCol.classList.remove('hidden');
        if (emptyCard) emptyCard.classList.add('hidden');
        if (splitBtnGroup) splitBtnGroup.classList.remove('hidden');

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
            dot.textContent = applied ? '\u2713' : '\u00b7';
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

    _itemById: function (id) {
        for (var i = 0; i < this._allItems.length; i++) {
            if (this._allItems[i].id === id) return this._allItems[i];
        }
        return null;
    },

    _runBatch: function (mode) {
        if (this._inFlight) return;
        var L = this._L;
        var ids = this._selectedIds();
        var self = this;
        // Pass through ALL checked items in both modes. Apply and revert
        // are idempotent on the backend — apply overwrites in place (so the
        // user picks up updated extension files), and revert is a no-op if
        // the file is already gone (so stale entries the renderer didn't
        // know about still get cleaned up).
        if (!ids.length) {
            this._toast(L(mode === 'apply' ? 'RsNothingToApply' : 'RsNothingToRevert') || '', '', 'info');
            return;
        }
        this._currentMode = mode;
        this._inFlight = true;
        this._setBatchBtnBusy(true, mode);
        Bridge.send(mode === 'apply' ? 'applyRecommendedSettings' : 'revertRecommendedSettings', { ids: ids });
    },

    _setBatchBtnBusy: function (busy, mode) {
        var L = this._L;
        var applyBtn = document.getElementById('rs-apply-btn');
        var splitToggle = document.getElementById('rs-split-toggle');
        var revertBtn = document.getElementById('rs-revert-btn');
        var applyLabel = document.getElementById('rs-apply-label');
        if (!applyBtn || !applyLabel) return;
        if (busy) {
            applyBtn.disabled = true;
            if (splitToggle) splitToggle.disabled = true;
            if (revertBtn) revertBtn.disabled = true;
            applyLabel.textContent = mode === 'revert' ? (L('RsReverting') || 'Reverting...') : (L('RsApplying') || 'Applying...');
        } else {
            applyBtn.disabled = false;
            if (splitToggle) splitToggle.disabled = false;
            if (revertBtn) revertBtn.disabled = false;
            applyLabel.textContent = L('RsApplySelected') || 'Apply Selected';
        }
    },

    _onItemResult: function (r) {
        if (!r || !r.id) return;
        var L = this._L;
        var item = this._itemById(r.id);
        var name = item ? L(item.nameKey) : r.id;
        var mode = this._currentMode || 'apply';

        if (r.success) {
            this._appliedMap[r.id] = (mode === 'apply');
            var cb = document.querySelector('.rs-row-cb[data-rs-id="' + r.id + '"]');
            if (cb) {
                cb.checked = !this._appliedMap[r.id];
                var row = cb.closest('.rs-row');
                if (row) {
                    var dot = row.querySelector('.rs-status');
                    if (dot) {
                        if (this._appliedMap[r.id]) {
                            dot.classList.remove('rs-status-off');
                            dot.classList.add('rs-status-on');
                            dot.textContent = '\u2713';
                        } else {
                            dot.classList.remove('rs-status-on');
                            dot.classList.add('rs-status-off');
                            dot.textContent = '\u00b7';
                        }
                    }
                }
            }
            var successMsg = mode === 'apply' ? L('RsItemApplied') : L('RsItemReverted');
            this._toast(name + ' — ' + successMsg, '', 'success', 3000);
        } else {
            var failKey = mode === 'apply' ? 'RsItemApplyFailed' : 'RsItemRevertFailed';
            this._toast(name + ' — ' + L(failKey), r.message || '', 'error', 6000);
        }
    },

    _onBatchDone: function (d) {
        this._inFlight = false;
        this._setBatchBtnBusy(false);
        this._currentMode = null;
        if (d && d.ctxmenuAffected) {
            // Ask the user whether to restart Nautilus now or later. We
            // deliberately do NOT auto-restart in the backend — that
            // kills an active file-manager session without consent.
            this._showRestartConfirm();
        }
    },

    _showRestartConfirm: function () {
        var L = this._L;
        var overlay = document.getElementById('rs-restart-overlay');
        if (!overlay) return;
        document.getElementById('rs-restart-title').textContent = L('RsRestartConfirmTitle');
        document.getElementById('rs-restart-body').textContent = L('RsRestartConfirmBody');
        document.getElementById('rs-restart-yes').textContent = L('RsRestartYes');
        document.getElementById('rs-restart-later').textContent = L('RsRestartLater');
        overlay.classList.remove('hidden');
    },

    _hideRestartConfirm: function () {
        var overlay = document.getElementById('rs-restart-overlay');
        if (overlay) overlay.classList.add('hidden');
        this._setRestartBtnBusy(false);
    },

    _setRestartBtnBusy: function (busy) {
        var L = this._L;
        var yesBtn = document.getElementById('rs-restart-yes');
        var laterBtn = document.getElementById('rs-restart-later');
        if (!yesBtn) return;
        if (busy) {
            yesBtn.disabled = true;
            if (laterBtn) laterBtn.disabled = true;
            yesBtn.textContent = L('RsRestartInProgress') || 'Please wait...';
        } else {
            yesBtn.disabled = false;
            if (laterBtn) laterBtn.disabled = false;
            yesBtn.textContent = L('RsRestartYes');
        }
    },

    _toast: function (title, message, type, duration) {
        if (window.Toast && typeof Toast.show === 'function') {
            Toast.show(title, message, type, duration);
            return;
        }
        var c = document.getElementById('toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toast-container';
            document.body.appendChild(c);
        }
        var t = document.createElement('div');
        t.className = 'toast toast-' + (type || 'info');
        t.style.cssText = 'cursor:pointer';
        var icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
        var iconEl = document.createElement('span');
        iconEl.className = 'mi toast-icon';
        iconEl.textContent = icons[type] || 'info';
        t.appendChild(iconEl);
        var content = document.createElement('div');
        content.className = 'toast-content';
        if (title) {
            var titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.textContent = title;
            content.appendChild(titleEl);
        }
        if (message) {
            var msgEl = document.createElement('div');
            msgEl.className = 'toast-message';
            msgEl.textContent = message;
            content.appendChild(msgEl);
        }
        t.appendChild(content);
        var closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close mi';
        closeBtn.textContent = 'close';
        t.appendChild(closeBtn);
        var dismiss = function () {
            t.classList.remove('toast-visible');
            t.classList.add('toast-hiding');
            setTimeout(function () { t.remove(); }, 300);
        };
        c.appendChild(t);
        closeBtn.addEventListener('click', function (e) { e.stopPropagation(); dismiss(); });
        requestAnimationFrame(function () { t.classList.add('toast-visible'); });
        setTimeout(dismiss, duration || 4000);
    }
};
