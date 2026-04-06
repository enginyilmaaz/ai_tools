// Global error handler — catch uncaught errors and show in console
window.onerror = function (msg, src, line, col, err) {
    console.error('[APP ERROR]', msg, 'at', src + ':' + line + ':' + col, err);
};
window.onunhandledrejection = function (e) {
    console.error('[APP PROMISE REJECTION]', e.reason);
};

// Toast
var Toast = {
    show: function (title, message, type, duration) {
        type = type || 'info'; duration = duration || 4000;
        var c = document.getElementById('toast-container');
        var t = document.createElement('div');
        t.className = 'toast toast-' + type;
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
        t.querySelector('.toast-close').addEventListener('click', function (e) { e.stopPropagation(); dismiss(); });
        c.appendChild(t);
        requestAnimationFrame(function () { t.classList.add('toast-visible'); });
        setTimeout(function () {
            if (t.parentNode) {
                t.classList.remove('toast-visible'); t.classList.add('toast-hiding');
                setTimeout(function () { t.remove(); }, 300);
            }
        }, duration);
    }
};

// Confirm dialog
var Confirm = {
    _cb: null,
    show: function (title, html, cb, iconSrc) {
        this._cb = cb;
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-body').innerHTML = html;
        var iconEl = document.getElementById('confirm-icon');
        if (iconEl) {
            if (iconSrc) {
                iconEl.src = iconSrc;
                iconEl.classList.remove('hidden');
            } else {
                iconEl.src = '';
                iconEl.classList.add('hidden');
            }
        }
        document.getElementById('confirm-overlay').classList.remove('hidden');
    },
    _resolve: function (r) {
        document.getElementById('confirm-overlay').classList.add('hidden');
        if (this._cb) { this._cb(r); this._cb = null; }
    }
};

// L() shortcut for Bridge.lang()
function L(key) { return Bridge.lang(key); }

// App
var App = {
    _logExpanded: true,
    _terminalActive: false,
    _startupLogged: false,
    _hasCheckedPrereqs: false,
    _selectedSkills: {},
    _theme: localStorage.getItem('theme') || 'system',
    _isInstalling: false,
    _isUninstalling: false,
    _isCheckingPrereqs: false,
    _pendingQueue: [],
    _lastInstallProgress: {},
    _statusAnimationTimers: {},
    _nvmDetected: false,
    _systemInfo: null,
    _standardSkills: [
        'analyze', 'code-review', 'optimize', 'commit', 'jira-api',
        's3-download', 'playwright', 'fullstack-scaffold',
        'nodejs-backend-scaffold', 'nextjs-frontend-scaffold'
    ],

    init: function () {
        var self = this;

        // Theme
        this._applyTheme();
        if (window.api && window.api.setTheme) {
            window.api.setTheme(this._theme);
        } else {
            Bridge.send('setTheme', { theme: this._theme });
        }
        document.getElementById('btn-theme').addEventListener('click', function () {
            if (self._theme === 'system') self._theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
            else self._theme = self._theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', self._theme);
            self._applyTheme();
            if (window.api && window.api.setTheme) {
                window.api.setTheme(self._theme);
            } else {
                Bridge.send('setTheme', { theme: self._theme });
            }
        });
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            if (self._theme === 'system') self._applyTheme();
        });

        // Language
        document.getElementById('btn-lang').addEventListener('click', function () {
            var newLang = Bridge._langCode === 'en' ? 'tr' : 'en';
            localStorage.setItem('lang', newLang);
            if (window.api && window.api.setLanguage) {
                window.api.setLanguage(newLang);
            } else {
                Bridge.send('switchLang', { lang: newLang });
            }
        });

        // Hamburger menu
        var menuOverlay = document.getElementById('menu-overlay');
        document.getElementById('menu-btn').addEventListener('click', function (e) {
            e.stopPropagation();
            menuOverlay.classList.toggle('hidden');
        });
        menuOverlay.addEventListener('click', function (e) {
            if (e.target === menuOverlay) menuOverlay.classList.add('hidden');
        });

        // Dev Tools - separate window
        var devToolsMenuItem = document.getElementById('mi-dev-tools');
        if (devToolsMenuItem) {
            devToolsMenuItem.addEventListener('click', function () {
                menuOverlay.classList.add('hidden');
                Bridge.send('openDevTools');
            });
        }

        // Claude Best Practices - separate window
        var bestPracticesMenuItem = document.getElementById('mi-best-practices');
        if (bestPracticesMenuItem) {
            bestPracticesMenuItem.addEventListener('click', function () {
                menuOverlay.classList.add('hidden');
                Bridge.send('openBestPractices');
            });
        }

        // Skill Usage - separate window
        var skillUsageMenuItem = document.getElementById('mi-skill-usage');
        if (skillUsageMenuItem) {
            skillUsageMenuItem.addEventListener('click', function () {
                menuOverlay.classList.add('hidden');
                Bridge.send('openSkillUsage');
            });
        }

        var skillsMenuItem = document.getElementById('mi-skills');
        if (skillsMenuItem) {
            skillsMenuItem.addEventListener('click', function () {
                menuOverlay.classList.add('hidden');
                Bridge.send('openSkills');
            });
        }

        // MCP Servers - separate window
        var mcpMenuItem = document.getElementById('mi-mcp-servers');
        if (mcpMenuItem) {
            mcpMenuItem.addEventListener('click', function () {
                menuOverlay.classList.add('hidden');
                Bridge.send('openMcpServers');
            });
        }

        // About - separate window
        document.getElementById('mi-about').addEventListener('click', function () {
            menuOverlay.classList.add('hidden');
            Bridge.send('openAbout');
        });
        // Walkthrough buttons
        var wtApplySettings = document.getElementById('wt-apply-settings');
        if (wtApplySettings) wtApplySettings.addEventListener('click', function () { self._applyEditorSettings(); });
        var wtDevTools = document.getElementById('wt-dev-tools');
        if (wtDevTools) wtDevTools.addEventListener('click', function () { Bridge.send('openDevTools'); });
        var wtBp = document.getElementById('wt-best-practices');
        if (wtBp) wtBp.addEventListener('click', function () { Bridge.send('openBestPractices'); });
        var wtSkills = document.getElementById('wt-skills');
        if (wtSkills) wtSkills.addEventListener('click', function () { Bridge.send('openSkills'); });
        var wtMcp = document.getElementById('wt-mcp-servers');
        if (wtMcp) wtMcp.addEventListener('click', function () { Bridge.send('openMcpServers'); });

        document.getElementById('mi-exit').addEventListener('click', function () {
            menuOverlay.classList.add('hidden');
            Bridge.send('exit');
        });

        // Logs toggle — expand/collapse
        var terminalToggleBtn = document.getElementById('btn-terminal-toggle');
        if (terminalToggleBtn) {
            terminalToggleBtn.addEventListener('click', function () {
                if (!self._terminalActive) {
                    self._openTerminal(false);
                } else {
                    self._logExpanded = !self._logExpanded;
                    var area = document.getElementById('log-area');
                    if (area) area.classList.toggle('collapsed', !self._logExpanded);
                    self._syncTerminalButtons();
                }
            });
        }
        // Log collapse/expand arrow toggle
        var logToggleBtn = document.getElementById('btn-log-toggle');
        if (logToggleBtn) {
            logToggleBtn.addEventListener('click', function () {
                if (!self._terminalActive) return;
                self._logExpanded = !self._logExpanded;
                var area = document.getElementById('log-area');
                if (area) area.classList.toggle('collapsed', !self._logExpanded);
                self._syncTerminalButtons();
            });
        }
        // Log copy
        var logCopyBtn = document.getElementById('btn-log-copy');
        if (logCopyBtn) {
            logCopyBtn.addEventListener('click', function () {
                var lines = document.querySelectorAll('#log-area .log-line');
                var text = Array.prototype.map.call(lines, function (el) { return el.textContent; }).join('\n');
                navigator.clipboard.writeText(text).then(function () {
                    Toast.show('', 'Copied to clipboard', 'success', 2000);
                }).catch(function () {
                    Toast.show('', 'Failed to copy', 'error', 2000);
                });
            });
        }

        // Step 1: Select All prereqs (only if prereq card is in DOM — moved to dev-tools subpage)
        var selectAllBtn = document.getElementById('btn-select-all-prereq');
        if (selectAllBtn) selectAllBtn.addEventListener('click', function () {
            // First pass: check all enabled checkboxes (this checks IDE parents)
            document.querySelectorAll('.prereq-row:not([style*="display: none"]) .prereq-cb:not(:disabled)').forEach(function (cb) {
                cb.checked = true;
            });
            // Update editor selection to enable extension checkboxes (since IDEs are now checked)
            self._updateEditorSelection();
            // Second pass: check the now-enabled extension checkboxes
            document.querySelectorAll('.prereq-row:not([style*="display: none"]) .prereq-cb:not(:disabled)').forEach(function (cb) {
                cb.checked = true;
            });
            self._updateInstallBtn();
        });

        document.querySelectorAll('#step-1 .prereq-cb').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var row = cb.closest('.prereq-row');
                var changedId = row ? row.getAttribute('data-id') : null;
                self._updateEditorSelection(changedId);
                self._updateInstallBtn();
            });
        });

        var btnNext = document.getElementById('btn-next');
        if (btnNext) btnNext.addEventListener('click', function () {
            if (self._isCheckingPrereqs || !self._hasCheckedPrereqs) return;
            var items = self._getSelectedInstallItems();
            if (items.length > 0) {
                var listHtml = self._buildInstallConfirmList();
                var body = L('PrereqConfirmInstallBody') + '<br><br>' + listHtml;
                Confirm.show(L('PrereqConfirmInstallTitle'), body, function (ok) {
                    if (ok) {
                        if (self._isInstalling || self._isUninstalling) {
                            items.forEach(function (id) {
                                self._pendingQueue.push({ id: id, action: 'install' });
                                self._setPrereqStatus(id, 'queued', L('InstallStatusQueued'));
                            });
                        } else {
                            self._installSelected();
                        }
                    }
                });
            }
        });

        // Split dropdown toggle (Bootstrap-style with .show class)
        var splitGroup = document.querySelector('.split-btn-group');
        var splitToggle = document.getElementById('btn-split-toggle');
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

        // Remove Selected button
        var btnRemoveSelected = document.getElementById('btn-remove-selected');
        if (btnRemoveSelected) {
            btnRemoveSelected.addEventListener('click', function () {
                splitGroup.classList.remove('show');
                if (self._isCheckingPrereqs) return;
                var removeItems = self._getSelectedRemoveItems();
                if (removeItems.length === 0) return;
                var listHtml = self._buildRemoveConfirmList(removeItems);
                var body = L('PrereqConfirmRemoveSelectedBody').replace('{0}', listHtml);
                Confirm.show(L('PrereqConfirmRemoveSelectedTitle'), body, function (ok) {
                    if (ok) {
                        if (self._isInstalling || self._isUninstalling) {
                            removeItems.forEach(function (id) {
                                self._pendingQueue.push({ id: id, action: 'uninstall' });
                                self._setPrereqStatus(id, 'queued', L('InstallStatusQueued'));
                            });
                        } else {
                            self._uninstallSelected(removeItems);
                        }
                    }
                });
            });
        }

        // Inject action buttons into prereq rows (install for not-installed, remove for installed)
        document.querySelectorAll('#step-1 .prereq-row[data-id]').forEach(function (row) {
            var actionBtn = document.createElement('button');
            actionBtn.className = 'prereq-action-btn';
            actionBtn.type = 'button';
            var actionIcon = document.createElement('span');
            actionIcon.className = 'mi';
            actionBtn.appendChild(actionIcon);
            row.appendChild(actionBtn);
            actionBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var isBusy = self._isInstalling || self._isUninstalling;
                var id = row.getAttribute('data-id');
                var label = row.querySelector('.prereq-label');
                var name = label ? label.textContent : id;
                var iconImg = row.querySelector('.prereq-app-icon-img');
                var headerIconSrc = iconImg ? iconImg.getAttribute('src') : null;
                var state = self._getPrereqState(id);
                var isInstalled = (state === 'installed' || state === 'custom');
                if (isInstalled) {
                    // Node uninstall: show "Also remove NVM" checkbox if nvm detected
                    if (id === 'node' && self._nvmDetected) {
                        var body = L('PrereqConfirmRemoveBody').replace('{0}', '<b>' + self._escapeHtml(name) + '</b>') +
                            '<label class="confirm-checkbox-row"><input type="checkbox" id="confirm-nvm-cb">' +
                            '<span>' + L('NodeAlsoRemoveNvm') + '</span></label>';
                        Confirm.show(L('PrereqConfirmRemoveTitle'), body, function (ok) {
                            if (ok) {
                                var nvmCb = document.getElementById('confirm-nvm-cb');
                                var removeNvm = nvmCb ? nvmCb.checked : false;
                                if (isBusy) {
                                    self._pendingQueue.push({ id: id, action: 'uninstall', options: { node: { removeNvm: removeNvm } } });
                                    self._setPrereqStatus(id, 'queued', L('InstallStatusQueued'));
                                } else {
                                    self._uninstallSelected([id], { node: { removeNvm: removeNvm } });
                                }
                            }
                        }, headerIconSrc);
                    } else {
                        var body = L('PrereqConfirmRemoveBody').replace('{0}', '<b>' + self._escapeHtml(name) + '</b>');
                        Confirm.show(L('PrereqConfirmRemoveTitle'), body, function (ok) {
                            if (ok) {
                                if (isBusy) {
                                    self._pendingQueue.push({ id: id, action: 'uninstall' });
                                    self._setPrereqStatus(id, 'queued', L('InstallStatusQueued'));
                                } else {
                                    self._uninstallSelected([id]);
                                }
                            }
                        }, headerIconSrc);
                    }
                } else {
                    // Node install: show "Install with NVM" checkbox
                    if (id === 'node') {
                        var body = L('PrereqConfirmInstallSingleBody').replace('{0}', '<b>' + self._escapeHtml(name) + '</b>') +
                            '<label class="confirm-checkbox-row"><input type="checkbox" id="confirm-nvm-cb" checked>' +
                            '<span>' + L('NodeInstallWithNvm') + '</span></label>';
                        Confirm.show(L('PrereqConfirmInstallTitle'), body, function (ok) {
                            if (ok) {
                                var nvmCb = document.getElementById('confirm-nvm-cb');
                                var useNvm = nvmCb ? nvmCb.checked : true;
                                if (isBusy) {
                                    self._pendingQueue.push({ id: id, action: 'install', options: { node: { useNvm: useNvm } } });
                                    self._setPrereqStatus(id, 'queued', L('InstallStatusQueued'));
                                } else {
                                    self._openTerminal(true);
                                    self._isInstalling = true;
                                    self._updateInstallBtn();
                                    self.log(L('LogInstallingPrefix') + ' 1: ' + id);
                                    Bridge.send('installSelected', { items: [id], silent: true, options: { node: { useNvm: useNvm } } });
                                }
                            }
                        }, headerIconSrc);
                    } else {
                        var body = L('PrereqConfirmInstallSingleBody').replace('{0}', '<b>' + self._escapeHtml(name) + '</b>');
                        Confirm.show(L('PrereqConfirmInstallTitle'), body, function (ok) {
                            if (ok) {
                                if (isBusy) {
                                    self._pendingQueue.push({ id: id, action: 'install' });
                                    self._setPrereqStatus(id, 'queued', L('InstallStatusQueued'));
                                } else {
                                    self._openTerminal(true);
                                    self._isInstalling = true;
                                    self._updateInstallBtn();
                                    self.log(L('LogInstallingPrefix') + ' 1: ' + id);
                                    Bridge.send('installSelected', { items: [id], silent: true });
                                }
                            }
                        }, headerIconSrc);
                    }
                }
            });
        });

        // Confirm
        document.getElementById('confirm-yes').addEventListener('click', function () { Confirm._resolve(true); });
        document.getElementById('confirm-no').addEventListener('click', function () { Confirm._resolve(false); });
        document.getElementById('confirm-close').addEventListener('click', function () { Confirm._resolve(false); });

        this._updateStepOneAction();

        // ── Bridge events ──
        Bridge.on('init', function (d) {
            var overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.remove();
            var versionEl = document.getElementById('version');
            if (versionEl) versionEl.textContent = 'v' + d.version;
            var langBtn = document.getElementById('btn-lang');
            if (langBtn) langBtn.textContent = Bridge._langCode.toUpperCase();
            self._applyLanguage();
            self._syncSkillsSourceWarning();
            var savedLang = localStorage.getItem('lang');
            if (!savedLang || savedLang === Bridge._langCode) {
                self._logStartup(d.version);
            }
        });

        // Language changed from the main process
        Bridge.on('languageChanged', function () {
            var langBtn = document.getElementById('btn-lang');
            if (langBtn) langBtn.textContent = Bridge._langCode.toUpperCase();
            self._applyLanguage();
            if (!self._startupLogged && Bridge._initData && Bridge._initData.version) {
                self._logStartup(Bridge._initData.version);
            }
        });

        Bridge.on('themeChanged', function (theme) {
            if (!theme || typeof theme !== 'string') return;
            self._theme = theme;
            localStorage.setItem('theme', theme);
            self._applyTheme();
        });

        Bridge.on('liveStats', function (d) {
            var cpuUsageEl = document.getElementById('sys-cpu-usage');
            if (cpuUsageEl && d) {
                var val = d.cpuSpeed ? (d.cpuPercent + '% @ ' + d.cpuSpeed + ' GHz') : (d.cpuPercent + '%');
                cpuUsageEl.textContent = val;
                cpuUsageEl.title = 'CPU Usage: ' + val;
            }
            var ramEl = document.getElementById('sys-ram');
            if (ramEl && d) {
                var used = parseFloat(d.usedRamGB).toFixed(2);
                var total = parseFloat(d.totalRamGB).toFixed(2);
                var free = (parseFloat(d.totalRamGB) - parseFloat(d.usedRamGB)).toFixed(2);
                ramEl.textContent = used + ' GB / ' + total + ' GB (RAM)';
                ramEl.title = 'Usage ' + used + ' GB / Free ' + free + ' GB / Total ' + total + ' GB';
            }
        });

        Bridge.on('uptimeResult', function (d) {
            if (d) {
                var parts = [];
                if (d.days > 0) parts.push(d.days + ' ' + L('UptimeDays'));
                parts.push(d.hours + ' ' + L('UptimeHours'));
                parts.push(d.minutes + ' ' + L('UptimeMinutes'));
                var uptime = parts.join(' ');
                self._lastUptime = uptime;
                var el = document.getElementById('sys-boot');
                if (el && self._bootShowingUptime) {
                    el.textContent = uptime;
                    el.title = L('UptimeLabel') + ': ' + uptime + ' (' + L('UptimeClickHint') + ')';
                }
            }
        });

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
            self._setPrereqStatus(d.id, d.found, d.found ? d.version : L('PrereqNotFound'));
            self.log(d.id + ': ' + (d.found ? d.version : L('PrereqNotFound')));
        });

        Bridge.on('checkAllDone', function (d) { self._finishCheckAll(d && d.error ? d.error : ''); });

        Bridge.on('installProgress', function (d) {
            if (d.status === 'queued') {
                self._setPrereqStatus(d.id, 'queued', L('InstallStatusQueued'));
                if (d.message) self.log(d.id + ': ' + d.message);
            } else if (d.status === 'installing') {
                self._setPrereqStatus(d.id, 'installing', self._formatProgressText(1));
                self._startInstallAnimation(d.id);
                if (d.message) self.log(d.id + ': ' + d.message);
            } else if (d.status === 'done') {
                self._stopInstallAnimation(d.id);
                self._setPrereqStatus(d.id, 'installed', L('InstallStatusInstalled'));
                if (d.message) self.log(d.id + ': ' + d.message);
            } else {
                self._stopInstallAnimation(d.id);
                self._setPrereqStatus(d.id, false, L('PrereqFailed'));
                self.log(d.id + ': ' + L('PrereqFailed') + ' - ' + d.message);
            }
        });

        Bridge.on('uacNotice', function (d) {
            var isRemove = d && d.action === 'remove';
            var title = L('UacNoticeTitle') || 'Admin Permission Required';
            var body = isRemove
                ? (L('UacNoticeRemoveBody') || 'Windows will ask for admin permission to remove the selected tools. Please approve the prompt.')
                : (L('UacNoticeInstallBody') || 'Windows will ask for admin permission to install the selected tools. Please approve the prompt.');
            Toast.show(title, body, 'info', 8000);
        });

        Bridge.on('installAllResult', function (d) {
            if (d && d.noInternet) {
                Toast.show(L('NoInternetTitle') || 'No Internet Connection', L('NoInternetBody') || 'Please check your internet connection and try again.', 'error', 6000);
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
                self._setPrereqStatus(d.id, 'installing', L('PrereqRemoving'));
                self._startInstallAnimation(d.id, true);
            } else if (d.status === 'done') {
                self._stopInstallAnimation(d.id);
                self._setPrereqStatus(d.id, false, L('PrereqNotFound'));
            } else {
                self._stopInstallAnimation(d.id);
                self._setPrereqStatus(d.id, false, L('PrereqFailed'));
                if (d.message) self.log(d.id + ': ' + L('PrereqFailed') + ' - ' + d.message);
            }
        });

        Bridge.on('uninstallAllResult', function (d) {
            var results = (d && d.results) ? d.results : [];
            var ok = results.filter(function (r) { return r.success; }).length;
            var fail = results.length - ok;
            self._onUninstallComplete(ok, fail);
        });

        Bridge.on('editorSettingsInfo', function (d) { self._showEditorSettingsConfirm(d); });
        Bridge.on('editorSettingsApplied', function (d) { self._onEditorSettingsApplied(d); });

        Bridge.on('installSkillsResult', function (d) { self._showResult(d); });
        Bridge.on('log', function (d) { self.log(d.message); });
        Bridge.on('error', function (d) { self.log(L('LogErrorPrefix') + ': ' + d.message); Toast.show(L('CommonError'), d.message, 'error'); });
    },

    // ── Prerequisites ──
    _checkAll: function () {
        this._openTerminal(true);
        this._isCheckingPrereqs = true;
        this._hasCheckedPrereqs = false;
        this._updateStepOneAction();
        // Reset all statuses
        document.querySelectorAll('.prereq-row[data-id]').forEach(function (row) {
            if (row.style.display === 'none') return;
            var id = row.getAttribute('data-id');
            var status = document.getElementById('status-' + id);
            if (status) {
                status.textContent = L('PrereqChecking');
                status.className = 'prereq-value';
                status.setAttribute('data-state', 'checking');
            }
        });
        this.log(L('LogCheckingPrereqs'));
        Bridge.send('checkAll');
    },

    _finishCheckAll: function (errorMessage) {
        this._isCheckingPrereqs = false;
        this._hasCheckedPrereqs = !errorMessage;

        if (this._hasCheckedPrereqs) {
            this._syncPrereqCheckboxes();
            this._updateEditorSelection();
            this.log(L('PrereqCheckComplete'));
        } else if (errorMessage) {
            this.log(L('LogErrorPrefix') + ': ' + errorMessage);
        }

        this._updateStepOneAction();
        this._processPendingQueue();
    },

    _showInstallProgressToast: function (id, message) {
    },

    _formatProgressText: function (dotCount, removing) {
        var dots = '';
        for (var i = 0; i < dotCount; i++) dots += '.';
        return (removing ? L('PrereqRemoving') : L('InstallStatusInstalling')) + dots;
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

    _setPrereqStatus: function (id, found, text) {
        var status = document.getElementById('status-' + id);
        this._applyStatusToElement(status, found, text);
    },

    _applyStatusToElement: function (status, found, text) {
        var state = '';
        if (!status) return;

        if (found === 'queued') {
            state = 'queued';
            text = text || L('InstallStatusQueued');
        } else if (found === 'installing' || found === null) {
            state = 'installing';
            text = text || L('InstallStatusInstalling');
        } else if (found === 'installed') {
            state = 'installed';
            text = text || L('InstallStatusInstalled');
        } else if (found === false) {
            state = text === L('PrereqFailed') ? 'failed' : 'not_found';
            if (!text || text === '\u2014') text = L('PrereqNotFound');
        } else if (found === true) {
            if (!text || text === L('MessageInstalledLabel') || text === L('PrereqInstalled')) {
                text = L('PrereqInstalled');
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
        var status = document.getElementById('status-' + id);
        return status ? (status.getAttribute('data-state') || 'not_checked') : 'not_checked';
    },

    _applyCheckboxHint: function (row, cb, hint) {
        if (!row || !cb) return;
        var title = hint || '';
        row.title = title;
        cb.title = title;
    },

    _hasRequiredEditor: function () {
        var hasVsCode = (this._getPrereqState('vscode') === 'installed' ||
            this._getPrereqState('vscode') === 'custom' ||
            document.getElementById('cb-vscode').checked) &&
            (this._getPrereqState('vscodeClaude') === 'installed' ||
                this._getPrereqState('vscodeClaude') === 'custom' ||
                document.getElementById('cb-vscodeClaude').checked);
        return hasVsCode;
    },

    _updateEditorSelection: function (changedId) {
        var self = this;
        var editors = [
            { id: 'vscode', cbId: 'cb-vscode', children: ['vscodeClaude', 'vscodeCodex'] }
        ];

        editors.forEach(function (editor) {
            var editorCb = document.getElementById(editor.cbId);
            if (!editorCb) return;
            var editorInstalled = self._getPrereqState(editor.id) === 'installed' || self._getPrereqState(editor.id) === 'custom';

            // If an extension was just checked → auto-check its parent IDE (if not installed)
            if (changedId && editor.children.indexOf(changedId) >= 0) {
                var childCb = document.querySelector('.prereq-row[data-id="' + changedId + '"] .prereq-cb');
                if (childCb && childCb.checked && !editorInstalled && !editorCb.checked) {
                    editorCb.checked = true;
                }
            }

            // If IDE was just unchecked → uncheck all its extensions
            if (changedId === editor.id && !editorCb.checked) {
                editor.children.forEach(function (childId) {
                    var childCb = document.querySelector('.prereq-row[data-id="' + childId + '"] .prereq-cb');
                    if (childCb) childCb.checked = false;
                });
            }

            // Enable/disable extension checkboxes based on IDE availability
            var editorAvailable = editorInstalled || editorCb.checked;
            editor.children.forEach(function (childId) {
                var childCb = document.querySelector('.prereq-row[data-id="' + childId + '"] .prereq-cb');
                var childRow = document.querySelector('.prereq-row[data-id="' + childId + '"]');
                if (!childCb || !childRow) return;
                childCb.disabled = !editorAvailable;
                if (!editorAvailable) {
                    childCb.checked = false;
                }
            });
        });

        this._updateInstallBtn();
    },

    _updateInstallBtn: function () {
        this._updateStepOneAction();
    },

    _updateStepOneAction: function () {
        var btn = document.getElementById('btn-next');
        var hint = document.getElementById('next-hint');
        var hintText = document.getElementById('next-hint-text');
        var splitToggle = document.getElementById('btn-split-toggle');
        var removeSelectedText = document.getElementById('btn-remove-selected-text');
        if (!btn) return;

        if (removeSelectedText) removeSelectedText.textContent = L('PrereqRemoveSelected');

        if (this._isCheckingPrereqs) {
            btn.disabled = true;
            btn.textContent = '';
            var spinIcon = document.createElement('span');
            spinIcon.className = 'mi btn-icon spin';
            spinIcon.textContent = 'sync';
            btn.appendChild(spinIcon);
            btn.appendChild(document.createTextNode(' ' + L('PrereqChecking')));
            if (splitToggle) splitToggle.disabled = true;
            if (hint) hint.classList.add('hidden');
            return;
        }

        if (hint) hint.classList.add('hidden');
        if (hintText) hintText.textContent = '';

        btn.disabled = !this._hasCheckedPrereqs;
        if (splitToggle) splitToggle.disabled = !this._hasCheckedPrereqs;
        if (this._hasCheckedPrereqs) {
            btn.textContent = '';
            var icon = document.createElement('span');
            icon.className = 'mi btn-icon';
            icon.textContent = 'download';
            btn.appendChild(icon);
            btn.appendChild(document.createTextNode(' ' + L('PrereqInstallSelected')));
        } else {
            btn.textContent = '';
            var searchIcon = document.createElement('span');
            searchIcon.className = 'mi btn-icon';
            searchIcon.textContent = 'search';
            btn.appendChild(searchIcon);
            btn.appendChild(document.createTextNode(' ' + L('PrereqCheckTools')));
        }
    },

    _installSelected: function () {
        var items = this._getSelectedInstallItems();
        if (items.length === 0) return;

        this._openTerminal(true);
        this._isInstalling = true;
        this._lastInstallProgress = {};
        var btn = document.getElementById('btn-next');
        btn.disabled = true;
        btn.textContent = '';
        var spinIcon = document.createElement('span');
        spinIcon.className = 'mi btn-icon spin';
        spinIcon.textContent = 'sync';
        btn.appendChild(spinIcon);
        btn.appendChild(document.createTextNode(' ' + L('PrereqInstalling')));
        var splitToggle = document.getElementById('btn-split-toggle');
        if (splitToggle) splitToggle.disabled = true;
        this.log(L('LogInstallingPrefix') + ' ' + items.length + ': ' + items.join(', '));
        Bridge.send('installSelected', {
            items: items,
            silent: true
        });
    },

    _startInstall: function (which) {
        this._isInstalling = true;
        this._updateInstallBtn();
    },


    // ── Skills ──
    _showStandardSkills: function () {
        this._selectedSkills = {};
        var html = '';
        for (var i = 0; i < this._standardSkills.length; i++) {
            var n = this._standardSkills[i];
            this._selectedSkills[n] = true;
            html += '<label class="skill-row"><input type="checkbox" class="skill-checkbox" data-skill="' + n + '" checked>' +
                '<span class="skill-name">' + n + '</span></label>';
        }
        document.getElementById('skills-list').innerHTML = html;
        this._bindCheckboxes();
        this._applySkillFilter(document.getElementById('skills-search').value);
        this._updateCount();
        this.log(this._standardSkills.length + ' ' + L('SkillsReady'));
    },

    _bindCheckboxes: function () {
        var self = this;
        document.querySelectorAll('.skill-checkbox').forEach(function (cb) {
            cb.addEventListener('change', function () {
                if (this.checked) self._selectedSkills[this.getAttribute('data-skill')] = true;
                else delete self._selectedSkills[this.getAttribute('data-skill')];
                self._updateCount();
            });
        });
    },

    _setAllSkills: function (sel) {
        var self = this;
        document.querySelectorAll('.skill-row:not(.hidden) .skill-checkbox').forEach(function (cb) {
            cb.checked = sel;
            if (sel) self._selectedSkills[cb.getAttribute('data-skill')] = true;
            else delete self._selectedSkills[cb.getAttribute('data-skill')];
        });
        this._updateCount();
    },

    _applySkillFilter: function (query) {
        var normalized = (query || '').trim().toLowerCase();
        document.querySelectorAll('.skill-row').forEach(function (row) {
            var nameEl = row.querySelector('.skill-name');
            var name = nameEl ? nameEl.textContent.toLowerCase() : '';
            row.classList.toggle('hidden', !!normalized && name.indexOf(normalized) === -1);
        });
    },

    _updateCount: function () {
        var c = Object.keys(this._selectedSkills).length;
        document.getElementById('skills-count').textContent = c + ' ' + L('SkillsSelected');
        document.getElementById('skills-status-badge').textContent = c;
        document.getElementById('btn-import').disabled = c === 0;
    },

    _doImport: function () {
        var skills = Object.keys(this._selectedSkills);
        if (!skills.length) return;
        if (Bridge._initData && Bridge._initData.skillsRepoFound === false) {
            this._showResult({
                success: false,
                message: L('MessageSkillsRepoNotFound'),
                sourceDir: '',
                skillsDir: Bridge._initData.skillsDir || '',
                results: []
            });
            Toast.show(L('ResultFailed'), L('MessageSkillsRepoNotFound'), 'error', 5000);
            this.log(L('ResultFailed') + ': ' + L('MessageSkillsRepoNotFound'));
            return;
        }
        var btn = document.getElementById('btn-import');
        btn.disabled = true;
        btn.innerHTML = '<span class="mi btn-icon spin">sync</span> ' + L('SkillsImporting');
        document.getElementById('btn-back-skills').disabled = true;
        Toast.show(L('CommonImport'), skills.length + ' ' + L('SkillsWord') + '...', 'info');
        this.log(L('SkillsImporting') + ' ' + skills.length + ' ' + L('SkillsWord') + '...');
        Bridge.send('installSkills', { skills: skills });
    },

    _showResult: function (data) {
        var btn = document.getElementById('btn-import');
        var backBtn = document.getElementById('btn-back-skills');
        var resultCard = document.getElementById('result-card');
        var summaryText = data.success ? L('MessageImportDoneCloseApp') : (data.message || '');

        if (resultCard) resultCard.classList.add('hidden');

        if (backBtn) backBtn.disabled = false;

        if (data.success) {
            btn.innerHTML = '<span class="mi btn-icon">check</span> ' + L('BtnDone');
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');
            btn.disabled = false;
            if (backBtn) backBtn.disabled = false;
            Toast.show(L('ResultComplete'), summaryText, 'success', 5000);
            this.log(L('CommonDone') + ': ' + summaryText);
        } else {
            btn.innerHTML = '<span class="mi btn-icon">download</span> ' + L('SkillsImport');
            btn.classList.remove('btn-success');
            btn.classList.add('btn-primary');
            btn.disabled = Object.keys(this._selectedSkills).length === 0;
            if (backBtn) backBtn.disabled = false;
            Toast.show(L('ResultFailed'), data.message, 'error', 5000);
            this.log(L('ResultFailed') + ': ' + data.message);
        }
    },

    // ── Helpers ──
    log: function (msg) {
        if (!this._terminalActive) this._openTerminal(true);
        var a = document.getElementById('log-area');
        if (!a) return;
        var l = document.createElement('div');
        l.className = 'log-line';
        l.textContent = '[' + new Date().toLocaleTimeString() + '] ' + (msg || '');
        a.appendChild(l); a.scrollTop = a.scrollHeight;
    },

    _escapeHtml: function (value) {
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return map[c]; });
    },

    _buildInstallConfirmList: function () {
        var self = this;
        var html = '<div class="install-list">';
        document.querySelectorAll('#step-1 .prereq-row[data-id]').forEach(function (row) {
            var id = row.getAttribute('data-id');
            var cb = row.querySelector('.prereq-cb');
            if (!cb || !cb.checked) return;
            var label = row.querySelector('.prereq-label');
            var name = label ? label.textContent : id;
            var state = self._getPrereqState(id);
            var isInstalled = (state === 'installed' || state === 'custom');
            if (isInstalled) {
                html += '<div style="color:var(--text-faint);"><b>' + self._escapeHtml(name) + '</b> — ' + L('PrereqAlreadyInstalled') + '</div>';
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
        document.querySelectorAll('#step-1 .prereq-row[data-id]').forEach(function (row) {
            var id = row.getAttribute('data-id');
            var cb = row.querySelector('.prereq-cb');
            if (!cb || !cb.checked) return;
            var label = row.querySelector('.prereq-label');
            var name = label ? label.textContent : id;
            var state = self._getPrereqState(id);
            var isInstalled = (state === 'installed' || state === 'custom');
            if (isInstalled) {
                html += '<div><b>' + self._escapeHtml(name) + '</b></div>';
            } else {
                html += '<div style="color:var(--text-faint);"><b>' + self._escapeHtml(name) + '</b> — ' + L('PrereqNotInstalledOrRemoved') + '</div>';
            }
        });
        return html;
    },

    _syncPrereqCheckboxes: function () {
        var self = this;
        document.querySelectorAll('#step-1 .prereq-row[data-id]').forEach(function (row) {
            var cb = row.querySelector('.prereq-cb');
            var actionBtn = row.querySelector('.prereq-action-btn');
            if (!cb) return;
            var state = self._getPrereqState(row.getAttribute('data-id'));
            var isInstalled = (state === 'installed' || state === 'custom');

            // Update action button: remove for installed, install for not-installed
            if (actionBtn) {
                var icon = actionBtn.querySelector('.mi');
                if (isInstalled) {
                    actionBtn.classList.remove('action-install');
                    actionBtn.classList.add('action-remove', 'visible');
                    actionBtn.title = L('PrereqRemoveTooltip');
                    if (icon) icon.textContent = 'delete_outline';
                } else if (state === 'not_found' || state === 'failed') {
                    actionBtn.classList.remove('action-remove');
                    actionBtn.classList.add('action-install', 'visible');
                    actionBtn.title = L('PrereqInstallSelected') || 'Install';
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
            self._applyCheckboxHint(row, cb, '');
        });
        this._updateEditorSelection();
    },

    _getSelectedInstallItems: function () {
        var items = [];
        var self = this;

        document.querySelectorAll('#step-1 .prereq-row[data-id]').forEach(function (row) {
            var id = row.getAttribute('data-id');
            var cb = row.querySelector('.prereq-cb');
            var state = self._getPrereqState(id);
            var parentId = row.getAttribute('data-parent');
            var parentState = parentId ? self._getPrereqState(parentId) : '';
            var parentCb = parentId ? document.querySelector('#step-1 .prereq-row[data-id="' + parentId + '"] .prereq-cb') : null;
            var parentSelected = !!(parentCb && parentCb.checked);
            var parentAvailable = !parentId || parentState === 'installed' || parentState === 'custom' || parentSelected;
            var installable = (state === 'not_found' || state === 'failed') && parentAvailable;

            if (cb && cb.checked && installable) {
                items.push(id);
            }
        });

        return items;
    },

    _updateInstallAction: function (precomputedCount) {
        this._updateStepOneAction();
    },

    _syncSkillsSourceWarning: function () {
        var warning = document.getElementById('skills-source-warning');
        if (!warning) return;

        var missing = !!(Bridge._initData && Bridge._initData.skillsRepoFound === false);
        warning.textContent = missing ? L('SkillsSourceWarning') : '';
        warning.classList.toggle('hidden', !missing);
    },

    _logStartup: function (version) {
        var appLoadedText = L('LogAppLoaded');
        if (appLoadedText === 'LogAppLoaded') appLoadedText = 'App loaded';
        this.log(appLoadedText + ' v' + version);
        this._startupLogged = true;
        if (!this._hasCheckedPrereqs && !this._isCheckingPrereqs) {
            this._checkAll();
        }
    },

    _openTerminal: function (startCollapsed) {
        if (this._terminalActive) return;
        this._terminalActive = true;
        this._logExpanded = !startCollapsed;
        var area = document.getElementById('log-area');
        if (area) {
            while (area.firstChild) area.removeChild(area.firstChild);
            if (startCollapsed) {
                area.classList.add('collapsed');
            } else {
                area.classList.remove('collapsed');
            }
        }
        this._syncTerminalButtons();
    },

    _closeTerminal: function () {
        this._terminalActive = false;
        this._logExpanded = false;
        var area = document.getElementById('log-area');
        if (area) { area.textContent = ''; area.classList.add('collapsed'); }
        this._syncTerminalButtons();
    },

    _syncTerminalButtons: function () {
        var copyBtn = document.getElementById('btn-log-copy');
        var toggleBtn = document.getElementById('btn-log-toggle');
        var toggleIcon = document.getElementById('log-toggle');
        if (copyBtn) copyBtn.classList.toggle('hidden', !this._terminalActive || !this._logExpanded);
        if (toggleBtn) toggleBtn.classList.toggle('hidden', !this._terminalActive);
        if (toggleIcon) toggleIcon.textContent = this._logExpanded ? 'expand_less' : 'expand_more';
    },

    _showSystemInfo: function (info) {
        this._systemInfo = info;
        var n = function (v) { return (v === null || v === undefined || v === '') ? '—' : v; };

        // OS + arch merged
        var osVal = n(info.os) + ' ' + n(info.arch);
        var cpuVal = (info.cpuCores || '?') + ' \u00d7 ' + n(info.cpuName);
        var usedGB = parseFloat(info.usedRamGB || 0).toFixed(2);
        var totalGB = parseFloat(info.totalRamGB || 0).toFixed(2);
        var freeGB = (parseFloat(info.totalRamGB || 0) - parseFloat(info.usedRamGB || 0)).toFixed(2);
        var ramVal = usedGB + ' GB / ' + totalGB + ' GB (RAM)';
        var ramTip = 'Usage ' + usedGB + ' GB / Free ' + freeGB + ' GB / Total ' + totalGB + ' GB';
        var diskVal = n(info.diskFree) + ' GB ' + L('SysDiskFree') + ' / ' + n(info.diskTotal) + ' GB';

        var entries = [
            { id: 'sys-os', value: osVal, tip: 'OS: ' + osVal },
            { id: 'sys-cpu', value: cpuVal, tip: 'CPU: ' + cpuVal },
            { id: 'sys-ram', value: ramVal, tip: ramTip },
            { id: 'sys-disk', value: diskVal, tip: 'Disk: ' + diskVal }
        ];
        entries.forEach(function (entry) {
            var el = document.getElementById(entry.id);
            if (el) { el.textContent = entry.value; el.title = entry.tip; }
        });

        // Boot row: default shows uptime, click toggles to boot time
        this._bootTime = n(info.bootTime);
        this._bootShowingUptime = true;
        Bridge.send('getUptime');

        var self = this;
        var bootRow = document.getElementById('sysinfo-row-boot');
        if (bootRow && !bootRow._uptimeHandler) {
            bootRow._uptimeHandler = true;
            bootRow.addEventListener('click', function () {
                self._bootShowingUptime = !self._bootShowingUptime;
                var el = document.getElementById('sys-boot');
                if (!el) return;
                if (self._bootShowingUptime) {
                    Bridge.send('getUptime');
                } else {
                    el.textContent = self._bootTime;
                    el.title = L('BootTimeLabel') + ': ' + self._bootTime + ' (' + L('UptimeClickHint') + ')';
                }
            });
        }

        // Start live CPU + RAM monitoring
        this._startLiveMonitor();
    },

    _startLiveMonitor: function () {
        if (this._liveMonitorInterval) return;
        Bridge.send('getLiveStats');
        var self = this;
        this._liveMonitorInterval = setInterval(function () {
            Bridge.send('getLiveStats');
        }, 3000);
    },

    _applyTheme: function () {
        var html = document.documentElement;
        var btn = document.getElementById('btn-theme');
        var isDark;
        html.setAttribute('data-theme', this._theme);
        if (this._theme === 'system') { isDark = window.matchMedia('(prefers-color-scheme: dark)').matches; }
        else { isDark = this._theme === 'dark'; }
        if (btn) btn.textContent = isDark ? '\u2600' : '\u263E';
    },

    _applyLanguage: function () {
        var el;
        var $ = function (id) { return document.getElementById(id); };

        el = document.querySelector('#header .header-title');
        if (el) el.textContent = L('AppName');
        document.title = L('AppName');

        // System Info card
        document.querySelectorAll('.sysinfo-card .card-header h2').forEach(function (title) {
            title.textContent = L('SysInfoTitle');
        });

        // Refresh sysinfo display if data is available
        if (this._systemInfo) {
            this._showSystemInfo(this._systemInfo);
        }

        // Prerequisites card
        el = document.querySelector('#step-1 .prereq-card .card-header h2');
        if (el) el.textContent = L('PrereqTitle');

        // Prereq labels
        var prereqMap = {
            node: 'PrereqNodeJs',
            git: 'PrereqGit',
            claude: 'PrereqClaudeCli',
            vscode: 'PrereqVsCode',
            vscodeClaude: 'PrereqClaudeCodeExtension',
            vscodeCodex: 'PrereqCodexExtension',
            claudeDesktop: 'PrereqClaudeDesktop',
            codexCli: 'PrereqCodexCli',
            codexApp: 'PrereqCodexApp',
            githubCli: 'PrereqGithubCli'
        };
        Object.keys(prereqMap).forEach(function (id) {
            var row = document.querySelector('.prereq-row[data-id="' + id + '"]');
            if (!row) return;
            var label = row.querySelector('.prereq-label');
            if (label) label.textContent = L(prereqMap[id]);
        });

        // Prereq status text by state
        var statusByState = {
            checking: 'PrereqChecking',
            queued: 'InstallStatusQueued',
            installing: 'InstallStatusInstalling',
            installed: 'InstallStatusInstalled',
            not_found: 'PrereqNotFound',
            failed: 'PrereqFailed',
            removing: 'PrereqRemoving'
        };
        document.querySelectorAll('.prereq-value').forEach(function (e) {
            var state = e.getAttribute('data-state');
            if (state === 'not_checked') {
                e.textContent = '';
                e.className = 'prereq-value prereq-pending';
                return;
            }
            var key = statusByState[state];
            if (key) e.textContent = L(key);
        });

        el = $('btn-select-all-prereq');
        if (el) el.textContent = L('PrereqSelectAll');

        // Action button tooltips
        document.querySelectorAll('.prereq-action-btn.action-remove').forEach(function (btn) {
            btn.title = L('PrereqRemoveTooltip');
        });

        // Remove Selected menu item text
        el = $('btn-remove-selected-text');
        if (el) el.textContent = L('PrereqRemoveSelected');

        // Navigation
        this._updateStepOneAction();

        // Confirm dialog
        el = $('confirm-yes');
        if (el) el.textContent = L('ConfirmYes');
        el = $('confirm-no');
        if (el) el.textContent = L('ConfirmNo');
        el = $('confirm-title');
        if (el) el.textContent = L('ConfirmTitle');

        // Result / Done
        el = document.querySelector('#result-card .card-header h2');
        if (el) el.textContent = L('StepDoneTitle');
        el = $('btn-open-folder');
        if (el) el.innerHTML = '<span class="mi btn-icon">folder_open</span> ' + L('BtnOpenSkillsFolder');
        el = $('btn-exit');
        if (el) el.innerHTML = '<span class="mi btn-icon">close</span> ' + L('BtnExit');

        // Menu
        el = $('mi-dev-tools-text');
        if (el) el.textContent = L('MenuDevTools');
        el = $('mi-best-practices-text');
        if (el) el.textContent = L('MenuBestPractices');
        el = $('mi-skill-usage-text');
        if (el) el.textContent = L('MenuSkillUsage');
        el = $('mi-skills-text');
        if (el) el.textContent = L('MenuSkillsCatalog');
        el = $('mi-mcp-servers-text');
        if (el) el.textContent = L('MenuMcpServers');
        el = $('mi-about-text');
        if (el) el.textContent = L('MenuAbout');
        el = $('mi-exit-text');
        if (el) el.textContent = L('BtnExit');
        el = $('menu-btn');
        if (el) el.title = L('MenuTitle');

        // Walkthrough
        el = $('walkthrough-title-text');
        if (el) el.textContent = L('WalkthroughTitle');
        el = $('wt-dev-tools-text');
        if (el) el.textContent = L('WalkthroughDevTools');
        el = $('wt-apply-settings-text');
        if (el) el.textContent = L('QuickAccessApplySettings');
        el = $('wt-best-practices-text');
        if (el) el.textContent = L('WalkthroughBestPractices');
        el = $('wt-skills-text');
        if (el) el.textContent = L('WalkthroughSkillsCatalog');
        el = $('wt-mcp-servers-text');
        if (el) el.textContent = L('WalkthroughMcpServers');

        // Log
        el = $('log-title');
        if (el) el.textContent = L('LogTitle');

        // Footer button titles
        el = $('btn-theme');
        if (el) el.title = L('ThemeToggleTitle');
        el = $('btn-lang');
        if (el) el.title = L('LanguageToggleTitle');

        // Lang button
        $('btn-lang').textContent = Bridge._langCode.toUpperCase();

        if (this._systemInfo) this._showSystemInfo(this._systemInfo);
        try { this._updateCount(); } catch (_) {}
    },

    // ── Editor Settings ──
    _applyEditorSettings: function () {
        Bridge.send('getEditorSettings');
    },

    _showEditorSettingsConfirm: function (editors) {
        var self = this;
        var editorKeys = Object.keys(editors);
        if (editorKeys.length === 0) {
            Toast.show(L('CommonInfo'), L('SettingsNoEditors'), 'warning');
            return;
        }

        var editorNames = { vscode: 'VS Code' };
        var editorIcons = { vscode: 'assets/devtools/vscode.png' };
        var html = '';

        for (var i = 0; i < editorKeys.length; i++) {
            var editor = editorKeys[i];
            var settings = editors[editor];
            html += '<div style="margin-bottom:12px;">';
            var iconSrc = editorIcons[editor];
            var iconTag = iconSrc ? '<img src="' + iconSrc + '" style="width:12px;height:12px;vertical-align:middle;margin-right:5px;border-radius:2px;">' : '';
            html += '<div style="font-weight:600;margin-bottom:6px;display:flex;align-items:center;">' + iconTag + self._escapeHtml(editorNames[editor] || editor) + ':</div>';
            var settingKeys = Object.keys(settings);
            for (var j = 0; j < settingKeys.length; j++) {
                var key = settingKeys[j];
                var info = settings[key];
                if (info.alreadyApplied) {
                    html += '<div style="color:var(--text-faint);padding:2px 0;"><span style="margin-right:4px;">\u2713</span>' +
                        self._escapeHtml(info.label) + ': ' + L('SettingsAlreadyApplied') + '</div>';
                } else {
                    var curDisplay = info.currentValue === undefined ? 'Not set' : String(info.currentValue);
                    var newDisplay = String(info.newValue);
                    html += '<div style="padding:2px 0;color:var(--accent);"><span style="margin-right:4px;">\u2192</span>' +
                        self._escapeHtml(info.label) + ': ' +
                        '<span style="text-decoration:line-through;opacity:0.7;">' + self._escapeHtml(curDisplay) + '</span>' +
                        ' \u2192 <b>' + self._escapeHtml(newDisplay) + '</b></div>';
                }
            }
            html += '</div>';
        }

        Confirm.show(L('SettingsConfirmTitle'), html, function (ok) {
            if (ok) {
                Bridge.send('applyEditorSettings');
            }
        });
    },

    _onEditorSettingsApplied: function (results) {
        var editorNames = { vscode: 'VS Code' };
        var allOk = true;
        var msgs = [];
        var keys = Object.keys(results);
        for (var i = 0; i < keys.length; i++) {
            var editor = keys[i];
            var r = results[editor];
            if (r.success) {
                msgs.push((editorNames[editor] || editor) + ': OK');
            } else {
                allOk = false;
                msgs.push((editorNames[editor] || editor) + ': ' + (r.message || 'Failed'));
            }
        }
        if (allOk) {
            Toast.show(L('CommonInfo'), L('SettingsApplied'), 'success');
        } else {
            Toast.show(L('CommonError'), msgs.join(', '), 'error');
        }
    },

    // Called from the host bridge after checks complete
    _onCheckAllDone: function () {
        this._finishCheckAll('');
    },

    _onInstallProgress: function (id, status, message) {
        if (status === 'queued') {
            this._setPrereqStatus(id, 'queued', L('InstallStatusQueued'));
            if (message) this.log(id + ': ' + message);
        } else if (status === 'installing') {
            this._setPrereqStatus(id, 'installing', this._formatProgressText(1));
            this._startInstallAnimation(id);
            if (message) this.log(id + ': ' + message);
        } else if (status === 'done') {
            this._stopInstallAnimation(id);
            this._setPrereqStatus(id, 'installed', L('InstallStatusInstalled'));
            if (message) this.log(id + ': ' + message);
        } else {
            this._stopInstallAnimation(id);
            this._setPrereqStatus(id, false, L('PrereqFailed'));
            this.log(id + ': ' + L('PrereqFailed') + ' \u2014 ' + message);
        }
    },

    _onInstallComplete: function (okCount, failCount) {
        this._isInstalling = false;
        var btn = document.getElementById('btn-next');
        if (btn) {
            btn.disabled = false;
        }
        this._syncPrereqCheckboxes();

        var totalCount = okCount + failCount;
        var summary = okCount + '/' + totalCount + ' ' + L('CommonSucceeded');
        this.log(L('PrereqInstallSelected') + ': ' + summary);
        this._updateInstallBtn();
        this._processPendingQueue();
    },

    _getSelectedRemoveItems: function () {
        var items = [];
        var self = this;
        document.querySelectorAll('#step-1 .prereq-row[data-id]').forEach(function (row) {
            var id = row.getAttribute('data-id');
            var cb = row.querySelector('.prereq-cb');
            var state = self._getPrereqState(id);
            var isInstalled = (state === 'installed' || state === 'custom');
            if (cb && cb.checked && isInstalled) {
                items.push(id);
            }
        });
        return items;
    },

    _uninstallSelected: function (items, options) {
        if (!items || items.length === 0) return;

        this._openTerminal(true);
        this._isUninstalling = true;
        var btn = document.getElementById('btn-next');
        if (btn) btn.disabled = true;
        var splitToggle = document.getElementById('btn-split-toggle');
        if (splitToggle) splitToggle.disabled = true;
        this.log(L('PrereqRemoving') + ' ' + items.length + ': ' + items.join(', '));
        var payload = { items: items };
        if (options) payload.options = options;
        Bridge.send('uninstallSelected', payload);
    },

    _onUninstallComplete: function (okCount, failCount) {
        this._isUninstalling = false;
        var btn = document.getElementById('btn-next');
        if (btn) btn.disabled = false;

        var totalCount = okCount + failCount;
        var summary = okCount + '/' + totalCount + ' ' + L('CommonSucceeded');
        this.log(L('PrereqRemoveSelected') + ': ' + summary);

        // Re-check all tools to refresh status
        this._checkAll();
        this._processPendingQueue();
    },

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
            // Re-queue uninstall items so they run after install completes
            for (var u = 0; u < uninstallItems.length; u++) {
                var opts = {};
                var uid = uninstallItems[u];
                if (uninstallOptions[uid]) opts = uninstallOptions[uid];
                this._pendingQueue.push({ id: uid, action: 'uninstall', options: Object.keys(opts).length > 0 ? opts : undefined });
            }
            this._openTerminal(true);
            this._isInstalling = true;
            this._updateInstallBtn();
            this.log(L('LogInstallingPrefix') + ' ' + installItems.length + ': ' + installItems.join(', '));
            var payload = { items: installItems, silent: true };
            if (Object.keys(installOptions).length > 0) payload.options = installOptions;
            Bridge.send('installSelected', payload);
        } else if (uninstallItems.length > 0) {
            var uOpts = Object.keys(uninstallOptions).length > 0 ? uninstallOptions : undefined;
            this._uninstallSelected(uninstallItems, uOpts);
        }
    }
};

App.init();
