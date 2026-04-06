// Dev Tools Page — runs inside SubWindow
window.DevToolsPage = {

    _tools: [
        { id: 'node', icon: 'assets/devtools/nodejs.png', labelKey: 'PrereqNodeJs', invertDark: false, group: 'cli', groupEnd: false },
        { id: 'git', icon: 'assets/devtools/git.svg', labelKey: 'PrereqGit', invertDark: false, group: 'cli', groupEnd: false },
        { id: 'githubCli', icon: 'assets/devtools/github.svg', labelKey: 'PrereqGithubCli', invertDark: true, group: 'cli', groupEnd: false },
        { id: 'claude', icon: 'assets/devtools/claude.svg', labelKey: 'PrereqClaudeCli', invertDark: false, group: 'cli', groupEnd: false },
        { id: 'codexCli', icon: 'assets/devtools/openai-symbol.svg', labelKey: 'PrereqCodexCli', invertDark: true, group: 'cli', groupEnd: true },
        { id: 'vscode', icon: 'assets/devtools/vscode.png', labelKey: 'PrereqVsCode', invertDark: false, group: 'editor', groupEnd: false },
        { id: 'vscodeClaude', icon: 'assets/devtools/claude.svg', labelKey: 'PrereqClaudeCodeExtension', invertDark: false, group: 'editor', parent: 'vscode', groupEnd: false },
        { id: 'vscodeCodex', icon: 'assets/devtools/openai-symbol.svg', labelKey: 'PrereqCodexExtension', invertDark: true, group: 'editor', parent: 'vscode', groupEnd: true },
        { id: 'claudeDesktop', icon: 'assets/devtools/claude.svg', labelKey: 'PrereqClaudeDesktop', invertDark: false, group: 'app', groupEnd: false },
        { id: 'codexApp', icon: 'assets/devtools/openai-symbol.svg', labelKey: 'PrereqCodexApp', invertDark: true, group: 'app', groupEnd: true }
    ],

    _isCheckingPrereqs: false,
    _hasCheckedPrereqs: false,
    _isInstalling: false,
    _isUninstalling: false,
    _pendingQueue: [],
    _statusAnimationTimers: {},
    _nvmDetected: false,

    render: function () {
        var L = Bridge.lang.bind(Bridge);
        var self = this;

        var toolRowsHtml = '';
        var prevGroup = '';
        for (var i = 0; i < this._tools.length; i++) {
            var t = this._tools[i];
            // Insert divider between groups
            if (prevGroup && prevGroup !== t.group && !t.parent) {
                toolRowsHtml += '<div class="prereq-divider"></div>';
            }
            var rowClasses = 'prereq-row';
            if (t.parent) rowClasses += ' prereq-child';
            if (t.groupEnd) rowClasses += ' prereq-group-end';
            var invertClass = t.invertDark ? ' prereq-app-icon-invert-dark' : '';

            toolRowsHtml +=
                '<div class="' + rowClasses + '" data-id="' + t.id + '"' + (t.parent ? ' data-parent="' + t.parent + '"' : '') + '>' +
                    '<input type="checkbox" class="prereq-cb" id="dt-cb-' + t.id + '">' +
                    '<span class="prereq-app-icon" aria-hidden="true"><img src="' + t.icon + '" class="prereq-app-icon-img' + invertClass + '" alt=""></span>' +
                    '<span class="prereq-label">' + (L(t.labelKey) || t.id) + '</span>' +
                    '<span class="prereq-value prereq-pending" id="dt-status-' + t.id + '" data-state="not_checked"></span>' +
                    '<button type="button" class="prereq-action-btn" id="dt-action-' + t.id + '"><span class="mi"></span></button>' +
                '</div>';
            if (!t.parent) prevGroup = t.group;
        }

        return '' +
        '<div class="subpage-layout devtools-page-layout">' +
            '<div class="devtools-page-header">' +
                '<span class="mi" style="font-size:20px;color:var(--accent-blue)">build</span>' +
                '<span style="font-size:14px;font-weight:600">' + (L('PrereqTitle') || 'Dev Tools') + '</span>' +
                '<span style="flex:1"></span>' +
                '<label class="skills-master-toggle" id="dt-select-all" style="cursor:pointer">' +
                    '<span class="skills-row-check">' +
                        '<input id="dt-master-toggle" type="checkbox">' +
                        '<span class="skills-row-check-mark"></span>' +
                    '</span>' +
                    '<span id="dt-master-label" class="skills-master-toggle-label">' + (L('PrereqSelectAll') || 'Select All') + '</span>' +
                '</label>' +
            '</div>' +
            '<div class="devtools-page-scroll">' +
                '<div class="card prereq-card">' +
                    '<div class="prereq-table-header">' +
                        '<span class="prereq-th-check"></span>' +
                        '<span class="prereq-th-icon"></span>' +
                        '<span class="prereq-th-name">Tool / Program</span>' +
                        '<span class="prereq-th-version">Version</span>' +
                        '<span class="prereq-th-action">Actions</span>' +
                    '</div>' +
                    '<div class="card-body">' +
                        toolRowsHtml +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;padding:8px 0 0">' +
                    '<div class="split-btn-group" id="dt-split-group">' +
                        '<button id="dt-btn-install" class="btn btn-primary split-btn-main">' +
                            '<span class="mi btn-icon">search</span> ' + (L('PrereqCheckTools') || 'Check Tools') +
                        '</button>' +
                        '<button id="dt-btn-split-toggle" class="btn btn-primary split-btn-toggle" disabled>' +
                            '<span class="mi">arrow_drop_down</span>' +
                        '</button>' +
                        '<div id="dt-split-menu" class="split-btn-menu">' +
                            '<button id="dt-btn-remove" class="split-btn-menu-item">' +
                                '<span class="mi">delete_outline</span> ' +
                                '<span>' + (L('PrereqRemoveSelected') || 'Remove Selected') + '</span>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="bp-page-actions subpage-footer" style="justify-content:flex-end">' +
                '<button class="btn btn-secondary" id="dt-close-btn">' +
                    '<span class="mi btn-icon">close</span> ' + (L('BtnClose') || 'Close') +
                '</button>' +
            '</div>' +
        '</div>' +
        '<div id="dt-confirm-overlay" class="modal-overlay hidden">' +
            '<div class="modal-dialog">' +
                '<div class="modal-header">' +
                    '<span class="modal-title" id="dt-confirm-title"></span>' +
                    '<img id="dt-confirm-icon" class="hidden" style="width:28px;height:28px;border-radius:6px;margin-left:auto" alt="">' +
                '</div>' +
                '<div class="modal-body" id="dt-confirm-body"></div>' +
                '<div class="modal-footer">' +
                    '<button id="dt-confirm-no" class="btn btn-secondary">' + (L('ConfirmNo') || 'No') + '</button>' +
                    '<button id="dt-confirm-yes" class="btn btn-primary">' + (L('ConfirmYes') || 'Yes') + '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    afterRender: function () {
        var self = this;

        // Close button
        var closeBtn = document.getElementById('dt-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', function () { Bridge.send('closeWindow'); });

        // Select All / Select None toggle
        var masterToggle = document.getElementById('dt-master-toggle');
        var masterLabel = document.getElementById('dt-master-label');
        if (masterToggle) {
            masterToggle.addEventListener('change', function () {
                var checked = masterToggle.checked;
                document.querySelectorAll('.prereq-row:not([style*="display: none"]) .prereq-cb:not(:disabled)').forEach(function (cb) {
                    cb.checked = checked;
                });
                self._updateEditorSelection();
                if (checked) {
                    document.querySelectorAll('.prereq-row:not([style*="display: none"]) .prereq-cb:not(:disabled)').forEach(function (cb) {
                        cb.checked = true;
                    });
                }
                if (masterLabel) masterLabel.textContent = checked
                    ? (Bridge.lang('SkillsSelectNone') || 'Select None')
                    : (Bridge.lang('PrereqSelectAll') || 'Select All');
                self._updateActionButtons();
            });
        }

        // Checkbox change handlers
        document.querySelectorAll('.prereq-row .prereq-cb').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var row = cb.closest('.prereq-row');
                var changedId = row ? row.getAttribute('data-id') : null;
                self._updateEditorSelection(changedId);
            });
        });

        // Install Selected button
        document.getElementById('dt-btn-install').addEventListener('click', function () {
            if (!self._hasCheckedPrereqs) {
                // Not checked yet - do first check
                self._checkAll();
                return;
            }
            if (self._isCheckingPrereqs) return;
            var items = self._getSelectedInstallItems();
            if (items.length === 0) return;
            var listHtml = self._buildInstallConfirmList();
            var body = (self._L('PrereqConfirmInstallBody') || 'The following tools will be installed:') + '<br><br>' + listHtml;
            self._confirm(self._L('PrereqConfirmInstallTitle') || 'Install Tools', body, function (ok) {
                if (ok) {
                    if (self._isInstalling || self._isUninstalling) {
                        items.forEach(function (id) {
                            self._pendingQueue.push({ id: id, action: 'install' });
                            self._setPrereqStatus(id, 'queued', self._L('InstallStatusQueued'));
                        });
                    } else {
                        self._installSelected();
                    }
                }
            });
        });

        // Split dropdown toggle
        var splitGroup = document.getElementById('dt-split-group');
        var splitToggle = document.getElementById('dt-btn-split-toggle');
        if (splitToggle && splitGroup) {
            splitToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                splitGroup.classList.toggle('show');
            });
            document.addEventListener('click', function (e) {
                if (!splitGroup.contains(e.target)) {
                    splitGroup.classList.remove('show');
                }
            });
        }

        // Remove Selected
        document.getElementById('dt-btn-remove').addEventListener('click', function () {
            splitGroup.classList.remove('show');
            if (self._isCheckingPrereqs) return;
            var removeItems = self._getSelectedRemoveItems();
            if (removeItems.length === 0) return;
            var listHtml = self._buildRemoveConfirmList(removeItems);
            var body = (self._L('PrereqConfirmRemoveSelectedBody') || 'The following tools will be removed: {0}').replace('{0}', listHtml);
            self._confirm(self._L('PrereqConfirmRemoveSelectedTitle') || 'Remove Tools', body, function (ok) {
                if (ok) {
                    if (self._isInstalling || self._isUninstalling) {
                        removeItems.forEach(function (id) {
                            self._pendingQueue.push({ id: id, action: 'uninstall' });
                            self._setPrereqStatus(id, 'queued', self._L('InstallStatusQueued'));
                        });
                    } else {
                        self._uninstallSelected(removeItems);
                    }
                }
            });
        });

        // Per-tool action buttons
        var self2 = this;
        this._tools.forEach(function (tool) {
            var actionBtn = document.getElementById('dt-action-' + tool.id);
            if (!actionBtn) return;
            actionBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                self2._onToolAction(tool.id);
            });
        });

        // Confirm dialog buttons
        this._confirmCb = null;
        document.getElementById('dt-confirm-yes').addEventListener('click', function () {
            document.getElementById('dt-confirm-overlay').classList.add('hidden');
            if (self._confirmCb) { self._confirmCb(true); self._confirmCb = null; }
        });
        document.getElementById('dt-confirm-no').addEventListener('click', function () {
            document.getElementById('dt-confirm-overlay').classList.add('hidden');
            if (self._confirmCb) { self._confirmCb(false); self._confirmCb = null; }
        });

        // ── Bridge events ──
        Bridge.on('checkResult', function (d) {
            if (d.id === 'nvm') {
                self._nvmDetected = !!d.found;
                return;
            }
            if (d.found === 'unavailable') {
                var row = document.querySelector('.prereq-row[data-id="' + d.id + '"]');
                if (row) row.style.display = 'none';
                return;
            }
            self._setPrereqStatus(d.id, d.found, d.found ? d.version : self._L('PrereqNotFound'));
            self._log(d.id + ': ' + (d.found ? d.version : self._L('PrereqNotFound')));
        });

        Bridge.on('checkAllDone', function (d) {
            self._finishCheckAll(d && d.error ? d.error : '');
        });

        Bridge.on('installProgress', function (d) {
            if (d.status === 'queued') {
                self._setPrereqStatus(d.id, 'queued', self._L('InstallStatusQueued'));
                if (d.message) self._log(d.id + ': ' + d.message);
            } else if (d.status === 'installing') {
                self._setPrereqStatus(d.id, 'installing', self._formatProgressText(1));
                self._startInstallAnimation(d.id);
                if (d.message) self._log(d.id + ': ' + d.message);
            } else if (d.status === 'done') {
                self._stopInstallAnimation(d.id);
                self._setPrereqStatus(d.id, 'installed', self._L('InstallStatusInstalled'));
                if (d.message) self._log(d.id + ': ' + d.message);
            } else {
                self._stopInstallAnimation(d.id);
                self._setPrereqStatus(d.id, false, self._L('PrereqFailed'));
                self._log(d.id + ': ' + self._L('PrereqFailed') + ' - ' + d.message);
            }
        });

        Bridge.on('installAllResult', function (d) {
            if (d && d.noInternet) {
                self._toast(
                    self._L('NoInternetTitle') || 'No Internet Connection',
                    self._L('NoInternetBody') || 'Please check your internet connection and try again.',
                    'error', 6000
                );
                self._onInstallComplete(0, 0);
                return;
            }
            var results = (d && d.results) ? d.results : [];
            var ok = results.filter(function (r) { return r.success; }).length;
            var fail = results.length - ok;
            self._onInstallComplete(ok, fail);
        });

        Bridge.on('uninstallProgress', function (d) {
            if (d.status === 'removing') {
                self._setPrereqStatus(d.id, 'installing', self._L('PrereqRemoving'));
                self._startInstallAnimation(d.id, true);
            } else if (d.status === 'done') {
                self._stopInstallAnimation(d.id);
                self._setPrereqStatus(d.id, false, self._L('PrereqNotFound'));
            } else {
                self._stopInstallAnimation(d.id);
                self._setPrereqStatus(d.id, false, self._L('PrereqFailed'));
                if (d.message) self._log(d.id + ': ' + self._L('PrereqFailed') + ' - ' + d.message);
            }
        });

        Bridge.on('uninstallAllResult', function (d) {
            var results = (d && d.results) ? d.results : [];
            var ok = results.filter(function (r) { return r.success; }).length;
            var fail = results.length - ok;
            self._onUninstallComplete(ok, fail);
        });

        Bridge.on('uacNotice', function (d) {
            var isRemove = d && d.action === 'remove';
            var title = self._L('UacNoticeTitle') || 'Admin Permission Required';
            var body = isRemove
                ? (self._L('UacNoticeRemoveBody') || 'Windows will ask for admin permission to remove the selected tools. Please approve the prompt.')
                : (self._L('UacNoticeInstallBody') || 'Windows will ask for admin permission to install the selected tools. Please approve the prompt.');
            self._toast(title, body, 'info', 8000);
        });

        Bridge.on('log', function (d) { self._log(d.message); });
        Bridge.on('error', function (d) {
            self._log((self._L('LogErrorPrefix') || 'Error') + ': ' + d.message);
            self._toast(self._L('CommonError') || 'Error', d.message, 'error');
        });

        // Auto-trigger check on page load
        setTimeout(function () {
            self._checkAll();
        }, 300);
    },

    // ── Confirm dialog ──
    _confirm: function (title, html, cb, iconSrc) {
        this._confirmCb = cb;
        document.getElementById('dt-confirm-title').textContent = title;
        document.getElementById('dt-confirm-body').innerHTML = html;
        var iconEl = document.getElementById('dt-confirm-icon');
        if (iconEl) {
            if (iconSrc) {
                iconEl.src = iconSrc;
                iconEl.classList.remove('hidden');
            } else {
                iconEl.src = '';
                iconEl.classList.add('hidden');
            }
        }
        document.getElementById('dt-confirm-overlay').classList.remove('hidden');
    },

    // ── Toast ──
    _toast: function (title, message, type, duration) {
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

    // ── Helpers ──
    _L: function (key) { return Bridge.lang(key); },

    _escapeHtml: function (value) {
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return map[c]; });
    },

    _getTool: function (id) {
        for (var i = 0; i < this._tools.length; i++) {
            if (this._tools[i].id === id) return this._tools[i];
        }
        return null;
    },

    // ── Terminal / Log ──
    // Terminal is in the main window — logs are forwarded via wrapSenderWithMainLog
    _openTerminal: function () {},
    _closeTerminal: function () {},
    _log: function () {},

    // ── Check All ──
    _checkAll: function () {
        this._openTerminal(true);
        this._isCheckingPrereqs = true;
        this._hasCheckedPrereqs = false;
        this._updateActionButtons();

        // Reset all statuses
        document.querySelectorAll('.prereq-row[data-id]').forEach(function (row) {
            if (row.style.display === 'none') return;
            var id = row.getAttribute('data-id');
            var status = document.getElementById('dt-status-' + id);
            if (status) {
                status.textContent = Bridge.lang('PrereqChecking') || 'Checking...';
                status.className = 'prereq-value';
                status.setAttribute('data-state', 'checking');
            }
        });
        this._log(this._L('LogCheckingPrereqs') || 'Checking prerequisites...');
        Bridge.send('checkAll');
    },

    _finishCheckAll: function (errorMessage) {
        this._isCheckingPrereqs = false;
        this._hasCheckedPrereqs = !errorMessage;

        if (this._hasCheckedPrereqs) {
            this._syncPrereqCheckboxes();
            this._updateEditorSelection();
            this._log(this._L('PrereqCheckComplete') || 'Check complete.');
        } else if (errorMessage) {
            this._log((this._L('LogErrorPrefix') || 'Error') + ': ' + errorMessage);
        }

        // Hide dividers that precede only hidden rows
        document.querySelectorAll('.prereq-divider').forEach(function (div) {
            var next = div.nextElementSibling;
            var anyVisible = false;
            while (next && !next.classList.contains('prereq-divider')) {
                if (next.style.display !== 'none') anyVisible = true;
                next = next.nextElementSibling;
            }
            div.style.display = anyVisible ? '' : 'none';
        });

        this._updateActionButtons();
        this._processPendingQueue();
    },

    // ── Status management ──
    _setPrereqStatus: function (id, found, text) {
        var status = document.getElementById('dt-status-' + id);
        this._applyStatusToElement(status, found, text);
    },

    _applyStatusToElement: function (status, found, text) {
        var state = '';
        if (!status) return;

        if (found === 'queued') {
            state = 'queued';
            text = text || this._L('InstallStatusQueued');
        } else if (found === 'installing' || found === null) {
            state = 'installing';
            text = text || this._L('InstallStatusInstalling');
        } else if (found === 'installed') {
            state = 'installed';
            text = text || this._L('InstallStatusInstalled');
        } else if (found === false) {
            state = text === this._L('PrereqFailed') ? 'failed' : 'not_found';
            if (!text || text === '\u2014') text = this._L('PrereqNotFound');
        } else if (found === true) {
            if (!text || text === this._L('MessageInstalledLabel') || text === this._L('PrereqInstalled')) {
                text = this._L('PrereqInstalled');
                state = 'installed';
            } else {
                state = 'custom';
            }
        }

        status.textContent = text;
        if (state) status.setAttribute('data-state', state);
        if (found === true || found === 'installed') status.className = 'prereq-value prereq-ok-text';
        else if (found === false) status.className = 'prereq-value prereq-fail-text';
        else status.className = 'prereq-value';
    },

    _getPrereqState: function (id) {
        var status = document.getElementById('dt-status-' + id);
        return status ? (status.getAttribute('data-state') || 'not_checked') : 'not_checked';
    },

    // ── Animation ──
    _formatProgressText: function (dotCount, removing) {
        var dots = '';
        for (var i = 0; i < dotCount; i++) dots += '.';
        return (removing ? this._L('PrereqRemoving') : this._L('InstallStatusInstalling')) + dots;
    },

    _startInstallAnimation: function (id, removing) {
        var self = this;
        self._stopInstallAnimation(id);
        var frame = 1;
        self._setPrereqStatus(id, 'installing', self._formatProgressText(frame, removing));
        self._statusAnimationTimers[id] = setInterval(function () {
            frame = frame >= 3 ? 1 : frame + 1;
            self._setPrereqStatus(id, 'installing', self._formatProgressText(frame, removing));
        }, 450);
    },

    _stopInstallAnimation: function (id) {
        var timer = this._statusAnimationTimers[id];
        if (timer) {
            clearInterval(timer);
            delete this._statusAnimationTimers[id];
        }
    },

    // ── Editor selection logic ──
    _updateEditorSelection: function (changedId) {
        var self = this;
        var editors = [
            { id: 'vscode', cbId: 'dt-cb-vscode', children: ['vscodeClaude', 'vscodeCodex'] }
        ];

        editors.forEach(function (editor) {
            var editorCb = document.getElementById(editor.cbId);
            if (!editorCb) return;
            var editorInstalled = self._getPrereqState(editor.id) === 'installed' || self._getPrereqState(editor.id) === 'custom';

            // If an extension was just checked, auto-check its parent IDE (if not installed)
            if (changedId && editor.children.indexOf(changedId) >= 0) {
                var childCb = document.getElementById('dt-cb-' + changedId);
                if (childCb && childCb.checked && !editorInstalled && !editorCb.checked) {
                    editorCb.checked = true;
                }
            }

            // If IDE was just unchecked, uncheck all its extensions
            if (changedId === editor.id && !editorCb.checked) {
                editor.children.forEach(function (childId) {
                    var childCb = document.getElementById('dt-cb-' + childId);
                    if (childCb) childCb.checked = false;
                });
            }

            // Enable/disable extension checkboxes based on IDE availability
            var editorAvailable = editorInstalled || editorCb.checked;
            editor.children.forEach(function (childId) {
                var childCb = document.getElementById('dt-cb-' + childId);
                if (!childCb) return;
                childCb.disabled = !editorAvailable;
                if (!editorAvailable) {
                    childCb.checked = false;
                }
            });
        });
    },

    // ── Checkbox sync ──
    _syncPrereqCheckboxes: function () {
        var self = this;
        document.querySelectorAll('.prereq-row[data-id]').forEach(function (row) {
            var id = row.getAttribute('data-id');
            var cb = document.getElementById('dt-cb-' + id);
            var actionBtn = document.getElementById('dt-action-' + id);
            if (!cb) return;
            var state = self._getPrereqState(id);
            var isInstalled = (state === 'installed' || state === 'custom');

            // Update action button
            if (actionBtn) {
                var icon = actionBtn.querySelector('.mi');
                if (isInstalled) {
                    actionBtn.classList.remove('action-install');
                    actionBtn.classList.add('action-remove', 'visible');
                    actionBtn.title = self._L('PrereqRemoveTooltip') || 'Remove';
                    if (icon) icon.textContent = 'delete_outline';
                } else if (state === 'not_found' || state === 'failed') {
                    actionBtn.classList.remove('action-remove');
                    actionBtn.classList.add('action-install', 'visible');
                    actionBtn.title = self._L('PrereqInstallSelected') || 'Install';
                    if (icon) icon.textContent = 'download';
                } else {
                    actionBtn.classList.remove('visible', 'action-install', 'action-remove');
                }
            }

            if (isInstalled) {
                cb.checked = false;
                cb.disabled = false;
            } else {
                cb.checked = true;
                cb.disabled = false;
            }
        });
        this._updateEditorSelection();
    },

    // ── Per-tool action button handler ──
    _onToolAction: function (id) {
        var self = this;
        var isBusy = self._isInstalling || self._isUninstalling;
        var row = document.querySelector('.prereq-row[data-id="' + id + '"]');
        if (!row) return;
        var label = row.querySelector('.prereq-label');
        var name = label ? label.textContent : id;
        var iconImg = row.querySelector('.prereq-app-icon-img');
        var headerIconSrc = iconImg ? iconImg.getAttribute('src') : null;
        var state = self._getPrereqState(id);
        var isInstalled = (state === 'installed' || state === 'custom');

        if (isInstalled) {
            // Uninstall
            if (id === 'node' && self._nvmDetected) {
                var body = (self._L('PrereqConfirmRemoveBody') || 'Are you sure you want to remove {0}?').replace('{0}', '<b>' + self._escapeHtml(name) + '</b>') +
                    '<label class="confirm-checkbox-row"><input type="checkbox" id="dt-confirm-nvm-cb">' +
                    '<span>' + (self._L('NodeAlsoRemoveNvm') || 'Also remove NVM') + '</span></label>';
                self._confirm(self._L('PrereqConfirmRemoveTitle') || 'Remove Tool', body, function (ok) {
                    if (ok) {
                        var nvmCb = document.getElementById('dt-confirm-nvm-cb');
                        var removeNvm = nvmCb ? nvmCb.checked : false;
                        if (isBusy) {
                            self._pendingQueue.push({ id: id, action: 'uninstall', options: { node: { removeNvm: removeNvm } } });
                            self._setPrereqStatus(id, 'queued', self._L('InstallStatusQueued'));
                        } else {
                            self._uninstallSelected([id], { node: { removeNvm: removeNvm } });
                        }
                    }
                }, headerIconSrc);
            } else {
                var body2 = (self._L('PrereqConfirmRemoveBody') || 'Are you sure you want to remove {0}?').replace('{0}', '<b>' + self._escapeHtml(name) + '</b>');
                self._confirm(self._L('PrereqConfirmRemoveTitle') || 'Remove Tool', body2, function (ok) {
                    if (ok) {
                        if (isBusy) {
                            self._pendingQueue.push({ id: id, action: 'uninstall' });
                            self._setPrereqStatus(id, 'queued', self._L('InstallStatusQueued'));
                        } else {
                            self._uninstallSelected([id]);
                        }
                    }
                }, headerIconSrc);
            }
        } else {
            // Install
            if (id === 'node') {
                var body3 = (self._L('PrereqConfirmInstallSingleBody') || 'Install {0}?').replace('{0}', '<b>' + self._escapeHtml(name) + '</b>') +
                    '<label class="confirm-checkbox-row"><input type="checkbox" id="dt-confirm-nvm-cb" checked>' +
                    '<span>' + (self._L('NodeInstallWithNvm') || 'Install with NVM') + '</span></label>';
                self._confirm(self._L('PrereqConfirmInstallTitle') || 'Install Tool', body3, function (ok) {
                    if (ok) {
                        var nvmCb = document.getElementById('dt-confirm-nvm-cb');
                        var useNvm = nvmCb ? nvmCb.checked : true;
                        if (isBusy) {
                            self._pendingQueue.push({ id: id, action: 'install', options: { node: { useNvm: useNvm } } });
                            self._setPrereqStatus(id, 'queued', self._L('InstallStatusQueued'));
                        } else {
                            self._openTerminal(true);
                            self._isInstalling = true;
                            self._updateActionButtons();
                            self._log((self._L('LogInstallingPrefix') || 'Installing') + ' 1: ' + id);
                            Bridge.send('installSelected', { items: [id], silent: true, options: { node: { useNvm: useNvm } } });
                        }
                    }
                }, headerIconSrc);
            } else {
                var body4 = (self._L('PrereqConfirmInstallSingleBody') || 'Install {0}?').replace('{0}', '<b>' + self._escapeHtml(name) + '</b>');
                self._confirm(self._L('PrereqConfirmInstallTitle') || 'Install Tool', body4, function (ok) {
                    if (ok) {
                        if (isBusy) {
                            self._pendingQueue.push({ id: id, action: 'install' });
                            self._setPrereqStatus(id, 'queued', self._L('InstallStatusQueued'));
                        } else {
                            self._openTerminal(true);
                            self._isInstalling = true;
                            self._updateActionButtons();
                            self._log((self._L('LogInstallingPrefix') || 'Installing') + ' 1: ' + id);
                            Bridge.send('installSelected', { items: [id], silent: true });
                        }
                    }
                }, headerIconSrc);
            }
        }
    },

    // ── Action button state management ──
    _updateActionButtons: function () {
        var btn = document.getElementById('dt-btn-install');
        var splitToggle = document.getElementById('dt-btn-split-toggle');
        if (!btn) return;

        if (this._isCheckingPrereqs) {
            btn.disabled = true;
            btn.innerHTML = '<span class="mi btn-icon spin">sync</span> ' + (this._L('PrereqChecking') || 'Checking...');
            if (splitToggle) splitToggle.disabled = true;
            return;
        }

        if (this._isInstalling) {
            btn.disabled = true;
            btn.innerHTML = '<span class="mi btn-icon spin">sync</span> ' + (this._L('PrereqInstalling') || 'Installing...');
            if (splitToggle) splitToggle.disabled = true;
            return;
        }

        btn.disabled = !this._hasCheckedPrereqs;
        if (splitToggle) splitToggle.disabled = !this._hasCheckedPrereqs;

        if (this._hasCheckedPrereqs) {
            btn.innerHTML = '<span class="mi btn-icon">download</span> ' + (this._L('PrereqInstallSelected') || 'Install Selected');
        } else {
            btn.innerHTML = '<span class="mi btn-icon">search</span> ' + (this._L('PrereqCheckTools') || 'Check Tools');
        }
    },

    // ── Install / Uninstall ──
    _getSelectedInstallItems: function () {
        var items = [];
        var self = this;
        document.querySelectorAll('.prereq-row[data-id]').forEach(function (row) {
            var id = row.getAttribute('data-id');
            var cb = document.getElementById('dt-cb-' + id);
            var state = self._getPrereqState(id);
            var parentId = row.getAttribute('data-parent');
            var parentState = parentId ? self._getPrereqState(parentId) : '';
            var parentCb = parentId ? document.getElementById('dt-cb-' + parentId) : null;
            var parentSelected = !!(parentCb && parentCb.checked);
            var parentAvailable = !parentId || parentState === 'installed' || parentState === 'custom' || parentSelected;
            var installable = (state === 'not_found' || state === 'failed') && parentAvailable;
            if (cb && cb.checked && installable) {
                items.push(id);
            }
        });
        return items;
    },

    _getSelectedRemoveItems: function () {
        var items = [];
        document.querySelectorAll('.prereq-row[data-id]').forEach(function (row) {
            var id = row.getAttribute('data-id');
            var cb = document.getElementById('dt-cb-' + id);
            if (cb && cb.checked) {
                items.push(id);
            }
        });
        return items;
    },

    _installSelected: function () {
        var items = this._getSelectedInstallItems();
        if (items.length === 0) return;

        this._openTerminal(true);
        this._isInstalling = true;
        this._updateActionButtons();
        this._log((this._L('LogInstallingPrefix') || 'Installing') + ' ' + items.length + ': ' + items.join(', '));
        Bridge.send('installSelected', { items: items, silent: true });
    },

    _uninstallSelected: function (items, options) {
        if (!items || items.length === 0) return;

        this._openTerminal(true);
        this._isUninstalling = true;
        this._updateActionButtons();
        this._log((this._L('PrereqRemoving') || 'Removing') + ' ' + items.length + ': ' + items.join(', '));
        var payload = { items: items };
        if (options) payload.options = options;
        Bridge.send('uninstallSelected', payload);
    },

    _onInstallComplete: function (okCount, failCount) {
        this._isInstalling = false;
        this._syncPrereqCheckboxes();
        var totalCount = okCount + failCount;
        var summary = okCount + '/' + totalCount + ' ' + (this._L('CommonSucceeded') || 'succeeded');
        this._log((this._L('PrereqInstallSelected') || 'Install Selected') + ': ' + summary);
        this._updateActionButtons();
        this._processPendingQueue();
    },

    _onUninstallComplete: function (okCount, failCount) {
        this._isUninstalling = false;
        var totalCount = okCount + failCount;
        var summary = okCount + '/' + totalCount + ' ' + (this._L('CommonSucceeded') || 'succeeded');
        this._log((this._L('PrereqRemoveSelected') || 'Remove Selected') + ': ' + summary);
        // Re-check all tools to refresh status
        this._checkAll();
        this._processPendingQueue();
    },

    // ── Pending queue ──
    _processPendingQueue: function () {
        if (this._pendingQueue.length === 0) return;
        if (this._isInstalling || this._isUninstalling || this._isCheckingPrereqs) return;

        var queue = this._pendingQueue.slice();
        this._pendingQueue = [];

        var installItems = [];
        var uninstallItems = [];
        var installOptions = {};
        var uninstallOptions = {};

        for (var i = 0; i < queue.length; i++) {
            var entry = queue[i];
            if (entry.action === 'install') {
                installItems.push(entry.id);
                if (entry.options) {
                    var keys = Object.keys(entry.options);
                    for (var k = 0; k < keys.length; k++) {
                        installOptions[keys[k]] = entry.options[keys[k]];
                    }
                }
            } else if (entry.action === 'uninstall') {
                uninstallItems.push(entry.id);
                if (entry.options) {
                    var ukeys = Object.keys(entry.options);
                    for (var j = 0; j < ukeys.length; j++) {
                        uninstallOptions[ukeys[j]] = entry.options[ukeys[j]];
                    }
                }
            }
        }

        // Process installs first, then uninstalls will be queued again via _onInstallComplete
        if (installItems.length > 0) {
            for (var u = 0; u < uninstallItems.length; u++) {
                var opts = {};
                var uid = uninstallItems[u];
                if (uninstallOptions[uid]) opts = uninstallOptions[uid];
                this._pendingQueue.push({ id: uid, action: 'uninstall', options: Object.keys(opts).length > 0 ? opts : undefined });
            }
            this._openTerminal(true);
            this._isInstalling = true;
            this._updateActionButtons();
            this._log((this._L('LogInstallingPrefix') || 'Installing') + ' ' + installItems.length + ': ' + installItems.join(', '));
            var payload = { items: installItems, silent: true };
            if (Object.keys(installOptions).length > 0) payload.options = installOptions;
            Bridge.send('installSelected', payload);
        } else if (uninstallItems.length > 0) {
            var uOpts = Object.keys(uninstallOptions).length > 0 ? uninstallOptions : undefined;
            this._uninstallSelected(uninstallItems, uOpts);
        }
    },

    // ── Confirm list builders ──
    _buildInstallConfirmList: function () {
        var self = this;
        var html = '<div class="install-list">';
        document.querySelectorAll('.prereq-row[data-id]').forEach(function (row) {
            var id = row.getAttribute('data-id');
            var cb = document.getElementById('dt-cb-' + id);
            if (!cb || !cb.checked) return;
            var label = row.querySelector('.prereq-label');
            var name = label ? label.textContent : id;
            var state = self._getPrereqState(id);
            var isInstalled = (state === 'installed' || state === 'custom');
            if (isInstalled) {
                html += '<div style="color:var(--text-faint);"><b>' + self._escapeHtml(name) + '</b> — ' + (self._L('PrereqAlreadyInstalled') || 'Already installed') + '</div>';
            } else {
                html += '<div><b>' + self._escapeHtml(name) + '</b></div>';
            }
        });
        html += '</div>';
        return html;
    },

    _buildRemoveConfirmList: function (removeItems) {
        var self = this;
        var html = '';
        document.querySelectorAll('.prereq-row[data-id]').forEach(function (row) {
            var id = row.getAttribute('data-id');
            var cb = document.getElementById('dt-cb-' + id);
            if (!cb || !cb.checked) return;
            var label = row.querySelector('.prereq-label');
            var name = label ? label.textContent : id;
            var state = self._getPrereqState(id);
            var isInstalled = (state === 'installed' || state === 'custom');
            if (isInstalled) {
                html += '<div><b>' + self._escapeHtml(name) + '</b></div>';
            } else {
                html += '<div style="color:var(--text-faint);"><b>' + self._escapeHtml(name) + '</b> — ' + (self._L('PrereqNotInstalledOrRemoved') || 'Not installed') + '</div>';
            }
        });
        return html;
    }
};
