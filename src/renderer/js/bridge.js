function resolveThemeVariant(theme) {
    var mode = theme || (document.documentElement && document.documentElement.getAttribute('data-theme')) || 'system';
    if (mode !== 'dark' && mode !== 'light' && mode !== 'system') {
        mode = 'system';
    }
    if (mode === 'system') {
        try {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } catch (_) {
            return 'light';
        }
    }
    return mode;
}

function applyThemeAwareAssets(theme) {
    var resolvedTheme = resolveThemeVariant(theme);
    document.querySelectorAll('[data-theme-light-src][data-theme-dark-src]').forEach(function (node) {
        var nextSrc = resolvedTheme === 'dark'
            ? node.getAttribute('data-theme-dark-src')
            : node.getAttribute('data-theme-light-src');
        if (nextSrc && node.getAttribute('src') !== nextSrc) {
            node.setAttribute('src', nextSrc);
        }
    });
}

var Bridge = {
    _handlers: {},
    _language: {},
    _langCode: 'en',
    _settings: {},
    _initData: null,

    send: function (type, data) {
        if (window.api) {
            window.api.send(type, data || {});
        }
    },

    on: function (type, handler) {
        if (typeof handler !== 'function') return;
        if (!this._handlers[type]) this._handlers[type] = [];
        this._handlers[type].push(handler);
    },

    _emit: function (type, data) {
        var handlers = this._handlers[type];
        if (handlers) handlers.slice().forEach(function (h) { h(data); });
    },

    lang: function (key) {
        return this._language[key] || key;
    },

    init: function (data) {
        data = data || {};
        this._initData = data;
        this._language = data.language || this._language || {};
        this._langCode = data.langCode || this._langCode || 'en';
        this._settings = data.settings || this._settings || {};
        applyThemeAwareAssets(this._settings.theme);
        this._emit('init', data);
    },

    syncThemeAssets: function (theme) {
        applyThemeAwareAssets(theme || (this._settings && this._settings.theme));
    }
};

if (window.api) {
    window.api.onMessage(function (msg) {
        if (!msg || !msg.type) return;

        if (msg.type === 'init') {
            Bridge.init(msg.data);
        } else if (msg.type === 'languageChanged') {
            Bridge._language = msg.data.language || {};
            Bridge._langCode = msg.data.langCode || 'en';
            Bridge._emit('languageChanged', msg.data);
        } else if (msg.type === 'projectScanUpdate') {
            // Deferred scanner result — backfill init data so pages opened
            // later see the same shape as before the deferral, and also
            // emit for anyone listening live.
            if (Bridge._initData) Bridge._initData.projectScan = msg.data;
            Bridge._emit('projectScanUpdate', msg.data);
        } else {
            Bridge._emit(msg.type, msg.data);
        }
    });

    if (window.api.onSetTheme) {
        window.api.onSetTheme(function (theme) {
            if (!theme || typeof theme !== 'string') return;
            Bridge._settings = Bridge._settings || {};
            Bridge._settings.theme = theme;
            applyThemeAwareAssets(theme);
            Bridge._emit('themeChanged', theme);
        });
    }

    if (window.api.onSetLanguage) {
        window.api.onSetLanguage(function (lang) {
            if (!lang || typeof lang !== 'string') return;
            window.api.send('switchLang', { lang: lang });
        });
    }

    // Window controls setup (works for both main and sub windows)
    document.addEventListener('DOMContentLoaded', function () {
        applyThemeAwareAssets((Bridge._settings && Bridge._settings.theme) || null);

        function updateMaximizeButtonState(button, caps) {
            var enabled = !caps || (caps.resizable !== false && caps.maximizable !== false);
            button.classList.toggle('win-ctrl-disabled', !enabled);
            button.disabled = !enabled;
            return enabled;
        }

        function ensureMaximizeHandler(button) {
            if (button._hasClick) return;
            button._hasClick = true;
            button.addEventListener('click', function () {
                window.api.windowMaximize();
            });
        }

        var config = window.api.getWindowConfig ? window.api.getWindowConfig() : {};

        var btnMin = document.getElementById('btn-win-minimize');
        var btnMax = document.getElementById('btn-win-maximize');
        var btnClose = document.getElementById('btn-win-close');

        if (btnMin) {
            btnMin.addEventListener('click', function () { window.api.windowMinimize(); });
        }
        if (btnMax) {
            if (updateMaximizeButtonState(btnMax, config)) {
                ensureMaximizeHandler(btnMax);
            }
            // Listen for maximize/unmaximize to toggle icon
            if (window.api.onMaximizeChange) {
                window.api.onMaximizeChange(function (isMaximized) {
                    var icon = btnMax.querySelector('.mi');
                    btnMax.classList.toggle('is-window-maximized', !!isMaximized);
                    if (icon) icon.textContent = isMaximized ? 'filter_none' : 'crop_square';
                });
            }
            // Listen for capabilities update (SubWindow sends after did-finish-load)
            if (window.api.onWindowCapabilities) {
                window.api.onWindowCapabilities(function (caps) {
                    if (updateMaximizeButtonState(btnMax, caps)) {
                        ensureMaximizeHandler(btnMax);
                    }
                });
            }
        }
        if (btnClose) {
            btnClose.addEventListener('click', function () { window.api.windowClose(); });
        }
    });

    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            var currentTheme = (Bridge._settings && Bridge._settings.theme) || (document.documentElement && document.documentElement.getAttribute('data-theme')) || 'system';
            if (currentTheme === 'system') {
                applyThemeAwareAssets('system');
            }
        });
    }
}
