// MCP Server & Plugin Page — runs inside SubWindow
window.McpServersPage = {

    _allIntegrations: [
        { id: 'figma', icon: 'assets/mcp/figma.svg', nameKey: 'McpFigmaName', descKey: 'McpFigmaDesc', type: 'plugin', needsAuth: true },
        { id: 'postman', icon: 'assets/mcp/postman.svg', nameKey: 'McpPostmanName', descKey: 'McpPostmanDesc', type: 'mcp', transport: 'http', auth: 'oauth', fields: [] },
        { id: 'atlassian', icon: 'assets/mcp/jira.svg', nameKey: 'McpJiraName', descKey: 'McpJiraDesc', type: 'mcp', transport: 'http', auth: 'oauth', fields: [] },
        { id: 'github', icon: 'assets/mcp/github.svg', nameKey: 'McpGithubName', descKey: 'McpGithubDesc', type: 'plugin', needsAuth: true },
        { id: 'postgres', icon: 'assets/mcp/postgres.svg', nameKey: 'McpPostgresName', descKey: 'McpPostgresDesc', type: 'mcp', transport: 'stdio', auth: 'manual', fields: [
            { key: 'host', labelKey: 'McpFormHost', type: 'text', default: 'localhost', required: true },
            { key: 'port', labelKey: 'McpFormPort', type: 'text', default: '5432', required: true },
            { key: 'database', labelKey: 'McpFormDatabase', type: 'text', default: '', required: true },
            { key: 'username', labelKey: 'McpFormUsername', type: 'text', default: '', required: true },
            { key: 'password', labelKey: 'McpFormPassword', type: 'password', default: '', required: true }
        ], hasTestConnection: true },
        { id: 'superpowers', icon: 'assets/mcp/superpowers.svg', nameKey: 'PluginSuperpowersName', descKey: 'PluginSuperpowersDesc', type: 'plugin' },
        { id: 'playwright', icon: 'assets/mcp/playwright.svg', nameKey: 'PluginPlaywrightName', descKey: 'PluginPlaywrightDesc', type: 'plugin' },
        { id: 'typescript-lsp', icon: 'assets/mcp/typescript-lsp.svg', nameKey: 'PluginTypescriptLspName', descKey: 'PluginTypescriptLspDesc', type: 'plugin' },
        { id: 'security-guidance', icon: 'assets/mcp/security-guidance.svg', nameKey: 'PluginSecurityGuidanceName', descKey: 'PluginSecurityGuidanceDesc', type: 'plugin' },
        { id: 'code-review', icon: 'assets/mcp/code-review.svg', nameKey: 'PluginCodeReviewName', descKey: 'PluginCodeReviewDesc', type: 'plugin' },
        { id: 'frontend-design', icon: 'assets/mcp/frontend-design.svg', nameKey: 'PluginFrontendDesignName', descKey: 'PluginFrontendDesignDesc', type: 'plugin' },
        { id: 'code-simplifier', icon: 'assets/mcp/code-simplifier.svg', nameKey: 'PluginCodeSimplifierName', descKey: 'PluginCodeSimplifierDesc', type: 'plugin' }
    ],

    _pluginInstalledMap: {},
    _mcpInstalledMap: {},
    _pluginChecking: true,
    _mcpChecking: true,
    _mcpFormState: null,
    _mcpPendingSubmit: null,
    _mcpSubmitBusy: false,
    _installAllNext: null,

    render: function () {
        var L = Bridge.lang.bind(Bridge);
        return '' +
        '<div class="subpage-layout mcp-page-layout">' +
            '<div class="mcp-page-header">' +
                '<span class="mi" style="font-size:20px;color:var(--accent-blue)">hub</span>' +
                '<span style="font-size:14px;font-weight:600">' + (L('McpTitle') || 'MCP Server & Plugin') + '</span>' +
                '<span style="flex:1"></span>' +
                '<button class="btn btn-primary mcp-guide-btn" id="mcp-guide-btn">' +
                    '<span class="mi">menu_book</span> ' + (L('McpGuideBtn') || 'MCP & Plugin Guide') +
                '</button>' +
            '</div>' +
            '<div class="mcp-page-scroll">' +
                '<p class="mcp-desc" style="margin-bottom:8px">' + (L('McpDescription') || '') + '</p>' +
                '<div class="mcp-two-col">' +
                    '<div class="card mcp-col-card">' +
                        '<div class="card-body" style="padding:8px">' +
                            '<div id="mcp-server-list-left" class="mcp-server-list"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="card mcp-col-card">' +
                        '<div class="card-body" style="padding:8px">' +
                            '<div id="mcp-server-list-right" class="mcp-server-list"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;padding:8px 0 4px">' +
                    '<div class="split-btn-group" id="mcp-split-group">' +
                        '<button id="mcp-install-all-btn" class="btn btn-primary split-btn-main">' +
                            '<span class="mi btn-icon">download</span> ' + (L('McpInstallSelected') || 'Install Selected') +
                        '</button>' +
                        '<button id="mcp-split-toggle" class="btn btn-primary split-btn-toggle">' +
                            '<span class="mi">arrow_drop_down</span>' +
                        '</button>' +
                        '<div id="mcp-split-menu" class="split-btn-menu">' +
                            '<button id="mcp-remove-all-btn" class="split-btn-menu-item">' +
                                '<span class="mi">delete_outline</span> ' +
                                '<span>' + (L('McpRemoveSelected') || 'Remove Selected') + '</span>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="bp-page-actions subpage-footer" style="justify-content:flex-end">' +
                '<button class="btn btn-secondary" id="mcp-close-btn">' +
                    '<span class="mi btn-icon">close</span> ' + (L('BtnClose') || 'Close') +
                '</button>' +
            '</div>' +
        '</div>' +
        '<div id="mcp-modal-overlay" class="modal-overlay hidden">' +
            '<div class="modal-dialog" style="width:460px">' +
                '<div class="modal-header">' +
                    '<span class="modal-title" id="mcp-modal-title"></span>' +
                    '<button class="modal-close" id="mcp-modal-close"><span class="mi">close</span></button>' +
                '</div>' +
                '<div class="modal-body" id="mcp-modal-body"></div>' +
                '<div class="modal-footer" id="mcp-modal-footer"></div>' +
            '</div>' +
        '</div>' +
        '<div id="mcp-confirm-overlay" class="modal-overlay hidden">' +
            '<div class="modal-dialog">' +
                '<div class="modal-header"><span class="modal-title" id="mcp-confirm-title"></span></div>' +
                '<div class="modal-body" id="mcp-confirm-body"></div>' +
                '<div class="modal-footer">' +
                    '<button id="mcp-confirm-no" class="btn btn-secondary">' + (L('ConfirmNo') || 'No') + '</button>' +
                    '<button id="mcp-confirm-yes" class="btn btn-primary">' + (L('ConfirmYes') || 'Yes') + '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    afterRender: function () {
        var self = this;
        var L = Bridge.lang.bind(Bridge);

        // Close button
        var closeBtn = document.getElementById('mcp-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', function () { Bridge.send('closeWindow'); });

        // Close button
        var mcpCloseBtn = document.getElementById('mcp-close-btn');
        if (mcpCloseBtn) mcpCloseBtn.addEventListener('click', function () { Bridge.send('closeWindow'); });

        // Guide button
        var guideBtn = document.getElementById('mcp-guide-btn');
        if (guideBtn) guideBtn.addEventListener('click', function () { Bridge.send('openMcpGuide'); });

        // Install All
        var installAllBtn = document.getElementById('mcp-install-all-btn');
        if (installAllBtn) installAllBtn.addEventListener('click', function () { self._installAll(); });

        // Split dropdown toggle
        var mcpSplitGroup = document.getElementById('mcp-split-group');
        var mcpSplitToggle = document.getElementById('mcp-split-toggle');
        if (mcpSplitToggle && mcpSplitGroup) {
            mcpSplitToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                mcpSplitGroup.classList.toggle('show');
            });
            document.addEventListener('click', function (e) {
                if (!mcpSplitGroup.contains(e.target)) mcpSplitGroup.classList.remove('show');
            });
        }

        // Remove All
        var removeAllBtn = document.getElementById('mcp-remove-all-btn');
        if (removeAllBtn) removeAllBtn.addEventListener('click', function () {
            if (mcpSplitGroup) mcpSplitGroup.classList.remove('show');
            self._removeAll();
        });

        // Modal close
        var modalClose = document.getElementById('mcp-modal-close');
        if (modalClose) modalClose.addEventListener('click', function () {
            if (self._mcpSubmitBusy) return;
            self._closeMcpModal();
        });
        var modalOverlay = document.getElementById('mcp-modal-overlay');
        if (modalOverlay) modalOverlay.addEventListener('click', function (e) {
            if (e.target === modalOverlay && !self._mcpSubmitBusy) self._closeMcpModal();
        });

        // Confirm dialog
        this._confirmCb = null;
        document.getElementById('mcp-confirm-yes').addEventListener('click', function () {
            document.getElementById('mcp-confirm-overlay').classList.add('hidden');
            if (self._confirmCb) { self._confirmCb(true); self._confirmCb = null; }
        });
        document.getElementById('mcp-confirm-no').addEventListener('click', function () {
            document.getElementById('mcp-confirm-overlay').classList.add('hidden');
            if (self._confirmCb) { self._confirmCb(false); self._confirmCb = null; }
        });

        // Bridge events
        Bridge.on('mcpInstallResult', function (d) { self._onMcpInstallResult(d); });
        Bridge.on('mcpTestResult', function (d) { self._onMcpTestResult(d); });
        Bridge.on('mcpStatusResult', function (d) { self._onMcpStatusResult(d); });
        Bridge.on('mcpConfigResult', function (d) { self._onMcpConfigResult(d); });
        Bridge.on('mcpSaveResult', function (d) { self._onMcpSaveResult(d); });
        Bridge.on('mcpRemoveResult', function (d) { self._onMcpRemoveResult(d); });
        Bridge.on('pluginInstallResult', function (d) { self._onPluginInstallResult(d); });
        Bridge.on('pluginRemoveResult', function (d) { self._onPluginRemoveResult(d); });
        Bridge.on('pluginStatusResult', function (d) { self._onPluginStatusResult(d); });

        // Check status (small delay ensures WebView is ready for responses)
        this._renderList();
        setTimeout(function () {
            Bridge.send('checkMcpStatus');
            Bridge.send('checkPluginStatus');
        }, 300);

        // Fallback: if no response in 10s, stop checking
        setTimeout(function () {
            if (self._pluginChecking || self._mcpChecking) {
                self._pluginChecking = false;
                self._mcpChecking = false;
                self._renderList();
            }
        }, 10000);
    },

    _confirm: function (title, html, cb) {
        this._confirmCb = cb;
        document.getElementById('mcp-confirm-title').textContent = title;
        document.getElementById('mcp-confirm-body').innerHTML = html;
        document.getElementById('mcp-confirm-overlay').classList.remove('hidden');
    },

    _toast: function (title, message, type, duration) {
        // Use parent window Toast if available, otherwise basic
        if (window.Toast) { Toast.show(title, message, type, duration); return; }
        var c = document.getElementById('toast-container');
        if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
        var t = document.createElement('div');
        t.className = 'toast toast-' + (type || 'info');
        t.style.cssText = 'cursor:pointer';
        var icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
        var dismiss = function () {
            t.classList.remove('toast-visible'); t.classList.add('toast-hiding');
            setTimeout(function () { t.remove(); }, 300);
        };
        t.innerHTML = '<span class="mi toast-icon">' + (icons[type] || 'info') + '</span>' +
            '<div class="toast-content">' +
            (title ? '<div class="toast-title">' + title + '</div>' : '') +
            (message ? '<div class="toast-message">' + message + '</div>' : '') + '</div>' +
            '<button class="toast-close mi">close</button>';
        c.appendChild(t);
        t.querySelector('.toast-close').addEventListener('click', function (e) { e.stopPropagation(); dismiss(); });
        requestAnimationFrame(function () { t.classList.add('toast-visible'); });
        setTimeout(function () {
            t.classList.remove('toast-visible'); t.classList.add('toast-hiding');
            setTimeout(function () { t.remove(); }, 300);
        }, duration || 4000);
    },

    _L: function (key) { return Bridge.lang(key); },

    _getItem: function (id) {
        for (var i = 0; i < this._allIntegrations.length; i++) {
            if (this._allIntegrations[i].id === id) return this._allIntegrations[i];
        }
        return null;
    },

    _collectMcpFormValues: function (item) {
        var values = {};
        if (!item || !item.fields) return values;
        item.fields.forEach(function (f) {
            var inp = document.getElementById('mcp-field-' + f.key);
            values[f.key] = inp ? inp.value.trim() : '';
        });
        return values;
    },

    _isMcpFormValid: function (item) {
        if (!item || !item.fields) return true;
        for (var i = 0; i < item.fields.length; i++) {
            var field = item.fields[i];
            if (!field.required) continue;
            var inp = document.getElementById('mcp-field-' + field.key);
            if (!inp || !inp.value.trim()) return false;
        }
        return true;
    },

    _setMcpFormResult: function (state, text) {
        var resultEl = document.getElementById('mcp-test-result');
        if (!resultEl) return;
        resultEl.className = state ? ('mcp-test-result ' + state) : 'mcp-test-result';
        resultEl.textContent = text || '';
    },

    _setMcpFormBusy: function (busy) {
        this._mcpSubmitBusy = !!busy;
        var installBtn = document.getElementById('mcp-btn-install');
        var cancelBtn = document.getElementById('mcp-btn-cancel');
        var closeBtn = document.getElementById('mcp-modal-close');
        var state = this._mcpFormState;
        if (installBtn && state) {
            var label = state.editMode ? this._L('McpSaveConfig') : this._L('McpInstallBtn');
            var icon = state.editMode ? 'save' : 'download';
            var iconStyle = 'font-size:16px';
            if (busy) {
                label = state.item.hasTestConnection ? this._L('McpTestTesting') : label;
                icon = 'hourglass_empty';
                iconStyle += ';animation:spin 1s linear infinite';
            }
            installBtn.disabled = busy || !this._isMcpFormValid(state.item);
            installBtn.innerHTML = '<span class="mi btn-icon" style="' + iconStyle + '">' + icon + '</span> ' + label;
        }
        if (cancelBtn) cancelBtn.disabled = !!busy;
        if (closeBtn) closeBtn.disabled = !!busy;
    },

    _closeMcpModal: function () {
        var overlay = document.getElementById('mcp-modal-overlay');
        if (overlay) overlay.classList.add('hidden');
        this._mcpFormState = null;
        this._mcpPendingSubmit = null;
        this._mcpSubmitBusy = false;
    },

    _performMcpSubmit: function (pending) {
        if (!pending) return;
        this._closeMcpModal();
        if (pending.editMode) {
            Bridge.send('saveMcpConfig', { id: pending.id, values: pending.values });
        } else {
            Bridge.send('installMcp', { id: pending.id, values: pending.values });
        }
    },

    _submitMcpForm: function () {
        var state = this._mcpFormState;
        if (!state || this._mcpSubmitBusy || !this._isMcpFormValid(state.item)) return;

        var pending = {
            id: state.item.id,
            values: this._collectMcpFormValues(state.item),
            editMode: state.editMode
        };

        if (!state.item.hasTestConnection) {
            this._performMcpSubmit(pending);
            return;
        }

        this._mcpPendingSubmit = pending;
        this._setMcpFormResult('testing', this._L('McpTestTesting'));
        this._setMcpFormBusy(true);
        Bridge.send('testMcpConnection', { id: pending.id, values: pending.values });
    },

    _renderList: function () {
        var self = this;
        var L = this._L;
        var leftContainer = document.getElementById('mcp-server-list-left');
        var rightContainer = document.getElementById('mcp-server-list-right');
        // Fallback for single container layout
        if (!leftContainer) {
            leftContainer = document.getElementById('mcp-server-list');
            rightContainer = null;
        }
        if (!leftContainer) return;
        leftContainer.innerHTML = '';
        if (rightContainer) rightContainer.innerHTML = '';

        var splitAt = 6; // First 6 items go left
        this._allIntegrations.forEach(function (item, index) {
            var isPlugin = item.type === 'plugin';
            var row = document.createElement('div');
            row.className = 'mcp-server-row';

            var installed = isPlugin ? self._pluginInstalledMap[item.id] : self._mcpInstalledMap[item.id];
            var checking = isPlugin ? self._pluginChecking : self._mcpChecking;
            var typeBadge = isPlugin
                ? '<span class="mcp-type-badge mcp-type-plugin">' + L('McpPluginSection') + '</span>'
                : '<span class="mcp-type-badge mcp-type-mcp">MCP</span>';
            var actionsHtml = '';

            if (checking) {
                actionsHtml = '<span class="mcp-checking"><span class="mi" style="font-size:16px;animation:spin 1s linear infinite">hourglass_empty</span></span>';
            } else if (installed) {
                if (item.type === 'mcp' && item.fields && item.fields.length > 0) {
                    actionsHtml += '<button class="btn-mcp-edit btn btn-sm btn-secondary" title="' + L('McpViewEditConfig') + '"><span class="mi" style="font-size:16px">settings</span></button>';
                }
                actionsHtml += '<button class="btn-mcp-remove btn btn-sm btn-secondary btn-danger-outline" title="' + L('McpRemove') + '"><span class="mi" style="font-size:16px">delete</span></button>';
            } else {
                actionsHtml = '<button class="btn-install" title="' + L('McpInstallBtn') + '"><span class="mi">download</span></button>';
            }

            var tooltipText = L(item.descKey) + '\n' + (L('McpGuideTooltip') || 'See the Guide for details.');
            row.innerHTML =
                '<input type="checkbox" class="mcp-row-cb" data-mcp-id="' + item.id + '" data-mcp-type="' + item.type + '"' + (installed ? '' : ' checked') + '>' +
                '<img class="mcp-server-icon' + (item.id === 'github' ? ' mcp-server-icon-invert-dark' : '') + '" src="' + item.icon + '" alt="">' +
                '<div class="mcp-server-info" title="' + tooltipText.replace(/"/g, '&quot;') + '"><div class="mcp-server-name">' + L(item.nameKey) + '</div>' + typeBadge + '</div>' +
                '<div class="mcp-server-actions">' + actionsHtml + '</div>';

            if (!checking) {
                if (installed) {
                    var editBtn = row.querySelector('.btn-mcp-edit');
                    if (editBtn) editBtn.addEventListener('click', function () { self._onEditClick(item); });
                    var removeBtn = row.querySelector('.btn-mcp-remove');
                    if (removeBtn) {
                        removeBtn.addEventListener('click', function () {
                            self._confirm(
                                L('McpRemove'),
                                '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
                                    '<img src="' + item.icon + '" style="width:36px;height:36px;border-radius:8px" alt="">' +
                                    '<div><strong>' + L(item.nameKey) + '</strong><br><span style="font-size:12px;color:var(--text-muted)">' + L(item.descKey) + '</span></div>' +
                                '</div>' +
                                '<p>' + (L('McpRemoveConfirm') || 'Are you sure you want to remove this integration?') + '</p>',
                                function (yes) {
                                if (yes) {
                                    removeBtn.disabled = true;
                                    removeBtn.innerHTML = '<span class="mi" style="font-size:16px;animation:spin 1s linear infinite">hourglass_empty</span> ' + L('McpRemoving');
                                    Bridge.send(isPlugin ? 'removePlugin' : 'removeMcp', { id: item.id });
                                }
                            });
                        });
                    }
                } else {
                    var installBtn = row.querySelector('.btn-install');
                    if (installBtn) {
                        installBtn.addEventListener('click', function () {
                            installBtn.disabled = true;
                            installBtn.innerHTML = '<span class="mi" style="animation:spin 1s linear infinite">hourglass_empty</span> ' + L(isPlugin ? 'PluginInstallingBtn' : 'McpInstallingBtn');
                            if (isPlugin) {
                                Bridge.send('installPlugin', { id: item.id });
                            } else if (item.fields && item.fields.length > 0) {
                                self._showFormModal(item);
                            } else {
                                Bridge.send('installMcp', { id: item.id });
                            }
                        });
                    }
                }
            }

            var target = (rightContainer && index >= splitAt) ? rightContainer : leftContainer;
            target.appendChild(row);
        });
    },

    // ── Status results ──
    _onMcpStatusResult: function (d) {
        this._mcpChecking = false;
        this._mcpInstalledMap = {};
        var self = this;
        if (d.installed) d.installed.forEach(function (n) { self._mcpInstalledMap[n] = true; });
        this._renderList();
    },

    _onPluginStatusResult: function (d) {
        this._pluginChecking = false;
        this._pluginInstalledMap = {};
        var self = this;
        if (d.installed) d.installed.forEach(function (n) { self._pluginInstalledMap[n] = true; });
        this._renderList();
    },

    // ── Install results ──
    _onPluginInstallResult: function (d) {
        var item = this._getItem(d.id);
        var name = item ? this._L(item.nameKey) : d.id;
        if (d.needsLogin) {
            this._toast(this._L('PluginNeedsLogin') || 'Claude CLI Login Required',
                this._L('PluginNeedsLoginBody') || 'A terminal window will open for login. Plugin install will retry automatically.',
                'warning', 10000);
            return;
        }
        if (d.success) {
            this._pluginInstalledMap[d.id] = true;
            var msg = name + ' — ' + this._L('PluginInstallSuccess');
            if (d.needsAuth) msg += ' ' + this._L('PluginAuthHint');
            this._toast(msg, '', 'success', d.needsAuth ? 8000 : 4000);
        } else {
            this._toast(name + ' — ' + this._L('PluginInstallFailed'), d.message || '', 'error');
        }
        this._renderList();
        if (this._installAllNext) this._installAllNext();
    },

    _onMcpInstallResult: function (d) {
        var item = this._getItem(d.id);
        var name = item ? this._L(item.nameKey) : d.id;
        if (d.success) {
            this._mcpInstalledMap[d.id] = true;
            var msg = name + ' — ' + this._L('McpInstallSuccess');
            if (d.needsAuth) msg += ' ' + this._L('McpAuthHint');
            this._toast(msg, '', 'success', d.needsAuth ? 8000 : 4000);
        } else {
            this._toast(name + ' — ' + this._L('McpInstallFailed'), d.message || '', 'error');
        }
        this._renderList();
        if (this._installAllNext) this._installAllNext();
    },

    // ── Remove results ──
    _onPluginRemoveResult: function (d) {
        var item = this._getItem(d.id);
        var name = item ? this._L(item.nameKey) : d.id;
        if (d.success) {
            delete this._pluginInstalledMap[d.id];
            this._toast(name + ' — ' + this._L('PluginRemoved'), '', 'info');
        }
        this._renderList();
        if (this._removeAllNext) this._removeAllNext();
    },

    _onMcpRemoveResult: function (d) {
        var item = this._getItem(d.id);
        var name = item ? this._L(item.nameKey) : d.id;
        if (d.success) {
            delete this._mcpInstalledMap[d.id];
            this._toast(name + ' — ' + this._L('McpRemoved'), '', 'info');
        }
        this._renderList();
        if (this._removeAllNext) this._removeAllNext();
    },

    // ── Test connection ──
    _onMcpTestResult: function (d) {
        var pending = this._mcpPendingSubmit;
        if (!pending || pending.id !== d.id) return;

        if (d.success) {
            this._setMcpFormResult('success', this._L('McpTestSuccess'));
            this._mcpPendingSubmit = null;
            this._setMcpFormBusy(false);
            this._performMcpSubmit(pending);
        } else {
            var item = this._getItem(d.id);
            var name = item ? this._L(item.nameKey) : d.id;
            var retryText = this._L('McpTestRetry');
            this._mcpPendingSubmit = null;
            this._setMcpFormResult('error', this._L('McpTestFailed') + (d.message ? ': ' + d.message : ''));
            this._setMcpFormBusy(false);
            this._toast(
                name + ' — ' + this._L('McpTestFailed'),
                [d.message, retryText].filter(Boolean).join(' '),
                'error',
                7000
            );
        }
    },

    // ── Config (edit) ──
    _onEditClick: function (item) {
        this._editItem = item;
        Bridge.send('getMcpConfig', { id: item.id });
    },

    _onMcpConfigResult: function (d) {
        if (!this._editItem || this._editItem.id !== d.id) return;
        var item = this._editItem;
        this._editItem = null;
        if (!item.fields || item.fields.length === 0) {
            this._toast(this._L('CommonInfo'), this._L(item.nameKey) + ' — OAuth', 'info');
            return;
        }
        this._showFormModal(item, d.values || {}, true);
    },

    _onMcpSaveResult: function (d) {
        var item = this._getItem(d.id);
        var name = item ? this._L(item.nameKey) : d.id;
        if (d.success) {
            this._mcpInstalledMap[d.id] = true;
            this._toast(name + ' — ' + this._L('McpConfigSaved'), '', 'success');
        } else {
            this._toast(name + ' — ' + this._L('McpConfigSaveFailed'), d.message || '', 'error');
        }
        this._renderList();
    },

    // ── Form modal (PostgreSQL) ──
    _showFormModal: function (item, prefillValues, editMode) {
        var self = this;
        var L = this._L;
        prefillValues = prefillValues || {};
        editMode = !!editMode;
        this._mcpFormState = { item: item, editMode: editMode };
        this._mcpPendingSubmit = null;
        this._mcpSubmitBusy = false;

        var overlay = document.getElementById('mcp-modal-overlay');
        document.getElementById('mcp-modal-title').innerHTML =
            '<span class="mcp-modal-title-wrap">' +
                '<img class="mcp-modal-title-icon" src="' + item.icon + '" alt="">' +
                '<span>' + L(item.nameKey) + '</span>' +
            '</span>';

        var html = '<div id="mcp-test-result" class="mcp-test-result"></div>';
        item.fields.forEach(function (f) {
            var val = prefillValues[f.key] !== undefined ? prefillValues[f.key] : (f.default || '');
            var inputType = editMode && f.type === 'password' ? 'text' : f.type;
            html += '<div class="mcp-form-group"><label>' + L(f.labelKey) + '</label>' +
                '<input type="' + inputType + '" id="mcp-field-' + f.key + '" value="' + val.replace(/"/g, '&quot;') + '"' +
                (f.placeholder ? ' placeholder="' + f.placeholder + '"' : '') + '>' +
                (f.hint ? '<span class="mcp-form-hint">' + L(f.hint) + '</span>' : '') + '</div>';
        });
        document.getElementById('mcp-modal-body').innerHTML = html;

        var footerHtml = '';
        footerHtml += '<button class="btn btn-secondary" id="mcp-btn-cancel">' + L('McpCancel') + '</button>';
        footerHtml += '<button class="btn btn-primary" id="mcp-btn-install" disabled><span class="mi btn-icon" style="font-size:16px">' + (editMode ? 'save' : 'download') + '</span> ' + (editMode ? L('McpSaveConfig') : L('McpInstallBtn')) + '</button>';
        document.getElementById('mcp-modal-footer').innerHTML = footerHtml;

        var installBtn = document.getElementById('mcp-btn-install');
        document.getElementById('mcp-btn-cancel').addEventListener('click', function () {
            if (self._mcpSubmitBusy) return;
            self._closeMcpModal();
        });

        self._setMcpFormResult('', '');

        var validate = function () {
            installBtn.disabled = self._mcpSubmitBusy || !self._isMcpFormValid(item);
        };
        item.fields.forEach(function (f) {
            var inp = document.getElementById('mcp-field-' + f.key);
            if (inp) inp.addEventListener('input', function () {
                self._setMcpFormResult('', '');
                validate();
            });
        });
        validate();

        installBtn.addEventListener('click', function () {
            self._submitMcpForm();
        });

        overlay.classList.remove('hidden');
        self._setMcpFormBusy(false);
    },

    // ── Install All / Remove All ──
    _getSelectedIds: function () {
        var ids = [];
        document.querySelectorAll('.mcp-row-cb:checked').forEach(function (cb) {
            ids.push({ id: cb.getAttribute('data-mcp-id'), type: cb.getAttribute('data-mcp-type') });
        });
        return ids;
    },

    _installAll: function () {
        var self = this;
        var L = this._L;
        var btn = document.getElementById('mcp-install-all-btn');
        var selected = this._getSelectedIds();
        var queue = [];

        selected.forEach(function (sel) {
            var item = self._getItem(sel.id);
            if (!item) return;
            var installed = item.type === 'plugin' ? self._pluginInstalledMap[item.id] : self._mcpInstalledMap[item.id];
            if (!installed && !(item.fields && item.fields.length > 0)) {
                queue.push(item);
            }
        });

        if (queue.length === 0) {
            this._toast(L('CommonInfo'), L('McpInstalledBtn') || 'Nothing to install', 'info');
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = L('McpInstallAllRunning') || 'Installing...'; }

        var idx = 0;
        function next() {
            if (idx >= queue.length) {
                self._installAllNext = null;
                if (btn) { btn.disabled = false; btn.textContent = L('McpInstallSelected') || 'Install Selected'; }
                return;
            }
            var item = queue[idx++];
            Bridge.send(item.type === 'plugin' ? 'installPlugin' : 'installMcp', { id: item.id });
        }
        self._installAllNext = next;
        next();
    },

    _removeAll: function () {
        var self = this;
        var L = this._L;
        var selected = this._getSelectedIds();

        var toRemove = [];
        selected.forEach(function (sel) {
            var item = self._getItem(sel.id);
            if (!item) return;
            var isInstalled = item.type === 'plugin' ? self._pluginInstalledMap[item.id] : self._mcpInstalledMap[item.id];
            if (isInstalled) toRemove.push(item);
        });

        if (toRemove.length === 0) {
            this._toast(L('CommonInfo'), 'Nothing selected to remove', 'info');
            return;
        }

        var listHtml = toRemove.map(function (i) {
            return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><img src="' + i.icon + '" style="width:20px;height:20px;border-radius:4px" alt=""><span>' + L(i.nameKey) + '</span></div>';
        }).join('');
        this._confirm(L('McpRemove'), listHtml + '<p style="margin-top:12px">' + (L('McpRemoveSelected') || 'Remove selected integrations?') + '</p>', function (yes) {
            if (!yes) return;
            var btn = document.getElementById('mcp-remove-all-btn');
            if (btn) { btn.disabled = true; }

            var idx = 0;
            function next() {
                if (idx >= toRemove.length) {
                    self._removeAllNext = null;
                    if (btn) { btn.disabled = false; }
                    return;
                }
                var item = toRemove[idx++];
                Bridge.send(item.type === 'plugin' ? 'removePlugin' : 'removeMcp', { id: item.id });
            }
            self._removeAllNext = next;
            next();
        });
    }
};
