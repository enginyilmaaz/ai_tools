// Skill Usage Page
window.SkillUsagePage = {
    _currentPage: 0,
    _chapters: null,
    _tocExpanded: null,
    _t: null,

    _copy: function () {
        var L = Bridge.lang.bind(Bridge);
        return {
            title: L('SkillUsageTitle') || 'Skill Usage',
            searchPlaceholder: L('SkillUsageSearchPlaceholder') || 'Search skills...',
            tocTitle: L('SkillUsageTocTitle') || 'Skills',
            noResult: L('SkillUsageNoResult') || 'No results found for your search.',
            prevPage: L('SkillUsagePrevPage') || 'Previous',
            nextPage: L('SkillUsageNextPage') || 'Next',
            searchResultsTitle: L('SkillUsageSearchResultsTitle') || 'Search Results',
            searchResultCount: L('SkillUsageSearchResultCount') || ' results found',
            loadFailed: L('SkillUsageLoadFailed') || 'Skill usage content could not be loaded.',
            hWhatDoesItDo: L('SkillUsageWhatDoesItDo') || 'What Does It Do?',
            hWhenTriggered: L('SkillUsageWhenTriggered') || 'When Is It Triggered?',
            hAutoDetection: L('SkillUsageAutoDetection') || 'Auto-Detection',
            hDirectInvocation: L('SkillUsageDirectInvocation') || 'Direct Invocation',
            hExamples: L('SkillUsageExamples') || 'Usage Examples'
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

    _skillDefs: [
        { id: 'analyze', icon: 'analytics', invocation: '/analyze [file, folder, or description]', examples: ['"analyze this file"', '"analyze src/"', '"analiz et"', '"kodu analiz et"', '"review performance"'] },
        { id: 'code-review', icon: 'rate_review', invocation: '/code-review [file or description]', examples: ['"review this code"', '"check naming conventions"', '"review my changes"', '"kod kontrolu yap"'] },
        { id: 'optimize', icon: 'speed', invocation: '/optimize [file or code to optimize]', examples: ['"optimize this code"', '"reduce complexity"', '"performans iyileştir"', '"kodu optimize et"'] },
        { id: 'commit', icon: 'commit', invocation: '/commit [optional message]', examples: ['"commit changes"', '"commit and push"', '"commitle"', '"pushla"', '"commit at"'] },
        { id: 'jira-api', icon: 'task_alt', invocation: '/jira-api [Jira issue key]', examples: ['"download jira attachment"', '"jira resmini indir"', '"jira taskindaki resimleri goster"'] },
        { id: 's3-download', icon: 'cloud_download', invocation: '/s3-download [S3 operation description]', examples: ['"create attachment endpoint"', '"add S3 upload"', '"write file download endpoint"', '"get S3 signed URL"'] },
        { id: 'playwright', icon: 'play_circle', invocation: '/playwright [test description]', examples: ['"playwright test yaz"', '"e2e test"', '"run playwright"', '"UI test ekle"'] },
        { id: 'fullstack-scaffold', icon: 'rocket_launch', invocation: '/fullstack-scaffold [project name and description]', examples: ['"create fullstack project"', '"yeni fullstack proje"', '"scaffold full project"'] },
        { id: 'nodejs-backend-scaffold', icon: 'dns', invocation: '/nodejs-backend-scaffold [project name]', examples: ['"create new backend project"', '"yeni backend projesi olustur"', '"scaffold new project"'] },
        { id: 'nextjs-frontend-scaffold', icon: 'dashboard', invocation: '/nextjs-frontend-scaffold [project name]', examples: ['"create new frontend project"', '"yeni frontend projesi olustur"', '"scaffold frontend"'] }
    ],

    _i18n: {
        en: {
            'analyze': { subtitle: 'Code Quality & Performance Analysis', description: 'Read-only code audit with Big-O complexity analysis, anti-pattern detection, good pattern highlights, and a scoreboard. Works on any project — does not modify code.', triggers: ['Requests to analyze a file or folder', 'Performance review or complexity analysis', 'Code quality reports'], autoTrigger: 'Auto-detected on phrases like "analyze this file", "analyze src/", "review performance".' },
            'code-review': { subtitle: 'Coding Standards Review', description: 'Code review based on coding standards. Checks naming conventions, coding practices, file structure, and readability. Detects violations and fixes them.', triggers: ['Code review requests', 'Checking naming conventions', 'Coding standards compliance audits'], autoTrigger: 'Auto-detected on phrases like "review this code", "check naming conventions", "review my changes".' },
            'optimize': { subtitle: 'Code Performance Optimization', description: 'Finds and fixes performance issues. Reduces O(n²) to O(n), eliminates redundant loops, optimizes database queries, uses Map/Set lookups, and batch operations.', triggers: ['Code optimization requests', 'Performance improvement', 'Complexity reduction (Big-O)'], autoTrigger: 'Auto-detected on phrases like "optimize this code", "reduce complexity".' },
            'commit': { subtitle: 'Git Commit Workflow', description: 'Smart commit with auto-pull, stash handling, conflict detection, logical commit splitting, and optional CHANGELOG/README updates.', triggers: ['Phrases like "commitle", "pushla", "commit at", "commit and push"', 'Git commit or push requests'], autoTrigger: 'Auto-detected on phrases like "commit changes", "commit and push", "commitle", "pushla".' },
            'jira-api': { subtitle: 'Jira API & Task Workflow', description: 'Downloads attachments (images/PDFs) from Jira issues and automates task workflows. Manages status transitions (Draft → To Do → In Progress → In Test → Done).', triggers: ['Downloading Jira attachments or images', 'Taking/assigning Jira tasks', 'Managing Jira issue status transitions'], autoTrigger: 'Auto-detected on Jira issue keys or phrases like "download jira attachment".' },
            's3-download': { subtitle: 'S3 File Operations', description: 'Upload, download, delete, signed URL, and attachment controller/router/middleware/service creation. Prevents the wrong axios pattern by using direct S3 streams.', triggers: ['Creating file upload/download endpoints', 'Generating S3 signed URLs', 'Adding attachment CRUD endpoints'], autoTrigger: 'Auto-detected on phrases like "create attachment endpoint", "add S3 upload", "write file download endpoint".' },
            'playwright': { subtitle: 'Playwright E2E Testing', description: 'Writes, runs, and debugs Playwright end-to-end tests. Covers multi-resolution testing (FHD + 2K), test structure, viewport config, credentials setup, and execution commands.', triggers: ['Writing E2E or UI tests', 'Running or debugging Playwright tests', 'Setting up test infrastructure'], autoTrigger: 'Auto-detected on phrases like "playwright test yaz", "e2e test", "run playwright", "UI test".' },
            'fullstack-scaffold': { subtitle: 'Full-Stack Project Scaffold', description: 'Creates a full-stack project (backend + frontend) in one command. Scaffolds both a Node.js Express backend and Next.js frontend with matching architecture, routes, and naming conventions.', triggers: ['Creating a new full-stack project from scratch', 'Scaffolding both backend and frontend together'], autoTrigger: 'Auto-detected on phrases like "create fullstack project", "yeni fullstack proje", "scaffold full project".' },
            'nodejs-backend-scaffold': { subtitle: 'Node.js Backend Project Scaffold', description: 'Creates a new Node.js backend project from scratch — Express, Sequelize, PostgreSQL, Repository pattern, layered architecture (Router → Controller → Service → Repository → Model).', triggers: ['Creating a new backend project from scratch', 'Scaffolding a Node.js API server'], autoTrigger: 'Auto-detected on phrases like "create new backend project", "yeni backend projesi olustur".' },
            'nextjs-frontend-scaffold': { subtitle: 'Next.js Frontend Project Scaffold', description: 'Creates a new Next.js frontend project from scratch — MUI v5, React Query, Redux Toolkit, Axios with token refresh, CASL ACL, custom components (CustomTextField, GridTable, OptionsMenu, DialogConfirm).', triggers: ['Creating a new frontend project from scratch', 'Scaffolding a Next.js application'], autoTrigger: 'Auto-detected on phrases like "create new frontend project", "yeni frontend projesi olustur".' }
        },
        tr: {
            'analyze': { subtitle: 'Kod Kalitesi ve Performans Analizi', description: 'Salt okunur kod denetimi. Big-O karmaşıklık analizi, anti-pattern tespiti, iyi pattern\'lerin vurgulanması ve skor tablosu. Her projede çalışır, kod değiştirmez.', triggers: ['Bir dosya veya klasörün analiz edilmesi isteği', 'Performans incelemesi veya karmaşıklık analizi', 'Kod kalitesi raporu'], autoTrigger: '"analyze this file", "analiz et", "kodu analiz et", "review performance" gibi ifadelerde otomatik algılanır.' },
            'code-review': { subtitle: 'Kodlama Standartları İncelemesi', description: 'Kodlama standartlarına göre kod incelemesi yapar. İsimlendirme kuralları, kodlama pratikleri, dosya yapısı ve okunabilirlik kontrolleri. İhlalleri tespit eder ve düzeltir.', triggers: ['Kod incelemesi veya review isteği', 'İsimlendirme kurallarının kontrolü', 'Kodlama standartlarına uygunluk denetimi'], autoTrigger: '"review this code", "check naming conventions", "review my changes", "kod kontrolu yap" gibi ifadelerde otomatik algılanır.' },
            'optimize': { subtitle: 'Kod Performans Optimizasyonu', description: 'Performans sorunlarını bulur ve düzeltir. O(n²)\'yi O(n)\'ye indirgeme, gereksiz döngüleri ortadan kaldırma, veritabanı sorgularını optimize etme, Map/Set kullanımı ve toplu işlemler.', triggers: ['Kod optimizasyonu isteği', 'Performans iyileştirme', 'Karmaşıklık azaltma (Big-O)'], autoTrigger: '"optimize this code", "reduce complexity", "performans iyileştir", "kodu optimize et" gibi ifadelerde otomatik algılanır.' },
            'commit': { subtitle: 'Git Commit İş Akışı', description: 'Otomatik pull, stash yönetimi, conflict algılama, mantıksal commit bölme ve opsiyonel CHANGELOG/README güncellemesi ile akıllı commit sistemi.', triggers: ['"commitle", "pushla", "commit at", "commit and push" gibi ifadeler', 'Git commit veya push isteği'], autoTrigger: '"commit changes", "commit and push", "commitle", "pushla" gibi ifadelerde otomatik algılanır.' },
            'jira-api': { subtitle: 'Jira API ve Görev İş Akışı', description: 'Jira issue\'lardan eklentileri (resim/PDF) indirir ve görev iş akışlarını otomatikleştirir. Durum geçişlerini yönetir (Draft → To Do → In Progress → In Test → Done).', triggers: ['Jira eklentilerini veya resimlerini indirme', 'Jira görevlerini alma/atama', 'Jira issue durum geçişlerini yönetme'], autoTrigger: 'Jira issue anahtarlarında veya "download jira attachment" gibi ifadelerde otomatik algılanır.' },
            's3-download': { subtitle: 'S3 Dosya İşlemleri', description: 'Upload, download, delete, signed URL ve attachment controller/router/middleware/service oluşturma. Doğrudan S3 stream kullanarak yanlış axios pattern\'ini önler.', triggers: ['Dosya upload/download endpoint\'i oluşturma', 'S3 signed URL oluşturma', 'Attachment CRUD endpoint\'i ekleme'], autoTrigger: '"create attachment endpoint", "add S3 upload", "write file download endpoint" gibi ifadelerde otomatik algılanır.' },
            'playwright': { subtitle: 'Playwright E2E Test', description: 'Playwright uçtan uca testleri yazar, çalıştırır ve hata ayıklar. Çoklu çözünürlük testi (FHD + 2K), test yapısı, viewport ayarı, kimlik bilgileri kurulumu ve çalıştırma komutlarını kapsar.', triggers: ['E2E veya UI testi yazma', 'Playwright testlerini çalıştırma veya hata ayıklama', 'Test altyapısı kurulumu'], autoTrigger: '"playwright test yaz", "e2e test", "run playwright", "UI test" gibi ifadelerde otomatik algılanır.' },
            'fullstack-scaffold': { subtitle: 'Full-Stack Proje İskeleti', description: 'Tek komutla full-stack proje (backend + frontend) oluşturur. Eşleşen mimari, route ve adlandırma kurallarıyla hem Node.js Express backend hem Next.js frontend iskeletler.', triggers: ['Sıfırdan yeni bir full-stack proje oluşturma', 'Backend ve frontend birlikte iskeleme'], autoTrigger: '"create fullstack project", "yeni fullstack proje", "scaffold full project" gibi ifadelerde otomatik algılanır.' },
            'nodejs-backend-scaffold': { subtitle: 'Node.js Backend Proje İskeleti', description: 'Sıfırdan Node.js backend projesi oluşturur — Express, Sequelize, PostgreSQL, Repository pattern, katmanlı mimari (Router → Controller → Service → Repository → Model).', triggers: ['Sıfırdan yeni bir backend proje oluşturma', 'Node.js API sunucusu iskeleme'], autoTrigger: '"create new backend project", "yeni backend projesi olustur" gibi ifadelerde otomatik algılanır.' },
            'nextjs-frontend-scaffold': { subtitle: 'Next.js Frontend Proje İskeleti', description: 'Sıfırdan Next.js frontend projesi oluşturur — MUI v5, React Query, Redux Toolkit, token yenilemeli Axios, CASL ACL, özel bileşenler (CustomTextField, GridTable, OptionsMenu, DialogConfirm).', triggers: ['Sıfırdan yeni bir frontend proje oluşturma', 'Next.js uygulaması iskeleme'], autoTrigger: '"create new frontend project", "yeni frontend projesi olustur" gibi ifadelerde otomatik algılanır.' }
        }
    },

    _getSkillData: function () {
        var lang = (Bridge._langCode || 'en').toLowerCase();
        var langKey = lang.indexOf('tr') === 0 ? 'tr' : 'en';
        var texts = this._i18n[langKey];
        var defs = this._skillDefs;
        var result = [];

        for (var i = 0; i < defs.length; i++) {
            var d = defs[i];
            var t = texts[d.id] || {};
            result.push({
                id: d.id,
                icon: d.icon,
                title: d.id,
                subtitle: t.subtitle || '',
                description: t.description || '',
                triggers: t.triggers || [],
                invocation: d.invocation,
                autoTrigger: t.autoTrigger || '',
                examples: d.examples
            });
        }

        return result;
    },

    _buildChapters: function () {
        var skills = this._getSkillData();
        var t = this._t || this._copy();
        var chapters = [];

        for (var i = 0; i < skills.length; i++) {
            var s = skills[i];
            var bodyHtml = '';

            // Subtitle
            bodyHtml += '<p class="bp-skill-subtitle">' + this._escapeHtml(s.subtitle) + '</p>';

            // Description
            bodyHtml += '<h3>' + this._escapeHtml(t.hWhatDoesItDo) + '</h3>';
            bodyHtml += '<p>' + this._escapeHtml(s.description) + '</p>';

            // Triggers
            bodyHtml += '<h3>' + this._escapeHtml(t.hWhenTriggered) + '</h3>';
            bodyHtml += '<ul>';
            for (var j = 0; j < s.triggers.length; j++) {
                bodyHtml += '<li>' + this._escapeHtml(s.triggers[j]) + '</li>';
            }
            bodyHtml += '</ul>';

            // Auto trigger
            bodyHtml += '<h3>' + this._escapeHtml(t.hAutoDetection) + '</h3>';
            bodyHtml += '<p>' + this._escapeHtml(s.autoTrigger) + '</p>';

            // Direct invocation
            bodyHtml += '<h3>' + this._escapeHtml(t.hDirectInvocation) + '</h3>';
            bodyHtml += '<pre><code>' + this._escapeHtml(s.invocation) + '</code></pre>';

            // Examples
            bodyHtml += '<h3>' + this._escapeHtml(t.hExamples) + '</h3>';
            bodyHtml += '<div class="bp-skill-examples">';
            for (var e = 0; e < s.examples.length; e++) {
                bodyHtml += '<span class="bp-skill-example-tag">' + this._escapeHtml(s.examples[e]) + '</span>';
            }
            bodyHtml += '</div>';

            var searchable = [s.id, s.title, s.subtitle, s.description, s.autoTrigger, s.invocation]
                .concat(s.triggers)
                .concat(s.examples)
                .join(' ').toLowerCase().replace(/\s+/g, ' ').trim();

            chapters.push({
                num: i + 1,
                icon: s.icon,
                title: s.title,
                bodyHtml: bodyHtml,
                searchableText: searchable,
                sections: []
            });
        }

        return chapters;
    },

    _renderChapterHtml: function (chapter) {
        return '<div class="bp-chapter" id="bp-ch-' + chapter.num + '">' +
            '<div class="bp-chapter-header">' +
                '<span class="bp-chapter-number">' + chapter.num + '</span>' +
                '<span class="mi bp-chapter-icon">' + chapter.icon + '</span>' +
                '<span class="bp-chapter-title">' + this._escapeHtml(chapter.title) + '</span>' +
            '</div>' +
            '<div class="bp-chapter-body">' + chapter.bodyHtml + '</div>' +
        '</div>';
    },

    render: function () {
        var t = this._copy();
        this._currentPage = 0;
        this._chapters = [];
        this._tocExpanded = {};
        this._t = t;

        return '' +
        '<div class="subpage-layout">' +
            '<div class="card bp-page-card subpage-card">' +
                '<div class="card-title">' +
                    '<span class="mi">extension</span>' +
                    t.title +
                '</div>' +
                '<div class="subpage-scroll bp-shell">' +
                    '<div class="bp-content">' +
                        '<div class="bp-toc-sidebar" id="bp-toc-sidebar">' +
                            '<div class="bp-search-box">' +
                                '<span class="mi">search</span>' +
                                '<input type="text" class="bp-search-input" id="bp-search" placeholder="' + t.searchPlaceholder + '">' +
                            '</div>' +
                            '<div class="bp-toc-header">' +
                                '<span class="bp-toc-title">' + t.tocTitle + '</span>' +
                            '</div>' +
                            '<ul class="bp-toc-list" id="bp-toc-list"></ul>' +
                        '</div>' +
                        '<div class="bp-main">' +
                            '<div class="bp-main-scroll" id="bp-main-scroll">' +
                                '<div class="loading-container" id="bp-loading">' +
                                    '<div class="loading-text">' + (Bridge.lang('CommonLoading') || 'Loading...') + '</div>' +
                                '</div>' +
                                '<div id="bp-search-results" style="display:none"></div>' +
                                '<div id="bp-chapter-view" style="display:none"></div>' +
                                '<div class="bp-no-result" id="bp-no-result" style="display:none">' + t.noResult + '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="bp-page-actions subpage-footer" id="bp-page-nav" style="display:none">' +
                '<div class="bp-page-actions-side bp-page-actions-left"></div>' +
                '<div class="bp-page-actions-center">' +
                    '<button class="bp-page-nav-btn" id="bp-prev"><span class="mi">navigate_before</span>' + t.prevPage + '</button>' +
                    '<span class="bp-page-indicator" id="bp-page-indicator"></span>' +
                    '<button class="bp-page-nav-btn" id="bp-next">' + t.nextPage + '<span class="mi">navigate_next</span></button>' +
                '</div>' +
                '<div class="bp-page-actions-side bp-page-actions-right"></div>' +
            '</div>' +
        '</div>';
    },

    afterRender: function () {
        var self = this;
        var t = this._t;
        var tocSidebar = document.getElementById('bp-toc-sidebar');
        var tocList = document.getElementById('bp-toc-list');
        var searchInput = document.getElementById('bp-search');
        var loading = document.getElementById('bp-loading');
        var chapterView = document.getElementById('bp-chapter-view');
        var searchResults = document.getElementById('bp-search-results');
        var noResult = document.getElementById('bp-no-result');
        var mainScroll = document.getElementById('bp-main-scroll');
        var pageNav = document.getElementById('bp-page-nav');
        var prevBtn = document.getElementById('bp-prev');
        var nextBtn = document.getElementById('bp-next');
        var indicator = document.getElementById('bp-page-indicator');

        var chapters = self._buildChapters();
        self._chapters = chapters;
        var currentPage = 0;

        function renderToc(activeIndex) {
            var html = '';
            for (var i = 0; i < chapters.length; i++) {
                var ch = chapters[i];
                var activeClass = i === activeIndex ? ' active' : '';
                html += '<li class="bp-toc-item">' +
                    '<div class="bp-toc-row">' +
                        '<a class="bp-toc-link' + activeClass + '" data-page="' + i + '">' +
                            '<span class="bp-toc-num">' + ch.num + '</span>' +
                            '<span>' + self._escapeHtml(ch.title) + '</span>' +
                        '</a>' +
                    '</div>' +
                '</li>';
            }
            tocList.innerHTML = html;
        }

        function showPage(index) {
            if (index < 0 || index >= chapters.length) return;
            currentPage = index;
            self._currentPage = index;

            chapterView.innerHTML = self._renderChapterHtml(chapters[index]);
            chapterView.style.display = '';
            searchResults.style.display = 'none';
            noResult.style.display = 'none';
            pageNav.style.display = '';

            prevBtn.disabled = index === 0;
            nextBtn.disabled = index === chapters.length - 1;
            indicator.textContent = (index + 1) + ' / ' + chapters.length;
            renderToc(index);

            if (mainScroll) {
                mainScroll.scrollTop = 0;
            }
        }

        function showSearchResults(query) {
            var q = (query || '').toLowerCase().trim();
            if (!q) {
                showPage(currentPage);
                return;
            }

            var matches = [];
            for (var i = 0; i < chapters.length; i++) {
                if (chapters[i].searchableText.indexOf(q) >= 0) {
                    matches.push(i);
                }
            }

            chapterView.style.display = 'none';
            pageNav.style.display = 'none';

            if (matches.length === 0) {
                searchResults.style.display = 'none';
                noResult.style.display = '';
                return;
            }

            noResult.style.display = 'none';
            renderToc(-1);
            if (mainScroll) mainScroll.scrollTop = 0;

            var html = '<div class="bp-search-results-header">' +
                '<span class="mi">search</span>' +
                '<span>' + t.searchResultsTitle + ' \u00b7 ' + matches.length + t.searchResultCount + '</span>' +
            '</div><div class="bp-search-results-list">';

            for (var j = 0; j < matches.length; j++) {
                var ch = chapters[matches[j]];
                var plainText = ch.searchableText;
                var matchIdx = plainText.indexOf(q);
                var snippetStart = Math.max(0, matchIdx - 40);
                var snippetEnd = Math.min(plainText.length, matchIdx + q.length + 70);
                var snippet = (snippetStart > 0 ? '...' : '') +
                    self._escapeHtml(plainText.substring(snippetStart, matchIdx)) +
                    '<mark>' + self._escapeHtml(plainText.substring(matchIdx, matchIdx + q.length)) + '</mark>' +
                    self._escapeHtml(plainText.substring(matchIdx + q.length, snippetEnd)) +
                    (snippetEnd < plainText.length ? '...' : '');

                html += '<div class="bp-search-result-item" data-page="' + matches[j] + '">' +
                    '<div class="bp-search-result-item-header">' +
                        '<span class="bp-chapter-number">' + ch.num + '</span>' +
                        '<span class="mi bp-chapter-icon">' + ch.icon + '</span>' +
                        '<span class="bp-search-result-title">' + self._escapeHtml(ch.title) + '</span>' +
                    '</div>' +
                    '<div class="bp-search-result-snippet">' + snippet + '</div>' +
                '</div>';
            }

            html += '</div>';
            searchResults.innerHTML = html;
            searchResults.style.display = '';
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                if (currentPage > 0) {
                    if (searchInput) searchInput.value = '';
                    showPage(currentPage - 1);
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                if (currentPage < chapters.length - 1) {
                    if (searchInput) searchInput.value = '';
                    showPage(currentPage + 1);
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', function () {
                showSearchResults(this.value);
            });
        }

        if (tocList) {
            tocList.addEventListener('click', function (e) {
                var target = e.target;
                while (target && target !== tocList) {
                    if (target.classList && target.classList.contains('bp-toc-link')) {
                        e.preventDefault();
                        var pageIdx = parseInt(target.getAttribute('data-page'), 10);
                        if (!isNaN(pageIdx)) {
                            if (searchInput) searchInput.value = '';
                            showPage(pageIdx);
                        }
                        return;
                    }
                    target = target.parentElement;
                }
            });
        }

        if (searchResults) {
            searchResults.addEventListener('click', function (e) {
                var target = e.target;
                while (target && target !== searchResults) {
                    if (target.classList && target.classList.contains('bp-search-result-item')) {
                        var pageIdx = parseInt(target.getAttribute('data-page'), 10);
                        if (!isNaN(pageIdx)) {
                            if (searchInput) searchInput.value = '';
                            showPage(pageIdx);
                        }
                        return;
                    }
                    target = target.parentElement;
                }
            });
        }

        // No async loading needed — data is built in memory
        if (loading) loading.style.display = 'none';

        if (!chapters.length) {
            chapterView.style.display = 'none';
            searchResults.style.display = 'none';
            pageNav.style.display = 'none';
            noResult.textContent = t.loadFailed;
            noResult.style.display = '';
            return;
        }

        if (tocSidebar) tocSidebar.classList.add('open');
        chapterView.style.display = '';
        showPage(0);
    }
};
