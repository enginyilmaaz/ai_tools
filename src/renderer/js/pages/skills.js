window.SkillsPage = {
    _catalog: null,
    _catalogPromise: null,
    _selected: null,
    _installing: false,
    _installingTarget: '',
    _pendingInstallRequest: null,
    _dialogState: null,

    _copy: function () {
        var L = Bridge.lang.bind(Bridge);
        return {
            title: L('SkillsCatalogTitle') || 'Skills',
            description: L('SkillsCatalogDescription') || '',
            searchPlaceholder: L('SkillsCatalogSearchPlaceholder') || 'Search skills...',
            noResult: L('SkillsCatalogNoResult') || 'No skills found for your search.',
            platformLabel: L('SkillsCatalogPlatformLabel') || 'Platform',
            close: L('BtnClose') || 'Close',
            selectAll: L('SkillsSelectAll') || 'Select All',
            selectNone: L('SkillsSelectNone') || 'Select None',
            installing: L('SkillsImporting') || 'Saving...',
            selectedSuffix: L('SkillsSelected') || 'selected',
            installClaude: L('SkillsImportClaude') || 'Add to Claude',
            installCodex: L('SkillsImportCodex') || 'Add to Codex',
            confirmClaudeTitle: L('SkillsConfirmAddClaudeTitle') || 'Add to Claude',
            confirmCodexTitle: L('SkillsConfirmAddCodexTitle') || 'Add to Codex',
            confirmClaudeBody: L('SkillsConfirmAddClaudeBody') || 'Are you sure you want to add the selected skills to Claude?',
            confirmCodexBody: L('SkillsConfirmAddCodexBody') || 'Are you sure you want to add the selected skills to Codex?',
            missingClaudePrereq: L('SkillsPrereqClaudeMissing') || 'Install Claude CLI and the Claude Code extension in VS Code first.',
            missingCodexPrereq: L('SkillsPrereqCodexMissing') || 'Install Codex CLI and the Codex extension in VS Code first.',
            doneClaude: L('SkillsImportClaudeDone') || 'Selected skills were added to Claude.',
            doneCodex: L('SkillsImportCodexDone') || 'Selected skills were added to Codex.',
            confirmYes: L('ConfirmYes') || 'Yes',
            confirmNo: L('ConfirmNo') || 'No'
        };
    },

    _escapeHtml: function (value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    _getPlatformNameKey: function () {
        var platform = (Bridge._initData && Bridge._initData.platform) || '';
        return platform === 'win32' ? 'SkillsCatalogPlatformWindows' : 'SkillsCatalogPlatformLinux';
    },

    _getCatalogConfig: function () {
        var platform = (Bridge._initData && Bridge._initData.platform) || '';
        return platform === 'win32'
            ? { globalName: 'SkillCatalogWindows', scriptPath: 'js/data/skills-windows.js' }
            : { globalName: 'SkillCatalogLinux', scriptPath: 'js/data/skills-linux.js' };
    },

    _ensureCatalogLoaded: function () {
        var self = this;
        var config = this._getCatalogConfig();
        if (window[config.globalName]) {
            return Promise.resolve(window[config.globalName]);
        }
        if (this._catalogPromise) {
            return this._catalogPromise;
        }

        this._catalogPromise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = config.scriptPath;
            script.async = true;
            script.onload = function () {
                self._catalogPromise = null;
                if (window[config.globalName]) {
                    resolve(window[config.globalName]);
                    return;
                }
                reject(new Error('Skill catalog not found after loading: ' + config.globalName));
            };
            script.onerror = function () {
                self._catalogPromise = null;
                reject(new Error('Failed to load skill catalog: ' + config.scriptPath));
            };
            document.head.appendChild(script);
        });

        return this._catalogPromise;
    },

    _getCategoryLabel: function (category) {
        var keyMap = {
            general: 'SkillsCategoryGeneral'
        };
        return Bridge.lang(keyMap[category] || 'SkillsCategoryGeneral');
    },

    _getGroupTitle: function (group) {
        var keyMap = {
            general: 'SkillsGroupGeneral'
        };
        return Bridge.lang(keyMap[group] || 'SkillsGroupGeneral');
    },

    _getGroups: function () {
        var allGeneral = (this._getResolvedItems ? this._getResolvedItems() : []);
        var half = Math.ceil(allGeneral.length / 2);
        var leftIds = {};
        for (var i = 0; i < half; i++) {
            if (allGeneral[i]) leftIds[allGeneral[i].id] = true;
        }

        return [
            {
                key: 'general',
                title: this._getGroupTitle('general'),
                cardId: 'skills-card-general',
                listId: 'skills-list-general',
                filter: function (item) { return !!leftIds[item.id]; }
            },
            {
                key: 'general-right',
                title: this._getGroupTitle('general'),
                cardId: 'skills-card-erp',
                listId: 'skills-list-erp',
                filter: function (item) { return !leftIds[item.id]; }
            }
        ];
    },

    _isRequirementMet: function () {
        return true;
    },

    _getResolvedItems: function () {
        var L = Bridge.lang.bind(Bridge);
        var catalog = this._catalog || [];
        return catalog.map(function (item) {
            return {
                id: item.id,
                icon: item.icon,
                order: item.order || 0,
                command: '/' + item.id,
                category: item.category,
                requirement: item.requirement,
                name: L(item.nameKey) || item.id,
                description: L(item.descKey) || item.id
            };
        }, this).filter(function (item) {
            return this._isRequirementMet(item.requirement);
        }, this).sort(function (a, b) {
            return a.order - b.order;
        });
    },

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

    _showDialog: function (options) {
        var overlay = document.getElementById('skills-dialog-overlay');
        var title = document.getElementById('skills-dialog-title');
        var body = document.getElementById('skills-dialog-body');
        var yesBtn = document.getElementById('skills-dialog-yes');
        var noBtn = document.getElementById('skills-dialog-no');
        if (!overlay || !title || !body || !yesBtn || !noBtn) return;

        this._dialogState = options || {};
        title.textContent = options.title || '';
        body.innerHTML = options.html || '';
        yesBtn.textContent = options.yesText || (Bridge.lang('ConfirmYes') || 'Yes');
        noBtn.textContent = options.noText || (Bridge.lang('ConfirmNo') || 'No');
        noBtn.classList.toggle('hidden', !!options.hideCancel);
        overlay.classList.remove('hidden');
    },

    _closeDialog: function () {
        var overlay = document.getElementById('skills-dialog-overlay');
        if (overlay) overlay.classList.add('hidden');
        this._dialogState = null;
    },

    _confirm: function (title, html, cb) {
        var t = this._copy();
        this._showDialog({
            title: title,
            html: html,
            yesText: t.confirmYes,
            noText: t.confirmNo,
            onConfirm: function () { cb(true); },
            onCancel: function () { cb(false); }
        });
    },

    _alert: function (title, html) {
        var t = this._copy();
        this._showDialog({
            title: title,
            html: html,
            yesText: t.close,
            hideCancel: true
        });
    },

    _ensureSelectionState: function () {
        var items = this._getResolvedItems();
        if (!this._selected) {
            this._selected = {};
            for (var i = 0; i < items.length; i++) {
                this._selected[items[i].id] = true;
            }
            return;
        }

        for (var j = 0; j < items.length; j++) {
            if (typeof this._selected[items[j].id] === 'undefined') {
                this._selected[items[j].id] = true;
            }
        }
    },

    _selectedCount: function () {
        var items = this._getResolvedItems();
        var count = 0;
        var selected = this._selected || {};
        for (var i = 0; i < items.length; i++) {
            if (selected[items[i].id]) count++;
        }
        return count;
    },

    _selectionStats: function () {
        var items = this._getResolvedItems();
        var selectedCount = this._selectedCount();
        return {
            total: items.length,
            selectedCount: selectedCount,
            allSelected: items.length > 0 && selectedCount === items.length
        };
    },


    _toggleSkill: function (id, checked) {
        if (!this._selected) this._selected = {};
        this._selected[id] = !!checked;
        this._updateActions();
    },

    _setAllSkills: function (checked) {
        var items = this._getResolvedItems();
        if (!this._selected) this._selected = {};
        for (var i = 0; i < items.length; i++) {
            this._selected[items[i].id] = !!checked;
        }
        this._renderList();
        this._updateActions();
    },

    _getSelectedSkillIds: function () {
        var selected = this._selected || {};
        return this._getResolvedItems()
            .filter(function (item) { return !!selected[item.id]; })
            .map(function (item) { return item.id; });
    },

    _getAllSkillIds: function () {
        return this._getResolvedItems().map(function (item) { return item.id; });
    },

    _renderTargetButtonContent: function (target) {
        var t = this._copy();
        var installing = this._installingTarget === target;
        var iconHtml = installing
            ? '<span class="mi btn-icon spin">sync</span>'
            : (
                '<span class="skills-target-btn-icon" aria-hidden="true">' +
                    '<img src="assets/devtools/' + (target === 'codex' ? 'openai-symbol.svg' : 'claude.svg') + '"' +
                        ' class="skills-target-btn-icon-img' + (target === 'codex' ? ' skills-target-btn-icon-img-contrast' : '') + '"' +
                        ' alt="">' +
                '</span>'
            );
        var label = installing
            ? t.installing
            : (target === 'codex' ? t.installCodex : t.installClaude);
        if (installing) {
            return iconHtml + ' ' + this._escapeHtml(label);
        }
        return '' +
            '<span class="mi btn-icon">add</span>' +
            '<span class="skills-target-btn-label">' + this._escapeHtml(label) + '</span>' +
            iconHtml;
    },

    _updateActions: function () {
        var t = this._copy();
        var count = this._selectedCount();
        var stats = this._selectionStats();
        var countEl = document.getElementById('skills-selected-count');
        var claudeBtn = document.getElementById('skills-install-claude-btn');
        var codexBtn = document.getElementById('skills-install-codex-btn');
        var masterToggle = document.getElementById('skills-master-toggle');
        var masterLabel = document.getElementById('skills-master-toggle-label');
        if (countEl) {
            countEl.textContent = count + ' ' + t.selectedSuffix;
        }
        if (masterToggle) {
            masterToggle.checked = stats.allSelected;
            masterToggle.indeterminate = !stats.allSelected && count > 0;
        }
        if (masterLabel) {
            masterLabel.textContent = stats.allSelected ? t.selectNone : t.selectAll;
        }
        if (claudeBtn) {
            claudeBtn.disabled = this._installing || count === 0;
            claudeBtn.innerHTML = this._renderTargetButtonContent('claude');
        }
        if (codexBtn) {
            codexBtn.disabled = this._installing || count === 0;
            codexBtn.innerHTML = this._renderTargetButtonContent('codex');
        }
    },

    _requestTargetInstall: function (target) {
        var L = Bridge.lang.bind(Bridge);
        var skills = this._getSelectedSkillIds();

        if (!skills.length) {
            this._toast(L('ResultFailed'), L('MessageNoSkillsSelected'), 'error', 5000);
            return;
        }

        if (Bridge._initData && Bridge._initData.skillsRepoFound === false) {
            this._toast(L('ResultFailed'), L('MessageSkillsRepoNotFound'), 'error', 5000);
            return;
        }

        // Skip second confirm — first confirm dialog already shown by caller
        this._pendingInstallRequest = { target: target, skills: skills };
        this._installing = true;
        this._installingTarget = target;
        this._updateActions();
        Bridge.send('checkSkillsTargetPrerequisites', { target: target });
    },

    _handleTargetPrereqResult: function (data) {
        var t = this._copy();
        if (!data || !this._pendingInstallRequest || data.target !== this._pendingInstallRequest.target) {
            return;
        }

        if (data.ok) {
            Bridge.send('installSkills', {
                skills: this._pendingInstallRequest.skills,
                target: this._pendingInstallRequest.target
            });
            return;
        }

        this._installing = false;
        this._installingTarget = '';
        this._pendingInstallRequest = null;
        this._updateActions();
        this._alert(
            data.target === 'codex' ? t.confirmCodexTitle : t.confirmClaudeTitle,
            '<p>' + this._escapeHtml(data.target === 'codex' ? t.missingCodexPrereq : t.missingClaudePrereq) + '</p>'
        );
    },

    _matchesQuery: function (item, query) {
        if (!query) return true;
        var haystack = [
            item.id,
            item.name,
            item.description,
            item.command,
            this._getCategoryLabel(item.category)
        ].join(' ').toLowerCase();
        return haystack.indexOf(query) !== -1;
    },

    _renderRow: function (item) {
        var tooltip = item.description;
        var checked = !!(this._selected && this._selected[item.id]);
        return '' +
        '<div class="mcp-server-row skills-row">' +
            '<label class="skills-row-check">' +
                '<input type="checkbox" class="skills-item-checkbox" data-skill="' + this._escapeHtml(item.id) + '"' + (checked ? ' checked' : '') + '>' +
                '<span class="skills-row-check-mark"></span>' +
            '</label>' +
            '<div class="skills-row-icon"><span class="mi">' + this._escapeHtml(item.icon) + '</span></div>' +
            '<div class="mcp-server-info skills-row-info" title="' + this._escapeHtml(tooltip) + '">' +
                '<div class="skills-row-top">' +
                    '<span class="mcp-server-name skills-row-name">' + this._escapeHtml(item.name) + '</span>' +
                '</div>' +
                '<div class="skills-row-meta">' +
                    '<span class="skills-command-chip">' + this._escapeHtml(item.command) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="mcp-server-actions">' +
                '<button class="btn-mcp-remove btn btn-sm btn-secondary btn-danger-outline skills-row-action" data-skill-action="' + this._escapeHtml(item.id) + '" title="' + (Bridge.lang('PrereqRemoveTooltip') || 'Remove') + '"><span class="mi" style="font-size:16px">delete</span></button>' +
            '</div>' +
        '</div>';
    },

    _renderGroupCard: function (group) {
        return '' +
        '<div class="card mcp-col-card skills-col-card" id="' + this._escapeHtml(group.cardId) + '" data-group="' + this._escapeHtml(group.key) + '">' +
            '<div class="card-body">' +
                '<div class="skills-card-shell">' +
                    '<div class="skills-card-header">' +
                        '<div class="skills-card-title">' + this._escapeHtml(group.title) + '</div>' +
                    '</div>' +
                    '<div class="skills-card-scroll">' +
                        '<div id="' + this._escapeHtml(group.listId) + '" class="skills-list"></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    _renderList: function () {
        var searchInput = document.getElementById('skills-catalog-search');
        var query = ((searchInput && searchInput.value) || '').trim().toLowerCase();
        var groups = this._getGroups();
        var groupGrid = document.getElementById('skills-group-grid');
        var empty = document.getElementById('skills-catalog-empty');
        if (!empty) return;
        this._ensureSelectionState();

        var items = this._getResolvedItems().filter(function (item) {
            return this._isRequirementMet(item.requirement) && this._matchesQuery(item, query);
        }, this);

        groups.forEach(function (group) {
            var list = document.getElementById(group.listId);
            var card = document.getElementById(group.cardId);
            if (list) list.innerHTML = '';
            if (card) card.classList.remove('hidden');
        });

        if (!items.length) {
            groups.forEach(function (group) {
                var card = document.getElementById(group.cardId);
                if (card) card.classList.add('hidden');
            });
            if (groupGrid) {
                groupGrid.classList.add('skills-group-grid-single');
            }
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        var visibleGroupCount = 0;

        groups.forEach(function (group) {
            var groupItems = items.filter(group.filter);
            var list = document.getElementById(group.listId);
            var card = document.getElementById(group.cardId);
            if (list) {
                list.innerHTML = groupItems.map(this._renderRow.bind(this)).join('');
            }
            if (card) {
                var visible = groupItems.length > 0;
                card.classList.toggle('hidden', !visible);
                if (visible) visibleGroupCount++;
            }
        }, this);

        if (groupGrid) {
            groupGrid.classList.toggle('skills-group-grid-single', visibleGroupCount <= 1);
        }

        document.querySelectorAll('.skills-item-checkbox').forEach(function (checkbox) {
            checkbox.addEventListener('change', function (event) {
                event.stopPropagation();
                this._toggleSkill(checkbox.getAttribute('data-skill'), checkbox.checked);
            }.bind(this));
        }, this);

        this._updateActions();
    },

    render: function () {
        var t = this._copy();
        var groups = this._getGroups();
        return '' +
        '<div class="subpage-layout mcp-page-layout skills-page-layout">' +
            '<div class="mcp-page-header">' +
                '<span class="mi" style="font-size:20px;color:var(--accent-blue)">widgets</span>' +
                '<span style="font-size:14px;font-weight:600">' + this._escapeHtml(t.title) + '</span>' +
                '<span style="flex:1"></span>' +
                '<button class="btn btn-primary mcp-guide-btn" id="skills-guide-btn">' +
                    '<span class="mi">menu_book</span> ' + (Bridge.lang('SkillsGuideBtn') || 'Skills Guide') +
                '</button>' +
            '</div>' +
            '<div class="mcp-page-scroll">' +
                '<p class="mcp-desc">' + this._escapeHtml(t.description) + '</p>' +
                '<div class="skills-card-toolbar">' +
                    '<div class="skills-toolbar-summary">' +
                        '<label class="skills-master-toggle">' +
                            '<span class="skills-row-check">' +
                                '<input id="skills-master-toggle" type="checkbox">' +
                                '<span class="skills-row-check-mark"></span>' +
                            '</span>' +
                            '<span id="skills-master-toggle-label" class="skills-master-toggle-label">' + this._escapeHtml(t.selectAll) + '</span>' +
                        '</label>' +
                        '<span id="skills-selected-count" class="skills-selected-count">0 ' + this._escapeHtml(t.selectedSuffix) + '</span>' +
                    '</div>' +
                '</div>' +
                '<div id="skills-group-grid" class="mcp-two-col skills-group-grid' + (groups.length === 1 ? ' skills-group-grid-single' : '') + '">' +
                    groups.map(this._renderGroupCard.bind(this)).join('') +
                '</div>' +
                '<div id="skills-catalog-empty" class="skills-empty hidden">' + this._escapeHtml(t.noResult) + '</div>' +
                '<div style="display:flex;justify-content:flex-end;gap:8px;padding:8px 0 30px">' +
                    '<div class="split-btn-group" id="skills-codex-split-group">' +
                        '<button class="btn btn-primary split-btn-main skills-target-btn" id="skills-install-codex-btn" style="background:#333">' +
                            '<img src="assets/devtools/openai-symbol.svg" style="width:16px;height:16px;filter:brightness(0) invert(1)" alt=""> ' +
                            (Bridge.lang('SkillsAddSelectedToCodex') || 'Add to Codex') +
                        '</button>' +
                        '<button id="skills-codex-split-toggle" class="btn btn-primary split-btn-toggle" style="background:#333">' +
                            '<span class="mi">arrow_drop_down</span>' +
                        '</button>' +
                        '<div id="skills-codex-split-menu" class="split-btn-menu">' +
                            '<button class="split-btn-menu-item" id="skills-remove-codex-btn">' +
                                '<img src="assets/devtools/openai-symbol.svg" style="width:14px;height:14px;margin-right:4px" alt=""> ' +
                                '<span>' + (Bridge.lang('SkillsRemoveSelectedFromCodex') || 'Remove from Codex') + '</span>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="split-btn-group" id="skills-split-group">' +
                        '<button class="btn btn-primary split-btn-main skills-target-btn" id="skills-install-claude-btn">' +
                            '<img src="assets/devtools/claude.svg" style="width:16px;height:16px;filter:brightness(0) invert(1)" alt=""> ' +
                            (Bridge.lang('SkillsAddSelectedToClaude') || 'Add to Claude') +
                        '</button>' +
                        '<button id="skills-split-toggle" class="btn btn-primary split-btn-toggle">' +
                            '<span class="mi">arrow_drop_down</span>' +
                        '</button>' +
                        '<div id="skills-split-menu" class="split-btn-menu">' +
                            '<button class="split-btn-menu-item" id="skills-remove-selected-btn">' +
                                '<img src="assets/devtools/claude.svg" style="width:14px;height:14px;margin-right:4px" alt=""> ' +
                                '<span>' + (Bridge.lang('SkillsRemoveSelectedFromClaude') || 'Remove from Claude') + '</span>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="bp-page-actions subpage-footer" style="justify-content:flex-end">' +
                '<button class="btn btn-secondary" id="skills-close-btn">' +
                    '<span class="mi btn-icon">close</span> ' + this._escapeHtml(t.close) +
                '</button>' +
            '</div>' +
        '</div>' +
        '<div id="skills-dialog-overlay" class="modal-overlay hidden">' +
            '<div class="modal-dialog">' +
                '<div class="modal-header"><span class="modal-title" id="skills-dialog-title"></span></div>' +
                '<div class="modal-body" id="skills-dialog-body"></div>' +
                '<div class="modal-footer">' +
                    '<button id="skills-dialog-no" class="btn btn-secondary">' + this._escapeHtml(t.confirmNo) + '</button>' +
                    '<button id="skills-dialog-yes" class="btn btn-primary">' + this._escapeHtml(t.confirmYes) + '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    afterRender: function () {
        var self = this;
        this._selected = this._selected || {};
        this._installing = false;
        this._installingTarget = '';
        this._pendingInstallRequest = null;
        // Close button
        var closeBtn = document.getElementById('skills-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', function () { Bridge.send('closeWindow'); });

        // Skills Guide button
        var guideBtn = document.getElementById('skills-guide-btn');
        if (guideBtn) guideBtn.addEventListener('click', function () { Bridge.send('openSkillUsage'); });

        // Codex split dropdown toggle
        var codexSplitGroup = document.getElementById('skills-codex-split-group');
        var codexSplitToggle = document.getElementById('skills-codex-split-toggle');
        if (codexSplitToggle && codexSplitGroup) {
            codexSplitToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                codexSplitGroup.classList.toggle('show');
            });
            document.addEventListener('click', function (e) {
                if (!codexSplitGroup.contains(e.target)) codexSplitGroup.classList.remove('show');
            });
        }

        // Add to Codex
        var codexBtn = document.getElementById('skills-install-codex-btn');
        if (codexBtn) {
            codexBtn.addEventListener('click', function () {
                if (codexSplitGroup) codexSplitGroup.classList.remove('show');
                var skills = self._getSelectedSkillIds();
                if (!skills.length) return;
                self._confirm(
                    Bridge.lang('SkillsConfirmAddCodexTitle') || 'Add to Codex',
                    (Bridge.lang('SkillsConfirmAddCodexBody') || 'Install selected skills to Codex?') + '<br><br><b>' + skills.join(', ') + '</b>',
                    function (ok) { if (ok) self._requestTargetInstall('codex'); }
                );
            });
        }

        // Remove from Codex
        var removeCodexBtn = document.getElementById('skills-remove-codex-btn');
        if (removeCodexBtn) {
            removeCodexBtn.addEventListener('click', function () {
                if (codexSplitGroup) codexSplitGroup.classList.remove('show');
                var skills = self._getSelectedSkillIds();
                if (!skills.length) return;
                self._confirm(
                    Bridge.lang('SkillsConfirmRemoveTitle') || 'Remove Skills',
                    (Bridge.lang('SkillsRemoveSelectedFromCodex') || 'Remove selected skills from Codex?') + '<br><br><b>' + skills.join(', ') + '</b>',
                    function (ok) { if (ok) Bridge.send('removeSkills', { skills: skills, target: 'codex' }); }
                );
            });
        }

        // Claude split dropdown toggle
        var skillsSplitGroup = document.getElementById('skills-split-group');
        var skillsSplitToggle = document.getElementById('skills-split-toggle');
        if (skillsSplitToggle && skillsSplitGroup) {
            skillsSplitToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                skillsSplitGroup.classList.toggle('show');
            });
            document.addEventListener('click', function (e) {
                if (!skillsSplitGroup.contains(e.target)) skillsSplitGroup.classList.remove('show');
            });
        }

        var masterToggle = document.getElementById('skills-master-toggle');
        if (masterToggle) {
            masterToggle.addEventListener('change', function () {
                self._setAllSkills(masterToggle.checked);
            });
        }

        // Add Selected to Claude (main button)
        var claudeBtn = document.getElementById('skills-install-claude-btn');
        if (claudeBtn) {
            claudeBtn.addEventListener('click', function () {
                if (skillsSplitGroup) skillsSplitGroup.classList.remove('show');
                var skills = self._getSelectedSkillIds();
                if (!skills.length) return;
                self._confirm(
                    Bridge.lang('SkillsConfirmAddClaudeTitle') || 'Add to Claude',
                    (Bridge.lang('SkillsConfirmAddClaudeBody') || 'Install selected skills?') + '<br><br><b>' + skills.join(', ') + '</b>',
                    function (ok) { if (ok) self._requestTargetInstall('claude'); }
                );
            });
        }

        // Remove Selected (dropdown)
        var removeSelectedBtn = document.getElementById('skills-remove-selected-btn');
        if (removeSelectedBtn) {
            removeSelectedBtn.addEventListener('click', function () {
                if (skillsSplitGroup) skillsSplitGroup.classList.remove('show');
                var skills = self._getSelectedSkillIds();
                if (!skills.length) return;
                self._confirm(
                    Bridge.lang('SkillsConfirmRemoveTitle') || 'Remove Skills',
                    (Bridge.lang('SkillsConfirmRemoveBody') || 'Remove selected skills?') + '<br><br><b>' + skills.join(', ') + '</b>',
                    function (ok) { if (ok) Bridge.send('removeSkills', { skills: skills, target: 'claude' }); }
                );
            });
        }

        // Per-skill remove buttons
        document.querySelectorAll('.skills-row-action').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var skillId = btn.getAttribute('data-skill-action');
                if (!skillId) return;
                self._confirm(
                    Bridge.lang('SkillsConfirmRemoveTitle') || 'Remove Skill',
                    (Bridge.lang('SkillsConfirmRemoveSingleBody') || 'Remove this skill?') + '<br><br><b>' + skillId + '</b>',
                    function (ok) { if (ok) Bridge.send('removeSkills', { skills: [skillId], target: 'claude' }); }
                );
            });
        });

        // Remove result handler
        Bridge.on('removeSkillsResult', function (d) {
            self._toast(Bridge.lang('CommonDone') || 'Done',
                (d && d.results ? d.results.length : 0) + ' skill(s) removed', 'info', 4000);
        });

        var dialogOverlay = document.getElementById('skills-dialog-overlay');
        var dialogYes = document.getElementById('skills-dialog-yes');
        var dialogNo = document.getElementById('skills-dialog-no');
        if (dialogOverlay) {
            dialogOverlay.addEventListener('click', function (event) {
                if (event.target !== dialogOverlay) return;
                if (self._dialogState && self._dialogState.onCancel) {
                    self._dialogState.onCancel();
                }
                self._closeDialog();
            });
        }
        if (dialogYes) {
            dialogYes.addEventListener('click', function () {
                var dialogState = self._dialogState;
                self._closeDialog();
                if (dialogState && dialogState.onConfirm) {
                    dialogState.onConfirm();
                }
            });
        }
        if (dialogNo) {
            dialogNo.addEventListener('click', function () {
                var dialogState = self._dialogState;
                self._closeDialog();
                if (dialogState && dialogState.onCancel) {
                    dialogState.onCancel();
                }
            });
        }

        var searchInput = document.getElementById('skills-catalog-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                self._renderList();
            });
        }


        Bridge.on('installSkillsResult', function (data) {
            self._installing = false;
            self._installingTarget = '';
            self._pendingInstallRequest = null;
            self._updateActions();
            if (data && data.success) {
                var t = self._copy();
                self._toast(
                    Bridge.lang('ResultComplete'),
                    data.target === 'codex' ? t.doneCodex : t.doneClaude,
                    'success',
                    5000
                );
            } else if (data) {
                self._toast(Bridge.lang('ResultFailed'), data.message || Bridge.lang('CommonError'), 'error', 5000);
            }
        });

        Bridge.on('skillsTargetPrereqResult', function (data) {
            self._handleTargetPrereqResult(data);
        });

        Bridge.on('error', function (data) {
            self._installing = false;
            self._installingTarget = '';
            self._pendingInstallRequest = null;
            self._updateActions();
            if (data && data.message) {
                self._toast(Bridge.lang('CommonError'), data.message, 'error', 5000);
            }
        });

        this._ensureCatalogLoaded()
            .then(function (catalog) {
                self._catalog = catalog || [];
                self._renderList();
            })
            .catch(function (err) {
                var empty = document.getElementById('skills-catalog-empty');
                if (empty) {
                    empty.classList.remove('hidden');
                    empty.textContent = Bridge.lang('CommonError') + ': ' + err.message;
                }
            });
    }
};
