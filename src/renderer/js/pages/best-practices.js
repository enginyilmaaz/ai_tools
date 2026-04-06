// Claude Best Practices Page
window.BestPracticesPage = {
    _currentPage: 0,
    _chapters: null,
    _tocExpanded: null,
    _t: null,

    _copy: function () {
        var L = Bridge.lang.bind(Bridge);
        return {
            title: L('BestPracticesTitle') || 'Claude Best Practices',
            searchPlaceholder: L('BestPracticesSearchPlaceholder') || 'Search best practices...',
            tocTitle: L('BestPracticesTocTitle') || 'Contents',
            noResult: L('BestPracticesNoResult') || 'No results found for your search.',
            prevPage: L('BestPracticesPrevPage') || 'Previous',
            nextPage: L('BestPracticesNextPage') || 'Next',
            searchResultsTitle: L('BestPracticesSearchResultsTitle') || 'Search Results',
            searchResultCount: L('BestPracticesSearchResultCount') || ' results found',
            loadFailed: L('BestPracticesLoadFailed') || 'Best practices content could not be loaded.',
            downloadPdf: L('BestPracticesDownloadPdf') || 'Download PDF',
            openInBrowser: L('BestPracticesOpenInBrowser') || 'Open in Browser'
        };
    },

    _getSourcePath: function () {
        var lang = (Bridge._langCode || 'en').toLowerCase();
        if (lang.indexOf('tr') === 0) {
            return 'docs/claude-code-best-practices-tr.html';
        }
        return 'docs/claude-code-best-practices-en.html';
    },

    _escapeHtml: function (value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    _stripPageBreakClass: function (root) {
        if (!root) return;
        if (root.classList && root.classList.contains('page-break')) {
            root.classList.remove('page-break');
        }
        var pageBreakEls = root.querySelectorAll ? root.querySelectorAll('.page-break') : [];
        for (var i = 0; i < pageBreakEls.length; i++) {
            pageBreakEls[i].classList.remove('page-break');
        }
    },

    _parseChaptersFromHtml: function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html || '', 'text/html');
        var h2List = doc.querySelectorAll('h2');
        var chapters = [];

        for (var i = 0; i < h2List.length; i++) {
            var h2 = h2List[i];
            var title = (h2.textContent || '').trim();
            if (!title) continue;

            var normalizedTitle = title.toLowerCase();
            if (normalizedTitle === 'table of contents' || normalizedTitle === 'içindekiler') {
                continue;
            }

            var chapterNumberMatch = title.match(/^(\d+)\./);
            var chapterNumber = chapterNumberMatch
                ? parseInt(chapterNumberMatch[1], 10)
                : (chapters.length + 1);

            var bodyParts = [];
            var searchable = title;
            var sections = [];
            var sectionCount = 0;
            var node = h2.nextSibling;

            while (node) {
                if (node.nodeType === 1 && node.tagName && node.tagName.toLowerCase() === 'h2') {
                    break;
                }

                if (node.nodeType === 1) {
                    var tagName = node.tagName.toLowerCase();
                    var className = node.className || '';
                    var isDocMetaBlock = className.indexOf('cover') >= 0 ||
                        className.indexOf('toc') >= 0 ||
                        className.indexOf('doc-footer') >= 0;

                    if (tagName !== 'style' && tagName !== 'script' && !isDocMetaBlock) {
                        var clone = node.cloneNode(true);
                        this._stripPageBreakClass(clone);
                        if (tagName === 'h3') {
                            sectionCount += 1;
                            var rawSectionTitle = (clone.textContent || '').trim();
                            var sectionMatch = rawSectionTitle.match(/^(\d+\.\d+)\s*(.*)$/);
                            var sectionNum = sectionMatch && sectionMatch[1]
                                ? sectionMatch[1]
                                : (chapterNumber + '.' + sectionCount);
                            var sectionTitle = sectionMatch && sectionMatch[2]
                                ? sectionMatch[2].trim()
                                : rawSectionTitle;
                            var sectionId = 'bp-sec-' + chapterNumber + '-' + sectionCount;

                            clone.setAttribute('id', sectionId);
                            sections.push({
                                id: sectionId,
                                num: sectionNum,
                                title: sectionTitle || rawSectionTitle
                            });
                        }
                        bodyParts.push(clone.outerHTML);
                        searchable += ' ' + (clone.textContent || '');
                    }
                } else if (node.nodeType === 3) {
                    var textNode = (node.textContent || '').trim();
                    if (textNode) {
                        bodyParts.push('<p>' + this._escapeHtml(textNode) + '</p>');
                        searchable += ' ' + textNode;
                    }
                }

                node = node.nextSibling;
            }

            if (bodyParts.length === 0) {
                continue;
            }

            chapters.push({
                num: chapterNumber,
                icon: 'menu_book',
                title: title,
                bodyHtml: bodyParts.join(''),
                searchableText: searchable.toLowerCase().replace(/\s+/g, ' ').trim(),
                sections: sections
            });
        }

        return chapters;
    },

    _loadChapters: function () {
        var self = this;
        var path = self._getSourcePath();

        return fetch(path)
            .then(function (res) {
                if (!res.ok) {
                    throw new Error('Failed to load: ' + path + ' (' + res.status + ')');
                }
                return res.text();
            })
            .then(function (html) {
                return self._parseChaptersFromHtml(html);
            });
    },

    _renderChapterHtml: function (chapter) {
        return '<div class="bp-chapter" id="bp-ch-' + chapter.num + '">' +
            '<div class="bp-chapter-header">' +
                '<span class="bp-chapter-number">' + chapter.num + '</span>' +
                '<span class="mi bp-chapter-icon">' + chapter.icon + '</span>' +
                '<span class="bp-chapter-title">' + chapter.title + '</span>' +
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
                    '<span class="mi">menu_book</span>' +
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
                '<div class="bp-page-actions-side bp-page-actions-left">' +
                    '<button class="bp-page-nav-btn bp-page-action-btn" id="bp-download-pdf"><span class="mi">download</span>' + t.downloadPdf + '</button>' +
                '</div>' +
                '<div class="bp-page-actions-center">' +
                    '<button class="bp-page-nav-btn" id="bp-prev"><span class="mi">navigate_before</span>' + t.prevPage + '</button>' +
                    '<span class="bp-page-indicator" id="bp-page-indicator"></span>' +
                    '<button class="bp-page-nav-btn" id="bp-next">' + t.nextPage + '<span class="mi">navigate_next</span></button>' +
                '</div>' +
                '<div class="bp-page-actions-side bp-page-actions-right">' +
                    '<button class="bp-page-nav-btn bp-page-action-btn" id="bp-open-browser">' + t.openInBrowser + '<span class="mi">open_in_new</span></button>' +
                '</div>' +
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
        var downloadPdfBtn = document.getElementById('bp-download-pdf');
        var openBrowserBtn = document.getElementById('bp-open-browser');

        var chapters = [];
        var currentPage = 0;
        var currentAnchorId = null;

        function applyDefaultExpanded(activeIndex) {
            self._tocExpanded = {};
            for (var i = 0; i < chapters.length; i++) {
                var hasSections = chapters[i] && chapters[i].sections && chapters[i].sections.length > 0;
                if (hasSections) {
                    self._tocExpanded[i] = i === activeIndex;
                }
            }
        }

        function renderToc(activeIndex, activeAnchorId) {
            var html = '';
            for (var i = 0; i < chapters.length; i++) {
                var ch = chapters[i];
                var sections = ch.sections || [];
                var hasSections = sections.length > 0;
                var expanded = hasSections && self._tocExpanded && self._tocExpanded[i] === true;
                var activeClass = i === activeIndex ? ' active' : '';
                html += '<li class="bp-toc-item' + (expanded ? ' expanded' : '') + '">' +
                    '<div class="bp-toc-row">' +
                        '<a class="bp-toc-link' + activeClass + '" data-page="' + i + '">' +
                            '<span class="bp-toc-num">' + ch.num + '</span>' +
                            '<span>' + self._escapeHtml(ch.title) + '</span>' +
                        '</a>';

                if (hasSections) {
                    html += '<button type="button" class="bp-toc-toggle' + (expanded ? ' expanded' : '') + '" data-page-toggle="' + i + '" aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
                        '<span class="bp-toc-toggle-symbol">' + (expanded ? '-' : '+') + '</span>' +
                    '</button>';
                }

                html += '</div>';

                if (hasSections) {
                    html += '<ul class="bp-toc-sub-list' + (expanded ? '' : ' hidden') + '">';
                    for (var s = 0; s < sections.length; s++) {
                        var sec = sections[s];
                        var subActiveClass = (i === activeIndex && activeAnchorId && activeAnchorId === sec.id) ? ' active' : '';
                        html += '<li class="bp-toc-sub-row"><a class="bp-toc-link bp-toc-link-sub' + subActiveClass + '" data-page="' + i + '" data-anchor="' + sec.id + '">' +
                            '<span class="bp-toc-sub-num">' + self._escapeHtml(sec.num) + '</span>' +
                            '<span>' + self._escapeHtml(sec.title) + '</span>' +
                        '</a></li>';
                    }
                    html += '</ul>';
                }

                html += '</li>';
            }
            tocList.innerHTML = html;
        }

        function showPage(index, anchorId) {
            if (index < 0 || index >= chapters.length) return;
            currentPage = index;
            self._currentPage = index;
            currentAnchorId = anchorId || null;

            chapterView.innerHTML = self._renderChapterHtml(chapters[index]);
            chapterView.style.display = '';
            searchResults.style.display = 'none';
            noResult.style.display = 'none';
            pageNav.style.display = '';

            prevBtn.disabled = index === 0;
            nextBtn.disabled = index === chapters.length - 1;
            indicator.textContent = (index + 1) + ' / ' + chapters.length;
            applyDefaultExpanded(index);
            renderToc(index, currentAnchorId);

            if (mainScroll) {
                mainScroll.scrollTop = 0;
            } else {
                var pageContainer = document.getElementById('page-container');
                if (pageContainer) pageContainer.scrollTop = 0;
            }

            if (anchorId) {
                var anchorEl = chapterView.querySelector('#' + anchorId);
                if (anchorEl && anchorEl.scrollIntoView) {
                    anchorEl.scrollIntoView({ block: 'start' });
                }
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
            currentAnchorId = null;
            renderToc(-1, null);
            if (mainScroll) {
                mainScroll.scrollTop = 0;
            }

            var html = '<div class="bp-search-results-header">' +
                '<span class="mi">search</span>' +
                '<span>' + t.searchResultsTitle + ' · ' + matches.length + t.searchResultCount + '</span>' +
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
                        '<span class="mi bp-chapter-icon">menu_book</span>' +
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

        if (downloadPdfBtn) {
            downloadPdfBtn.addEventListener('click', function () {
                Bridge.send('downloadBestPracticesPdf', { lang: Bridge._langCode || 'en' });
            });
        }

        if (openBrowserBtn) {
            openBrowserBtn.addEventListener('click', function () {
                Bridge.send('openBestPracticesInBrowser', { lang: Bridge._langCode || 'en' });
            });
        }

        if (tocList) {
            tocList.addEventListener('click', function (e) {
                var target = e.target;
                while (target && target !== tocList) {
                    if (target.classList && target.classList.contains('bp-toc-toggle')) {
                        e.preventDefault();
                        var togglePageIdx = parseInt(target.getAttribute('data-page-toggle'), 10);
                        if (!isNaN(togglePageIdx)) {
                            if (!self._tocExpanded) self._tocExpanded = {};
                            self._tocExpanded[togglePageIdx] = !self._tocExpanded[togglePageIdx];
                            renderToc(currentPage, currentAnchorId);
                        }
                        return;
                    }

                    if (target.classList && target.classList.contains('bp-toc-link')) {
                        e.preventDefault();
                        var pageIdx = parseInt(target.getAttribute('data-page'), 10);
                        var anchorId = target.getAttribute('data-anchor');
                        if (!isNaN(pageIdx)) {
                            if (searchInput) searchInput.value = '';
                            showPage(pageIdx, anchorId || null);
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

        self._loadChapters()
            .then(function (loaded) {
                chapters = loaded || [];
                self._chapters = chapters;

                if (loading) loading.style.display = 'none';

                if (!chapters.length) {
                    chapterView.style.display = 'none';
                    searchResults.style.display = 'none';
                    pageNav.style.display = 'none';
                    noResult.textContent = t.loadFailed;
                    noResult.style.display = '';
                    return;
                }

                if (tocSidebar) {
                    tocSidebar.classList.add('open');
                }

                chapterView.style.display = '';
                showPage(0);
            })
            .catch(function () {
                if (loading) loading.style.display = 'none';
                chapterView.style.display = 'none';
                searchResults.style.display = 'none';
                pageNav.style.display = 'none';
                noResult.textContent = t.loadFailed;
                noResult.style.display = '';
            });
    }
};
