// Sub Window - renders a single page based on URL query parameter
(function () {
    var params = new URLSearchParams(window.location.search);
    var pageName = params.get('page') || 'about';
    var pageLoadPromises = {};
    var loadedPages = {};

    var pageConfig = {
        about: { scriptPath: 'js/pages/about.js', globalName: 'AboutPage' },
        'best-practices': { scriptPath: 'js/pages/best-practices.js', globalName: 'BestPracticesPage' },
        'skill-usage': { scriptPath: 'js/pages/skill-usage.js', globalName: 'SkillUsagePage' },
        skills: { scriptPath: 'js/pages/skills.js', globalName: 'SkillsPage' },
        'mcp-guide': { scriptPath: 'js/pages/mcp-guide.js', globalName: 'McpGuidePage' },
        'mcp-servers': { scriptPath: 'js/pages/mcp-servers.js', globalName: 'McpServersPage' },
        'dev-tools': { scriptPath: 'js/pages/dev-tools.js', globalName: 'DevToolsPage' },
        'recommended-settings': { scriptPath: 'js/pages/recommended-settings.js', globalName: 'RecommendedSettingsPage' },
        'global-rules': { scriptPath: 'js/pages/global-rules.js', globalName: 'GlobalRulesPage' }
    };

    function getPage(page) {
        if (loadedPages[page]) {
            return loadedPages[page];
        }

        var config = pageConfig[page];
        if (!config) {
            return null;
        }

        var pageObject = window[config.globalName];
        if (pageObject) {
            loadedPages[page] = pageObject;
            return pageObject;
        }

        return null;
    }

    function ensurePageLoaded(page) {
        var existing = getPage(page);
        if (existing) {
            return Promise.resolve(existing);
        }

        if (pageLoadPromises[page]) {
            return pageLoadPromises[page];
        }

        var config = pageConfig[page];
        if (!config) {
            return Promise.reject(new Error('Unknown page: ' + page));
        }

        pageLoadPromises[page] = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = config.scriptPath;
            script.async = true;

            script.onload = function () {
                var pageObject = getPage(page);
                if (!pageObject) {
                    delete pageLoadPromises[page];
                    reject(new Error('Page object not found after loading: ' + config.globalName));
                    return;
                }

                resolve(pageObject);
            };

            script.onerror = function () {
                delete pageLoadPromises[page];
                reject(new Error('Failed to load page script: ' + config.scriptPath));
            };

            document.head.appendChild(script);
        });

        return pageLoadPromises[page];
    }

    function applyLanguage() {
        var L = Bridge.lang.bind(Bridge);
        var title = document.getElementById('header-title');
        if (!title) return;

        if (pageName === 'about') {
            title.textContent = L('AboutTitle');
            document.title = L('AboutTitle') + ' - ' + L('AppName');
        } else if (pageName === 'best-practices') {
            title.textContent = L('BestPracticesTitle') || 'Claude Best Practices';
            document.title = (L('BestPracticesTitle') || 'Claude Best Practices') + ' - ' + L('AppName');
        } else if (pageName === 'skill-usage') {
            title.textContent = L('SkillUsageTitle') || 'Skills Guide';
            document.title = (L('SkillUsageTitle') || 'Skills Guide') + ' - ' + L('AppName');
        } else if (pageName === 'skills') {
            title.textContent = L('SkillsCatalogTitle') || 'Skills';
            document.title = (L('SkillsCatalogTitle') || 'Skills') + ' - ' + L('AppName');
        } else if (pageName === 'mcp-guide') {
            title.textContent = L('McpGuideTitle') || 'MCP Guide';
            document.title = (L('McpGuideTitle') || 'MCP Guide') + ' - ' + L('AppName');
        } else if (pageName === 'mcp-servers') {
            title.textContent = L('McpTitle') || 'MCP Server & Plugin';
            document.title = (L('McpTitle') || 'MCP Server & Plugin') + ' - ' + L('AppName');
        } else if (pageName === 'dev-tools') {
            title.textContent = L('PrereqTitle') || 'Dev Tools';
            document.title = (L('PrereqTitle') || 'Dev Tools') + ' - ' + L('AppName');
        } else if (pageName === 'global-rules') {
            title.textContent = L('GlobalRulesTitle') || 'Global Claude Rules';
            document.title = (L('GlobalRulesTitle') || 'Global Claude Rules') + ' - ' + L('AppName');
        } else {
            title.textContent = L('AppName');
            document.title = L('AppName');
        }

    }

    function normalizeTheme(theme) {
        return (theme === 'dark' || theme === 'light' || theme === 'system') ? theme : 'system';
    }

    function applyTheme(theme) {
        var html = document.documentElement;
        var resolvedTheme = normalizeTheme(theme || (Bridge._settings && Bridge._settings.theme));
        if (!theme && (!Bridge._settings || !Bridge._settings.theme)) {
            try {
                resolvedTheme = normalizeTheme(localStorage.getItem('theme') || 'system');
            } catch (_) {
                resolvedTheme = 'system';
            }
        }

        html.setAttribute('data-theme', resolvedTheme);
        try {
            localStorage.setItem('theme', resolvedTheme);
        } catch (_) { }
    }

    function syncPageLayoutClass() {
        if (!document.body) return;
        var footerLayoutActive = pageName === 'about' || pageName === 'best-practices' || pageName === 'skill-usage' || pageName === 'skills' || pageName === 'mcp-guide' || pageName === 'mcp-servers' || pageName === 'dev-tools' || pageName === 'recommended-settings' || pageName === 'global-rules';
        document.body.classList.toggle('best-practices-page-active', pageName === 'best-practices' || pageName === 'skill-usage' || pageName === 'skills' || pageName === 'mcp-guide' || pageName === 'mcp-servers' || pageName === 'dev-tools' || pageName === 'recommended-settings' || pageName === 'global-rules');
        document.body.classList.toggle('footer-layout-active', footerLayoutActive);
    }

    function renderPage() {
        var container = document.getElementById('page-container');
        if (!container) return;

        var L = Bridge.lang.bind(Bridge);
        syncPageLayoutClass();
        container.innerHTML = '<div class="loading-container"><div class="loading-text">' +
            L('CommonLoading') + '</div></div>';
        container.scrollTop = 0;

        ensurePageLoaded(pageName)
            .then(function (page) {
                container.innerHTML = page.render();
                container.scrollTop = 0;
                if (page.afterRender) {
                    page.afterRender();
                }
                if (Bridge.syncThemeAssets) {
                    Bridge.syncThemeAssets(Bridge._settings && Bridge._settings.theme);
                }
            })
            .catch(function (err) {
                container.innerHTML = '<div class="table-empty">' +
                    L('CommonError') + '</div>';
                if (window.console && window.console.error) {
                    window.console.error(err);
                }
            });
    }

    // Pre-load the page script
    ensurePageLoaded(pageName).catch(function () { });

    // Wait for initial bridge payload
    Bridge.on('init', function (data) {
        var overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.remove();
        applyTheme(data && data.settings ? data.settings.theme : null);
        syncPageLayoutClass();
        applyLanguage();
        renderPage();
    });

    Bridge.on('themeChanged', function (theme) {
        applyTheme(theme);
    });

    Bridge.on('languageChanged', function () {
        try {
            localStorage.setItem('lang', Bridge._langCode);
        } catch (_) { }
        applyLanguage();
        renderPage();
    });
})();
