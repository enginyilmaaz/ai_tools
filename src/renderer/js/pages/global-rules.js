// Global Claude Rules Page — runs inside SubWindow.
// Mirrors the Skills page (skills.js): same page-object shape, same CSS classes
// (.mcp-server-row / .skills-row / .skills-badge / .skills-master-toggle / ...),
// same footer layout and the same self-contained toast helper. Simpler than
// skills.js — a single flat list, no grouping / requirements / prerequisites.
(function () {
    window.GlobalRulesPage = {
        _rules: [],
        _state: { claude: {}, codex: {} },
        _selected: null,
        _repoFound: true,
        _busy: false,
        _busyAction: '',

        // Standalone hooks (second section of this combined "Rules & Hooks" window).
        _hooks: [],
        _hookState: {},
        _hooksRepoFound: true,
        _hookBusy: {},

        _escapeHtml: function (value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        // Same toast helper skills.js uses (parent Toast if present, else a
        // self-contained fallback) so success/error feedback looks identical.
        _toast: function (title, message, type, duration) {
            if (window.Toast) {
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
            var icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
            var dismiss = function () {
                t.classList.remove('toast-visible');
                t.classList.add('toast-hiding');
                setTimeout(function () { t.remove(); }, 300);
            };

            t.innerHTML =
                '<span class="mi toast-icon">' + (icons[type] || 'info') + '</span>' +
                '<div class="toast-content">' +
                    (title ? '<div class="toast-title">' + this._escapeHtml(title) + '</div>' : '') +
                    (message ? '<div class="toast-message">' + this._escapeHtml(message) + '</div>' : '') +
                '</div>' +
                '<button class="toast-close mi">close</button>';

            c.appendChild(t);
            t.querySelector('.toast-close').addEventListener('click', function (e) {
                e.stopPropagation();
                dismiss();
            });

            requestAnimationFrame(function () {
                t.classList.add('toast-visible');
            });

            setTimeout(dismiss, duration || 4000);
        },

        // Default all-selected on first render; keep the user's choices afterwards
        // (mirrors skills.js _ensureSelectionState).
        _ensureSelectionState: function () {
            if (!this._selected) {
                this._selected = {};
                for (var i = 0; i < this._rules.length; i++) {
                    this._selected[this._rules[i].id] = true;
                }
                return;
            }
            for (var j = 0; j < this._rules.length; j++) {
                if (typeof this._selected[this._rules[j].id] === 'undefined') {
                    this._selected[this._rules[j].id] = true;
                }
            }
        },

        _selectedCount: function () {
            var selected = this._selected || {};
            var count = 0;
            for (var i = 0; i < this._rules.length; i++) {
                if (selected[this._rules[i].id]) count++;
            }
            return count;
        },

        _selectionStats: function () {
            var selectedCount = this._selectedCount();
            return {
                total: this._rules.length,
                selectedCount: selectedCount,
                allSelected: this._rules.length > 0 && selectedCount === this._rules.length
            };
        },

        _toggleRule: function (id, checked) {
            if (!this._selected) this._selected = {};
            this._selected[id] = !!checked;
            this._updateActions();
        },

        _setAllRules: function (checked) {
            if (!this._selected) this._selected = {};
            for (var i = 0; i < this._rules.length; i++) {
                this._selected[this._rules[i].id] = !!checked;
            }
            this._renderList();
            this._updateActions();
        },

        _getSelectedRuleIds: function () {
            var selected = this._selected || {};
            return this._rules
                .filter(function (rule) { return !!selected[rule.id]; })
                .map(function (rule) { return rule.id; });
        },

        _ruleName: function (rule) {
            return Bridge._langCode === 'tr' ? rule.name_tr : rule.name_en;
        },

        _ruleDesc: function (rule) {
            return Bridge._langCode === 'tr' ? rule.desc_tr : rule.desc_en;
        },

        _renderRow: function (rule) {
            var L = Bridge.lang.bind(Bridge);
            var id = rule.id;
            var name = this._ruleName(rule);
            var desc = this._ruleDesc(rule);
            var checked = !!(this._selected && this._selected[id]);
            var claudeOn = !!(this._state.claude && this._state.claude[id]);
            var codexOn = !!(this._state.codex && this._state.codex[id]);

            var badges = '';
            if (claudeOn) {
                badges += '<span class="skills-badge skills-badge-category">' + this._escapeHtml(L('GlobalRulesBadgeClaude')) + '</span>';
            }
            if (codexOn) {
                badges += '<span class="skills-badge skills-badge-requirement">' + this._escapeHtml(L('GlobalRulesBadgeCodex')) + '</span>';
            }

            return '' +
            '<div class="mcp-server-row skills-row">' +
                '<label class="skills-row-check">' +
                    '<input type="checkbox" class="global-rules-item-checkbox" data-rule="' + this._escapeHtml(id) + '"' + (checked ? ' checked' : '') + '>' +
                    '<span class="skills-row-check-mark"></span>' +
                '</label>' +
                '<div class="skills-row-icon"><span class="mi">' + this._escapeHtml(rule.icon || 'rule') + '</span></div>' +
                '<div class="mcp-server-info skills-row-info" title="' + this._escapeHtml(desc) + '">' +
                    '<div class="skills-row-top">' +
                        '<span class="mcp-server-name skills-row-name">' + this._escapeHtml(name) + '</span>' +
                    '</div>' +
                    '<div class="skills-row-meta" style="align-items:center">' +
                        '<span style="font-size:11px;color:var(--text-muted);line-height:1.4">' + this._escapeHtml(desc) + '</span>' +
                        badges +
                    '</div>' +
                '</div>' +
            '</div>';
        },

        _renderList: function () {
            var listEl = document.getElementById('global-rules-list');
            if (!listEl) return;
            var L = Bridge.lang.bind(Bridge);

            if (!this._repoFound) {
                listEl.innerHTML = '<div class="skills-empty">' + this._escapeHtml(L('GlobalRulesNoSource')) + '</div>';
                this._updateActions();
                return;
            }

            if (!this._rules.length) {
                listEl.innerHTML = '<div class="skills-empty">' + this._escapeHtml(L('GlobalRulesEmpty')) + '</div>';
                this._updateActions();
                return;
            }

            this._ensureSelectionState();
            listEl.innerHTML = this._rules.map(this._renderRow.bind(this)).join('');

            var self = this;
            listEl.querySelectorAll('.global-rules-item-checkbox').forEach(function (checkbox) {
                checkbox.addEventListener('change', function (event) {
                    event.stopPropagation();
                    self._toggleRule(checkbox.getAttribute('data-rule'), checkbox.checked);
                });
            });

            this._updateActions();
        },

        _updateActions: function () {
            var L = Bridge.lang.bind(Bridge);
            var stats = this._selectionStats();
            var count = stats.selectedCount;

            var countEl = document.getElementById('global-rules-selected-count');
            // Bridge.lang does not interpolate — do the {count} replace here.
            if (countEl) countEl.textContent = L('GlobalRulesSelected').replace('{count}', count);

            var masterToggle = document.getElementById('global-rules-master-toggle');
            if (masterToggle) {
                masterToggle.checked = stats.allSelected;
                masterToggle.indeterminate = !stats.allSelected && count > 0;
            }

            var masterLabel = document.getElementById('global-rules-master-toggle-label');
            if (masterLabel) {
                masterLabel.textContent = stats.allSelected ? L('GlobalRulesSelectNone') : L('GlobalRulesSelectAll');
            }

            // Gate the split-button groups on busy / no source only (buttons stay
            // clickable at count 0 so the "select at least one" toast is reachable).
            var disabled = this._busy || !this._repoFound || this._rules.length === 0;
            ['global-rules-add-claude-btn', 'global-rules-add-codex-btn',
             'global-rules-remove-claude-btn', 'global-rules-remove-codex-btn',
             'global-rules-split-toggle', 'global-rules-codex-split-toggle'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.disabled = disabled;
            });
        },

        _triggerAction: function (action, target) {
            var L = Bridge.lang.bind(Bridge);
            if (this._busy || !this._repoFound) return;

            var ids = this._getSelectedRuleIds();
            if (!ids.length) {
                this._toast(L('GlobalRulesNoneSelected'), '', 'warning', 4000);
                return;
            }

            this._busy = true;
            this._busyAction = action + ':' + target;
            this._updateActions();
            Bridge.send(action === 'install' ? 'installGlobalRules' : 'removeGlobalRules', {
                rules: ids,
                target: target
            });
        },

        _onData: function (d) {
            d = d || {};
            this._repoFound = d.repoFound !== false;
            var manifest = d.manifest || { rules: [] };
            this._rules = (manifest.rules || []).slice(); // already sorted by order in main
            this._state = d.state || { claude: {}, codex: {} };
            if (!this._state.claude) this._state.claude = {};
            if (!this._state.codex) this._state.codex = {};
            this._renderList();
        },

        _onResult: function (r, action) {
            var L = Bridge.lang.bind(Bridge);
            this._busy = false;
            this._busyAction = '';

            if (r && r.state) {
                this._state = r.state;
                if (!this._state.claude) this._state.claude = {};
                if (!this._state.codex) this._state.codex = {};
            }

            this._renderList(); // refresh badges from the new state + re-enable buttons

            if (r && r.success) {
                this._toast(L(action === 'install' ? 'GlobalRulesInstallDone' : 'GlobalRulesRemoveDone'), '', 'success', 4000);
            } else {
                this._toast(L('GlobalRulesError'), (r && r.error) ? r.error : '', 'error', 5000);
            }
        },

        // Add/Remove split button group (mirrors skills.js): main "Add to X" +
        // a caret that opens a one-item "Remove from X" menu.
        _splitGroupHtml: function (target) {
            var L = Bridge.lang.bind(Bridge);
            var isCodex = target === 'codex';
            var svg = isCodex ? 'openai-symbol.svg' : 'claude.svg';
            var bg = isCodex ? ' style="background:#333"' : '';
            var groupId = isCodex ? 'global-rules-codex-split-group' : 'global-rules-split-group';
            var addId = isCodex ? 'global-rules-add-codex-btn' : 'global-rules-add-claude-btn';
            var toggleId = isCodex ? 'global-rules-codex-split-toggle' : 'global-rules-split-toggle';
            var menuId = isCodex ? 'global-rules-codex-split-menu' : 'global-rules-split-menu';
            var removeId = isCodex ? 'global-rules-remove-codex-btn' : 'global-rules-remove-claude-btn';
            var addLabel = this._escapeHtml(L(isCodex ? 'GlobalRulesAddCodex' : 'GlobalRulesAddClaude'));
            var removeLabel = this._escapeHtml(L(isCodex ? 'GlobalRulesRemoveCodex' : 'GlobalRulesRemoveClaude'));
            return '' +
            '<div class="split-btn-group" id="' + groupId + '">' +
                '<button class="btn btn-primary split-btn-main skills-target-btn" id="' + addId + '"' + bg + ' disabled>' +
                    '<img src="assets/devtools/' + svg + '" style="width:16px;height:16px;filter:brightness(0) invert(1)" alt=""> ' + addLabel +
                '</button>' +
                '<button id="' + toggleId + '" class="btn btn-primary split-btn-toggle"' + bg + ' disabled>' +
                    '<span class="mi">arrow_drop_down</span>' +
                '</button>' +
                '<div id="' + menuId + '" class="split-btn-menu">' +
                    '<button class="split-btn-menu-item" id="' + removeId + '">' +
                        '<span class="mi" style="font-size:14px;margin-right:4px">delete</span>' +
                        '<span>' + removeLabel + '</span>' +
                    '</button>' +
                '</div>' +
            '</div>';
        },

        // ----- Hooks section (per-row Install/Remove; Claude Code only) -----
        _hookName: function (h) { return Bridge._langCode === 'tr' ? h.name_tr : h.name_en; },
        _hookDesc: function (h) { return Bridge._langCode === 'tr' ? h.desc_tr : h.desc_en; },

        _renderHookRow: function (hook) {
            var L = Bridge.lang.bind(Bridge);
            var id = hook.id;
            var installed = !!this._hookState[id];
            var busy = !!this._hookBusy[id];
            var badge = installed ? '<span class="skills-badge skills-badge-category">' + this._escapeHtml(L('HooksInstalled')) + '</span>' : '';
            var btnLabel = installed ? L('HooksRemove') : L('HooksInstall');
            var btnClass = installed ? 'btn-secondary' : 'btn-primary';
            return '' +
            '<div class="mcp-server-row skills-row">' +
                '<div class="skills-row-icon"><span class="mi">' + this._escapeHtml(hook.icon || 'bolt') + '</span></div>' +
                '<div class="mcp-server-info skills-row-info" title="' + this._escapeHtml(this._hookDesc(hook)) + '">' +
                    '<div class="skills-row-top">' +
                        '<span class="mcp-server-name skills-row-name">' + this._escapeHtml(this._hookName(hook)) + '</span>' +
                    '</div>' +
                    '<div class="skills-row-meta" style="align-items:center">' +
                        '<span style="font-size:11px;color:var(--text-muted);line-height:1.4">' + this._escapeHtml(this._hookDesc(hook)) + '</span>' +
                        badge +
                    '</div>' +
                '</div>' +
                '<button class="btn ' + btnClass + ' hooks-row-action" data-hook="' + this._escapeHtml(id) + '" data-installed="' + (installed ? '1' : '0') + '"' + (busy ? ' disabled' : '') + ' style="margin-left:auto">' +
                    '<span class="mi btn-icon" style="font-size:14px">' + (installed ? 'delete' : 'download') + '</span> ' + this._escapeHtml(btnLabel) +
                '</button>' +
            '</div>';
        },

        _renderHooksList: function () {
            var listEl = document.getElementById('hooks-list');
            if (!listEl) return;
            var L = Bridge.lang.bind(Bridge);
            if (!this._hooksRepoFound) { listEl.innerHTML = '<div class="skills-empty">' + this._escapeHtml(L('HooksNoSource')) + '</div>'; return; }
            if (!this._hooks.length) { listEl.innerHTML = '<div class="skills-empty">' + this._escapeHtml(L('HooksEmpty')) + '</div>'; return; }
            listEl.innerHTML = this._hooks.map(this._renderHookRow.bind(this)).join('');
            var self = this;
            listEl.querySelectorAll('.hooks-row-action').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    self._toggleHook(btn.getAttribute('data-hook'), btn.getAttribute('data-installed') === '1');
                });
            });
        },

        _toggleHook: function (id, installed) {
            if (this._hookBusy[id]) return;
            this._hookBusy[id] = true;
            this._renderHooksList();
            Bridge.send(installed ? 'removeHooks' : 'installHooks', { hooks: [id] });
        },

        _onHooksData: function (d) {
            d = d || {};
            this._hooksRepoFound = d.repoFound !== false;
            var manifest = d.manifest || { hooks: [] };
            this._hooks = (manifest.hooks || []).slice();
            this._hookState = d.state || {};
            this._renderHooksList();
        },

        _onHookResult: function (r, action) {
            var L = Bridge.lang.bind(Bridge);
            this._hookBusy = {};
            if (r && r.state) this._hookState = r.state;
            this._renderHooksList();
            if (r && r.success) {
                this._toast(L(action === 'install' ? 'HooksInstallDone' : 'HooksRemoveDone'), '', 'success', 4000);
            } else {
                this._toast(L('HooksError'), (r && r.error) ? r.error : '', 'error', 5000);
            }
        },

        render: function () {
            var L = Bridge.lang.bind(Bridge);
            return '' +
            '<div class="subpage-layout mcp-page-layout skills-page-layout">' +
                '<div class="mcp-page-header">' +
                    '<span class="mi" style="font-size:20px;color:var(--accent-blue)">rule</span>' +
                    '<span style="font-size:14px;font-weight:600">' + this._escapeHtml(L('GlobalRulesTitle')) + '</span>' +
                '</div>' +
                '<div class="mcp-page-scroll">' +
                    '<p class="mcp-desc">' + this._escapeHtml(L('GlobalRulesSubtitle')) + '</p>' +
                    '<div class="skills-card-toolbar">' +
                        '<div class="skills-toolbar-summary">' +
                            '<label class="skills-master-toggle">' +
                                '<span class="skills-row-check">' +
                                    '<input id="global-rules-master-toggle" type="checkbox">' +
                                    '<span class="skills-row-check-mark"></span>' +
                                '</span>' +
                                '<span id="global-rules-master-toggle-label" class="skills-master-toggle-label">' + this._escapeHtml(L('GlobalRulesSelectAll')) + '</span>' +
                            '</label>' +
                            '<span id="global-rules-selected-count" class="skills-selected-count">' + this._escapeHtml(L('GlobalRulesSelected').replace('{count}', 0)) + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="mcp-two-col skills-group-grid skills-group-grid-single">' +
                        '<div class="card mcp-col-card skills-col-card">' +
                            '<div class="card-body">' +
                                '<div id="global-rules-list" class="skills-list">' +
                                    '<div class="skills-empty">' + this._escapeHtml(L('GlobalRulesLoading')) + '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="display:flex;justify-content:flex-end;gap:8px;padding:8px 0 18px">' +
                        this._splitGroupHtml('codex') +
                        this._splitGroupHtml('claude') +
                    '</div>' +
                    '<div class="mcp-page-header" style="margin-top:4px">' +
                        '<span class="mi" style="font-size:20px;color:var(--accent-blue)">bolt</span>' +
                        '<span style="font-size:14px;font-weight:600">' + this._escapeHtml(L('HooksSectionTitle')) + '</span>' +
                    '</div>' +
                    '<div class="mcp-two-col skills-group-grid skills-group-grid-single">' +
                        '<div class="card mcp-col-card skills-col-card">' +
                            '<div class="card-body">' +
                                '<div id="hooks-list" class="skills-list">' +
                                    '<div class="skills-empty">' + this._escapeHtml(L('HooksLoading')) + '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="bp-page-actions subpage-footer" style="justify-content:flex-end">' +
                    '<button class="btn btn-secondary" id="global-rules-close-btn">' +
                        '<span class="mi btn-icon">close</span> ' + this._escapeHtml(L('BtnClose')) +
                    '</button>' +
                '</div>' +
            '</div>';
        },

        afterRender: function () {
            var self = this;
            this._busy = false;
            this._busyAction = '';

            var closeBtn = document.getElementById('global-rules-close-btn');
            if (closeBtn) closeBtn.addEventListener('click', function () { Bridge.send('closeWindow'); });

            var masterToggle = document.getElementById('global-rules-master-toggle');
            if (masterToggle) {
                masterToggle.addEventListener('change', function () {
                    self._setAllRules(masterToggle.checked);
                });
            }

            // Split-button dropdowns: caret toggles the menu; an outside click closes it.
            [['global-rules-codex-split-group', 'global-rules-codex-split-toggle'],
             ['global-rules-split-group', 'global-rules-split-toggle']].forEach(function (pair) {
                var group = document.getElementById(pair[0]);
                var toggle = document.getElementById(pair[1]);
                if (!group || !toggle) return;
                toggle.addEventListener('click', function (e) { e.stopPropagation(); group.classList.toggle('show'); });
                document.addEventListener('click', function (e) { if (!group.contains(e.target)) group.classList.remove('show'); });
            });

            // Wire the four actions; each closes its dropdown then triggers.
            var wire = function (btnId, action, target, groupId) {
                var btn = document.getElementById(btnId);
                if (!btn) return;
                btn.addEventListener('click', function () {
                    var group = document.getElementById(groupId);
                    if (group) group.classList.remove('show');
                    self._triggerAction(action, target);
                });
            };
            wire('global-rules-add-codex-btn', 'install', 'codex', 'global-rules-codex-split-group');
            wire('global-rules-remove-codex-btn', 'remove', 'codex', 'global-rules-codex-split-group');
            wire('global-rules-add-claude-btn', 'install', 'claude', 'global-rules-split-group');
            wire('global-rules-remove-claude-btn', 'remove', 'claude', 'global-rules-split-group');

            // Register listeners BEFORE requesting data.
            Bridge.on('globalRulesData', function (d) { self._onData(d); });
            Bridge.on('installGlobalRulesResult', function (r) { self._onResult(r, 'install'); });
            Bridge.on('removeGlobalRulesResult', function (r) { self._onResult(r, 'remove'); });

            Bridge.on('hooksData', function (d) { self._onHooksData(d); });
            Bridge.on('installHooksResult', function (r) { self._onHookResult(r, 'install'); });
            Bridge.on('removeHooksResult', function (r) { self._onHookResult(r, 'remove'); });

            Bridge.send('getGlobalRules');
            Bridge.send('getHooks');
        }
    };
})();
