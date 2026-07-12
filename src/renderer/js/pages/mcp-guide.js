// MCP & Plugin Guide Page — mirrors SkillUsage architecture exactly
window.McpGuidePage = {
    _currentPage: 0,
    _chapters: null,
    _tocExpanded: null,
    _t: null,

    _copy: function () {
        var L = Bridge.lang.bind(Bridge);
        return {
            title: L('McpGuideTitle') || 'MCP & Plugin Guide',
            searchPlaceholder: L('McpGuideSearchPlaceholder') || 'Search...',
            tocTitle: L('McpGuideTocTitle') || 'Contents',
            noResult: L('McpGuideNoResult') || 'No results found.',
            prevPage: L('McpGuidePrevPage') || 'Previous',
            nextPage: L('McpGuideNextPage') || 'Next',
            searchResultsTitle: L('McpGuideSearchResultsTitle') || 'Search Results',
            searchResultCount: L('McpGuideSearchResultCount') || ' results found',
            loadFailed: L('McpGuideLoadFailed') || 'Content could not be loaded.'
        };
    },

    _escapeHtml: function (v) {
        return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _chapterDefs: [
        { id: 'what-is-mcp', icon: 'hub' },
        { id: 'superpowers', icon: 'bolt' },
        { id: 'github', icon: 'code' },
        { id: 'atlassian', icon: 'task_alt' },
        { id: 'figma', icon: 'palette' },
        { id: 'frontend-design', icon: 'web' },
        { id: 'code-review', icon: 'rate_review' },
        { id: 'code-simplifier', icon: 'compress' },
        { id: 'playwright', icon: 'theaters' },
        { id: 'security-guidance', icon: 'security' },
        { id: 'typescript-lsp', icon: 'code' },
        { id: 'postman', icon: 'api' },
        { id: 'context7', icon: 'menu_book' },
        { id: 'sentry', icon: 'bug_report' },
        { id: 'mcp-server-dev', icon: 'developer_board' },
        { id: 'session-report', icon: 'assessment' },
        { id: 'chrome-devtools-mcp', icon: 'travel_explore' },
        { id: 'playground', icon: 'science' },
        { id: 'ralph-loop', icon: 'loop' },
        { id: 'claude-md-management', icon: 'description' },
        { id: 'feature-dev', icon: 'rocket_launch' },
        { id: 'ponytail', icon: 'content_cut' }
    ],

    _i18n: {
        en: {
            'what-is-mcp': { title: 'What are MCP & Plugins?', body: '<p><strong>MCP (Model Context Protocol)</strong> and <strong>Plugins</strong> extend Claude Code with external tool integrations. They let Claude interact with databases, APIs, design tools, and more \u2014 directly from your terminal.</p><h3>Plugins vs MCP Servers</h3><table><tr><th>Feature</th><th>Plugins</th><th>MCP Servers</th></tr><tr><td>Install</td><td><code>claude plugin install</code></td><td><code>claude mcp add --scope user</code></td></tr><tr><td>Auth</td><td>OAuth (automatic)</td><td>Manual credentials or OAuth</td></tr><tr><td>Updates</td><td>Automatic via marketplace</td><td>Manual</td></tr><tr><td>Examples</td><td>GitHub, Figma</td><td>PostgreSQL, Postman, Atlassian</td></tr></table><h3>How Does It Work?</h3><p>When you install a plugin or MCP server, Claude Code gains new capabilities. For example, with PostgreSQL MCP, Claude can run SQL queries directly. With the GitHub plugin, Claude can create pull requests.</p><h3>Key Benefits</h3><ul><li><strong>Direct access</strong> \u2014 Claude reads and writes to external systems without copy-paste</li><li><strong>Context-aware</strong> \u2014 Claude understands your database schema, Jira tickets, Figma designs</li><li><strong>Secure</strong> \u2014 Credentials stay local, never sent to Anthropic</li><li><strong>Composable</strong> \u2014 Use multiple integrations together for complex workflows</li></ul><h3>Commands</h3><table><tr><th>Command</th><th>Description</th></tr><tr><td><code>claude plugin install &lt;name&gt;</code></td><td>Install a plugin</td></tr><tr><td><code>claude plugin list</code></td><td>List installed plugins</td></tr><tr><td><code>claude plugin uninstall &lt;name&gt;</code></td><td>Remove a plugin</td></tr><tr><td><code>claude mcp add --scope user &lt;name&gt;</code></td><td>Add an MCP server for all projects</td></tr><tr><td><code>claude mcp list</code></td><td>List MCP servers</td></tr><tr><td><code>/mcp</code></td><td>Check status & authenticate (inside Claude Code)</td></tr></table><h3>Reference</h3><p><a href="https://code.claude.com/docs/en/mcp" target="_blank">MCP Documentation</a> \u2014 Official Claude Code MCP docs</p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: 'MCP ve Eklentiler, Claude Code\'u harici ara\u00e7 entegrasyonlar\u0131yla geni\u015fletir. Claude\'un veritabanlar\u0131, API\'ler, tasar\u0131m ara\u00e7lar\u0131 ve daha fazlas\u0131 ile do\u011frudan terminalinizden etkile\u015fime ge\u00e7mesini sa\u011flar.' },
            'superpowers': { title: 'Superpowers Plugin', body: '<p>The <strong>Superpowers</strong> plugin enhances Claude Code with advanced capabilities and shortcuts that make complex development tasks easier.</p><h3>What Can You Do?</h3><ul><li>Extended tool usage with enhanced permissions</li><li>Advanced file manipulation and project scaffolding</li><li>Smarter context handling across large codebases</li><li>Power-user shortcuts for common development workflows</li></ul><h3>Installation</h3><pre><code>claude plugin install superpowers@claude-plugins-official</code></pre><h3>Reference</h3><p><a href="https://claude.com/plugins/superpowers" target="_blank">Superpowers Plugin Page</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: 'Superpowers eklentisi, Claude Code\'a geli\u015fmi\u015f yetenekler ve k\u0131sayollar ekler.' },
            'github': { title: 'GitHub Plugin', body: '<p>Connect Claude Code directly to <strong>GitHub</strong> for pull requests, issues, code reviews, and repository management.</p><h3>What Can You Do?</h3><ul><li>Create, review, and merge pull requests</li><li>Create and manage issues</li><li>Browse repository contents and commits</li><li>Add comments to PRs and issues</li><li>Check CI/CD status and workflow runs</li></ul><h3>Setup &amp; Credentials</h3><ol><li>Click <strong>"Install to Claude"</strong> in the MCP Server &amp; Plugin page.</li><li>Open Claude Code and run <code>/mcp</code>.</li><li>Select <strong>github</strong> and click <strong>"Authenticate"</strong>.</li><li>Sign in with your GitHub account in the browser and authorize.</li></ol><p>No API key needed \u2014 GitHub uses <strong>OAuth</strong>.</p><h3>Installation</h3><pre><code>claude plugin install github@claude-plugins-official</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>Show me open PRs in this repo</code></td><td>Lists all open pull requests with titles, authors, and status</td></tr><tr><td><code>Create a PR for my current branch</code></td><td>Creates a pull request with auto-generated title and description</td></tr><tr><td><code>Review PR #42</code></td><td>Reads the diff and provides a code review</td></tr><tr><td><code>Create an issue: login page is broken</code></td><td>Creates a new GitHub issue</td></tr><tr><td><code>What are the failing checks on PR #15?</code></td><td>Shows CI/CD check results and failure reasons</td></tr></table><h3>Reference</h3><p><a href="https://claude.com/plugins/github" target="_blank">GitHub Plugin Page</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>A\u00e7\u0131k PR\'lar\u0131 g\u00f6ster</code> \u2014 T\u00fcm a\u00e7\u0131k PR\'lar\u0131 listeler<br><code>PR olu\u015ftur</code> \u2014 Otomatik ba\u015fl\u0131k ile PR a\u00e7ar<br><code>PR #42\'yi incele</code> \u2014 Kod incelemesi yapar<br><code>Issue olu\u015ftur: login bozuk</code> \u2014 Yeni issue olu\u015fturur' },
            'atlassian': { title: 'Atlassian (Jira) MCP Server', body: '<p>Manage <strong>Jira</strong> issues, sprints, and projects directly from Claude Code.</p><h3>What Can You Do?</h3><ul><li>Create, edit, and delete issues (tasks, stories, bugs)</li><li>Transition issue status (To Do \u2192 In Progress \u2192 Done)</li><li>Add and read comments</li><li>Manage sprints and backlogs</li><li>Search issues with JQL</li><li>Assign issues to team members</li></ul><h3>Setup &amp; Credentials</h3><ol><li>Click <strong>"Install to Claude"</strong> in the MCP Server &amp; Plugin page.</li><li>Open Claude Code and run <code>/mcp</code>.</li><li>Select <strong>atlassian</strong> and click <strong>"Authenticate"</strong>.</li><li>Sign in with your Atlassian account and grant access.</li></ol><p>Uses <strong>OAuth</strong> via a remote Atlassian HTTP MCP server. The app writes the Atlassian MCP entry into your user-level Claude MCP config so it is available across projects. Make sure you have Browse, Create, Edit, Delete, and Transition permissions on your projects.</p><h3>Installation</h3><pre><code>claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v1/mcp</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>Show my open tickets in PROJ project</code></td><td>Queries JQL: project = PROJ AND assignee = currentUser()</td></tr><tr><td><code>Create a bug: payment calculation is wrong</code></td><td>Creates a Bug issue in the project</td></tr><tr><td><code>Move PROJ-123 to In Progress</code></td><td>Transitions the issue status</td></tr><tr><td><code>Add comment to PROJ-456: fixed in abc123</code></td><td>Adds a comment to the issue</td></tr><tr><td><code>What\'s in the current sprint?</code></td><td>Lists all issues in the active sprint</td></tr><tr><td><code>Assign PROJ-789 to John</code></td><td>Updates the assignee field</td></tr></table><h3>Reference</h3><p><a href="https://mcp.atlassian.com/v1/mcp" target="_blank">Atlassian MCP Endpoint</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>PROJ\'deki a\u00e7\u0131k ticket\'lar\u0131m</code> \u2014 JQL ile listeler<br><code>Bug olu\u015ftur: \u00f6deme yanl\u0131\u015f</code> \u2014 Bug issue olu\u015fturur<br><code>PROJ-123 In Progress\'e</code> \u2014 Durumu de\u011fi\u015ftirir<br><code>Sprintte ne var?</code> \u2014 Aktif sprint listeler' },
            'figma': { title: 'Figma Plugin', body: '<p>Access <strong>Figma</strong> design files, components, and styles from Claude Code.</p><h3>What Can You Do?</h3><ul><li>Browse design files and pages</li><li>Inspect component properties and styles</li><li>Extract colors, fonts, spacing values</li><li>Generate CSS/code from design specs</li><li>Compare design with implementation</li></ul><h3>Setup &amp; Credentials</h3><ol><li>Click <strong>"Install to Claude"</strong> in the MCP Server &amp; Plugin page.</li><li>Open Claude Code and run <code>/mcp</code>.</li><li>Select <strong>figma</strong> and click <strong>"Authenticate"</strong>.</li><li>Sign in with your Figma account in the browser and authorize.</li></ol><p>No API key needed \u2014 Figma uses <strong>OAuth</strong>.</p><h3>Installation</h3><pre><code>claude plugin install figma@claude-plugins-official</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>Show components in the Design System file</code></td><td>Lists all components with their properties</td></tr><tr><td><code>What colors are used in the login page?</code></td><td>Extracts all color values from the frame</td></tr><tr><td><code>Generate CSS for the card component</code></td><td>Inspects and generates matching CSS</td></tr><tr><td><code>What font sizes are used?</code></td><td>Scans text styles and lists all fonts</td></tr></table><h3>Reference</h3><p><a href="https://claude.com/plugins/figma" target="_blank">Figma Plugin Page</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>Bile\u015fenleri g\u00f6ster</code> \u2014 Listeler<br><code>Hangi renkler var?</code> \u2014 Renk de\u011ferlerini \u00e7\u0131kar\u0131r<br><code>Card i\u00e7in CSS olu\u015ftur</code> \u2014 CSS \u00fcretir' },
            'frontend-design': { title: 'Frontend Design Plugin', body: '<p>The <strong>Frontend Design</strong> plugin assists with UI/UX design tasks.</p><h3>What Can You Do?</h3><ul><li>Generate UI component code from descriptions</li><li>Create responsive layouts and design systems</li><li>Suggest color palettes, typography, and spacing</li><li>Convert design mockups to HTML/CSS/React code</li><li>Review UI accessibility and best practices</li></ul><h3>Installation</h3><pre><code>claude plugin install frontend-design@claude-plugins-official</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>Create a pricing card component</code></td><td>Generates a responsive pricing card with HTML/CSS</td></tr><tr><td><code>Make this form mobile-friendly</code></td><td>Adds responsive breakpoints and touch targets</td></tr><tr><td><code>Suggest a color scheme for a maritime app</code></td><td>Proposes a palette with primary, secondary, accent colors</td></tr></table><h3>Reference</h3><p><a href="https://claude.com/plugins/frontend-design" target="_blank">Frontend Design Plugin Page</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>Fiyat kart\u0131 olu\u015ftur</code> \u2014 Responsive kart \u00fcretir<br><code>Formu mobil uyumlu yap</code> \u2014 Breakpoint\'ler ekler' },
            'code-review': { title: 'Code Review Plugin', body: '<p>The <strong>Code Review</strong> plugin provides automated code review capabilities.</p><h3>What Can You Do?</h3><ul><li>Review code for bugs, anti-patterns, and style issues</li><li>Check naming conventions and code organization</li><li>Identify potential security vulnerabilities</li><li>Suggest performance improvements</li><li>Validate error handling and edge cases</li></ul><h3>Installation</h3><pre><code>claude plugin install code-review@claude-plugins-official</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>Review this file for issues</code></td><td>Analyzes code for bugs, style, and best practices</td></tr><tr><td><code>Check my latest changes</code></td><td>Reviews git diff for potential problems</td></tr><tr><td><code>Are there any security issues here?</code></td><td>Scans for common vulnerabilities</td></tr></table><h3>Reference</h3><p><a href="https://claude.com/plugins/code-review" target="_blank">Code Review Plugin Page</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>Bu dosyay\u0131 incele</code> \u2014 Hata ve stil analizi<br><code>De\u011fi\u015fikliklerimi kontrol et</code> \u2014 Git diff inceler' },
            'code-simplifier': { title: 'Code Simplifier Plugin', body: '<p>The <strong>Code Simplifier</strong> plugin helps reduce code complexity.</p><h3>What Can You Do?</h3><ul><li>Simplify complex functions and reduce nesting</li><li>Extract reusable patterns and remove duplication</li><li>Reduce cyclomatic complexity</li><li>Improve readability without changing behavior</li><li>Suggest cleaner APIs and interfaces</li></ul><h3>Installation</h3><pre><code>claude plugin install code-simplifier@claude-plugins-official</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>Simplify this function</code></td><td>Reduces complexity while preserving behavior</td></tr><tr><td><code>This code is too nested, fix it</code></td><td>Flattens with early returns</td></tr><tr><td><code>Remove duplication in these files</code></td><td>Extracts shared logic into reusable functions</td></tr></table><h3>Reference</h3><p><a href="https://claude.com/plugins/code-simplifier" target="_blank">Code Simplifier Plugin Page</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>Bu fonksiyonu sadele\u015ftir</code> \u2014 Karma\u015f\u0131kl\u0131\u011f\u0131 azalt\u0131r<br><code>Tekrar\u0131 kald\u0131r</code> \u2014 Ortak mant\u0131\u011f\u0131 \u00e7\u0131kar\u0131r' },
            'playwright': { title: 'Playwright Plugin', body: '<p>The <strong>Playwright</strong> plugin enables browser testing and automation.</p><h3>What Can You Do?</h3><ul><li>Write Playwright test scripts</li><li>Run browser automation tasks</li><li>Debug failing E2E tests</li><li>Generate test selectors and assertions</li><li>Record and replay user interactions</li><li>Take screenshots and visual comparisons</li></ul><h3>Installation</h3><pre><code>claude plugin install playwright@claude-plugins-official</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>Write a test for the login page</code></td><td>Generates Playwright test with selectors and assertions</td></tr><tr><td><code>Take a screenshot of the dashboard</code></td><td>Opens browser, navigates, captures screenshot</td></tr><tr><td><code>This E2E test is failing, help debug</code></td><td>Analyzes the test, runs it, identifies the failure</td></tr></table><h3>Reference</h3><p><a href="https://claude.com/plugins/playwright" target="_blank">Playwright Plugin Page</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>Login i\u00e7in test yaz</code> \u2014 Playwright testi \u00fcretir<br><code>Screenshot al</code> \u2014 Taray\u0131c\u0131 ekran g\u00f6r\u00fcnt\u00fcs\u00fc al\u0131r' },
            'security-guidance': { title: 'Security Guidance Plugin', body: '<p>The <strong>Security Guidance</strong> plugin helps identify vulnerabilities and apply best practices.</p><h3>What Can You Do?</h3><ul><li>Detect common vulnerabilities (OWASP Top 10)</li><li>Review authentication and authorization patterns</li><li>Check for hardcoded secrets and credentials</li><li>Validate input sanitization and output encoding</li><li>Suggest security headers and CSP policies</li><li>Review dependency vulnerabilities</li></ul><h3>Installation</h3><pre><code>claude plugin install security-guidance@claude-plugins-official</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>Scan this file for security issues</code></td><td>Checks for injection, XSS, auth bypass</td></tr><tr><td><code>Are there any hardcoded secrets?</code></td><td>Scans for API keys, passwords, tokens</td></tr><tr><td><code>Review the auth middleware</code></td><td>Validates authentication flow and session handling</td></tr></table><h3>Reference</h3><p><a href="https://claude.com/plugins/security-guidance" target="_blank">Security Guidance Plugin Page</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>G\u00fcvenlik i\u00e7in tara</code> \u2014 Injection, XSS kontrol eder<br><code>Hardcoded secret var m\u0131?</code> \u2014 API key, \u015fifre arar' },
            'typescript-lsp': { title: 'TypeScript LSP Plugin', body: '<p>The <strong>TypeScript LSP</strong> plugin provides Language Server Protocol integration.</p><h3>What Can You Do?</h3><ul><li>Get real-time type errors and diagnostics</li><li>Intelligent code completions based on types</li><li>Find references and go to definitions</li><li>Rename symbols across the entire project</li><li>Auto-import missing modules</li><li>Understand complex type inference</li></ul><h3>Installation</h3><pre><code>claude plugin install typescript-lsp@claude-plugins-official</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>What type errors are in this file?</code></td><td>Runs TypeScript diagnostics and lists all errors</td></tr><tr><td><code>Find all usages of UserService</code></td><td>Searches references across the project via LSP</td></tr><tr><td><code>Rename this interface to IShipment</code></td><td>Renames across all files using LSP</td></tr></table><h3>Reference</h3><p><a href="https://claude.com/plugins/typescript-lsp" target="_blank">TypeScript LSP Plugin Page</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>Type hatalar\u0131 ne?</code> \u2014 Diagnostics \u00e7al\u0131\u015ft\u0131r\u0131r<br><code>UserService kullan\u0131mlar\u0131n\u0131 bul</code> \u2014 LSP ile arar' },
            'postgres': { title: 'PostgreSQL MCP Server', body: '<p>Query your <strong>PostgreSQL</strong> databases directly from Claude Code.</p><h3>What Can You Do?</h3><ul><li>Run SELECT, INSERT, UPDATE, DELETE queries</li><li>Inspect table schemas and relationships</li><li>Analyze data patterns and generate reports</li><li>Debug data issues in production/staging</li><li>Generate migrations based on current schema</li></ul><h3>Setup &amp; Credentials</h3><ol><li>Click <strong>"Install to Claude"</strong> in the MCP Server &amp; Plugin page.</li><li>Fill in the connection form: <strong>Host</strong>, <strong>Port</strong>, <strong>Database</strong>, <strong>Username</strong>, <strong>Password</strong>.</li><li>Click <strong>"Install to Claude"</strong> in the modal. The app validates the connection automatically before continuing.</li></ol><p>The connection string is stored in your user-level Claude MCP config at <code>~/.claude.json</code>. Uses <code>@anthropic-ai/postgres-mcp-server</code>.</p><h3>Installation</h3><pre><code>claude mcp add --scope user postgres --transport stdio -- npx @anthropic-ai/postgres-mcp-server "postgresql://user:pass@host:5432/db"</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>Show me the Ships table schema</code></td><td>Queries information_schema for columns and constraints</td></tr><tr><td><code>How many orders this month?</code></td><td>Runs COUNT with date filter</td></tr><tr><td><code>Find users without email</code></td><td>Queries WHERE email IS NULL</td></tr><tr><td><code>What tables reference Companies?</code></td><td>Queries foreign key constraints</td></tr></table>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>Ships \u015femas\u0131n\u0131 g\u00f6ster</code> \u2014 S\u00fctunlar\u0131 g\u00f6sterir<br><code>Bu ay ka\u00e7 sipari\u015f?</code> \u2014 COUNT \u00e7al\u0131\u015ft\u0131r\u0131r<br><code>E-postas\u0131z kullan\u0131c\u0131lar</code> \u2014 WHERE IS NULL sorgular' },
            'postman': { title: 'Postman MCP Server', body: '<p>Access your <strong>Postman</strong> API collections from Claude Code.</p><h3>What Can You Do?</h3><ul><li>Browse and search API collections</li><li>View request/response details</li><li>Generate code from Postman requests</li><li>Sync API documentation</li></ul><h3>Setup &amp; Credentials</h3><ol><li>Click <strong>"Install to Claude"</strong> in the MCP Server &amp; Plugin page.</li><li>Open Claude Code and run <code>/mcp</code>.</li><li>Select <strong>postman</strong> and click <strong>"Authenticate"</strong>.</li><li>Sign in with your Postman account in the browser and authorize.</li></ol><p>Postman MCP uses <strong>OAuth</strong> \u2014 no manual API key required.</p><h3>Installation</h3><pre><code>claude mcp add --scope user --transport http postman https://mcp.postman.com/mcp</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>List my Postman collections</code></td><td>Shows all collections in workspace</td></tr><tr><td><code>Show endpoints in Sales API</code></td><td>Lists requests with methods and URLs</td></tr><tr><td><code>Generate curl for create-order</code></td><td>Converts Postman request to curl</td></tr></table><h3>Reference</h3><p><a href="https://mcp.postman.com" target="_blank">Postman MCP Server</a></p>', otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: '<code>Koleksiyonlar\u0131m</code> \u2014 T\u00fcm koleksiyonlar\u0131 listeler<br><code>Sales API endpointleri</code> \u2014 \u0130stekleri listeler' },
            'context7': { title: "Context7 Plugin", body: "<p><strong>Context7</strong> pulls up-to-date, version-specific documentation and code examples directly into your prompts. Solves training-data hallucinations.</p><h3>What Can You Do?</h3><ul><li>Match library names to canonical IDs</li><li>Fetch current docs from source repos</li><li>Pin examples to a specific library version</li></ul><h3>Installation</h3><pre><code>claude plugin install context7@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/context7\" target=\"_blank\">Context7 Plugin Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Bir kütüphanenin sürümüne özel güncel dokümanları ve örnekleri promptunuza çeker." },
            'sentry': { title: "Sentry Plugin", body: "<p><strong>Sentry</strong> error monitoring inside Claude Code. Investigate production errors and stack traces from your IDE.</p><h3>What Can You Do?</h3><ul><li>Search Sentry issues by user impact and severity</li><li>Read full stack traces and breadcrumbs</li><li>Identify recurring patterns across releases</li></ul><h3>Installation</h3><pre><code>claude plugin install sentry@claude-plugins-official</code></pre><h3>Example Prompts</h3><table><tr><th>Prompt</th><th>What Claude Does</th></tr><tr><td><code>Top 10 unresolved Sentry issues this week</code></td><td>Queries Sentry, ranks by event count and user impact</td></tr><tr><td><code>Show stack trace for issue ABC-123</code></td><td>Fetches the latest event and prints the trace</td></tr></table><h3>Reference</h3><p><a href=\"https://claude.com/plugins/sentry\" target=\"_blank\">Sentry Plugin Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Prod hatalarını ve stack trace'leri Claude Code'dan inceleyin." },
            'csharp-lsp': { title: "C# LSP Plugin", body: "<p><strong>C# LSP</strong> brings Roslyn-powered code intelligence to .cs files: completion, diagnostics, navigation, refactoring across .NET / .NET Framework / multi-project solutions.</p><h3>What Can You Do?</h3><ul><li>Real-time type errors and diagnostics</li><li>Go-to-definition / find references</li><li>Rename symbol across the solution</li><li>Auto-import missing namespaces</li></ul><h3>Installation</h3><pre><code>claude plugin install csharp-lsp@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/csharp-lsp\" target=\"_blank\">C# LSP Plugin Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Roslyn tabanlı C# language server — tamamlama, tanı, refactoring." },
            'microsoft-docs': { title: "Microsoft Docs Plugin", body: "<p>Direct access to <strong>learn.microsoft.com</strong> — semantic search across Azure, .NET, Windows docs. Eliminates API hallucinations by checking against first-party docs.</p><h3>What Can You Do?</h3><ul><li>Semantic search across Microsoft technical libraries</li><li>Convert full documentation pages to markdown</li><li>Look up filtered SDK code samples</li><li>Verify API signatures against official sources</li></ul><h3>Installation</h3><pre><code>claude plugin install microsoft-docs@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/microsoft-docs\" target=\"_blank\">Microsoft Docs Plugin Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "learn.microsoft.com'da semantik arama ve kod örnekleri." },
            'mcp-server-dev': { title: "MCP Server Dev Plugin", body: "<p>Comprehensive guide for designing and building <strong>MCP servers</strong>. Covers deployment models, tool design, auth and packaging.</p><h3>What Can You Do?</h3><ul><li>Pick a deployment approach (remote HTTP vs local MCPB bundle)</li><li>Design tools and interactive UI widgets</li><li>Scaffold server code and authentication</li><li>Package MCPB bundles for distribution</li></ul><h3>Installation</h3><pre><code>claude plugin install mcp-server-dev@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/mcp-server-dev\" target=\"_blank\">MCP Server Dev Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Bir MCP sunucusunu tasarla, inşa et, paketle — rehberli akış." },
            'learning-output-style': { title: "Learning Output Style Plugin", body: "<p>Turns coding sessions into hands-on learning. Pauses at strategic decision points and asks YOU to write the code instead of producing the full solution.</p><h3>What Can You Do?</h3><ul><li>Stop being a copy-paste consumer</li><li>Receive guided prompts at key choices</li><li>Build skill while still shipping work</li></ul><h3>Installation</h3><pre><code>claude plugin install learning-output-style@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/learning-output-style\" target=\"_blank\">Learning Output Style Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Önemli kararlarda durur — kodu Claude değil sen yazasın diye." },
            'session-report': { title: "Session Report Plugin", body: "<p>Generates an explorable HTML report of your Claude Code session usage from local transcripts. Anthropic-verified plugin.</p><h3>What Can You Do?</h3><ul><li>See total tokens, cache hit rate, costs per session</li><li>Inspect subagent and skill usage</li><li>Find your most expensive prompts</li></ul><h3>Installation</h3><pre><code>claude plugin install session-report@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/session-report\" target=\"_blank\">Session Report Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Claude Code oturum kullanımı, maliyet ve skill aktivitesinin HTML raporu." },
            'chrome-devtools-mcp': { title: "Chrome DevTools Plugin", body: "<p>Drive a live Chrome browser via Puppeteer + Chrome DevTools Protocol. 29 tools for automation, performance profiling and debugging.</p><h3>What Can You Do?</h3><ul><li>Automate clicks and form fills</li><li>Record performance traces</li><li>Analyse network requests</li><li>Capture screenshots</li><li>Run Lighthouse audits</li></ul><h3>Installation</h3><pre><code>claude plugin install chrome-devtools-mcp@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/chrome-devtools-mcp\" target=\"_blank\">Chrome DevTools Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Gerçek Chrome'u sürer — otomasyon, perf trace, Lighthouse, screenshot." },
            'playground': { title: "Playground Plugin", body: "<p>Generates self-contained single-file HTML playgrounds with visual controls and live preview. Six built-in templates.</p><h3>What Can You Do?</h3><ul><li>Spin up a sandbox in one HTML file</li><li>Pick from Design, Data Explorer, Concept Map, Document Critique, Diff Review, Code Map templates</li><li>Tweak via visual controls, see live updates</li></ul><h3>Installation</h3><pre><code>claude plugin install playground@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/playground\" target=\"_blank\">Playground Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Görsel kontrollü, canlı önizlemeli tek dosya HTML playground'lar." },
            'hookify': { title: "Hookify Plugin", body: "<p>Define behavioural guardrails for Claude using plain markdown — block dangerous commands, debug code in production, hardcoded credentials. No coding required.</p><h3>What Can You Do?</h3><ul><li>Write guardrails as markdown files</li><li>Block patterns Claude should never produce</li><li>Tighten review around sensitive areas</li></ul><h3>Installation</h3><pre><code>claude plugin install hookify@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/hookify\" target=\"_blank\">Hookify Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Düz markdown ile Claude için davranış sınırları tanımlayın." },
            'ralph-loop': { title: "Ralph Loop Plugin", body: "<p>Iterative dev loops using the Ralph Wiggum technique — Claude reruns the same prompt against your latest files until tests pass or you stop. Preserves git history between iterations.</p><h3>What Can You Do?</h3><ul><li>Auto-iterate on failing tests</li><li>Refine drafts without retyping the prompt</li><li>Keep file history clean across iterations</li></ul><h3>Installation</h3><pre><code>claude plugin install ralph-loop@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/ralph-loop\" target=\"_blank\">Ralph Loop Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Yinelemeli geliştirme döngüsü — Claude işi tamamlanana kadar iyileştirir." },
            'claude-md-management': { title: "CLAUDE.md Management Plugin", body: "<p>Audit and maintain <code>CLAUDE.md</code> files. Skill scans the repo and grades quality; the <code>/revise-claude-md</code> command captures session learnings into project memory.</p><h3>What Can You Do?</h3><ul><li>Score existing CLAUDE.md against quality criteria</li><li>Capture new insights from a session</li><li>Suggest doc updates with your approval before writing</li></ul><h3>Installation</h3><pre><code>claude plugin install claude-md-management@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/claude-md-management\" target=\"_blank\">CLAUDE.md Management Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "CLAUDE.md dosyalarını dene ve güncelleyin; oturum çıkarımlarını yakalayın." },
            'ponytail': { title: "Ponytail Plugin", body: "<p><strong>Ponytail</strong> guides the agent toward minimal, practical code by applying a decision ladder before writing anything — skip needless features, reuse existing code, prefer native platform capabilities, write only what's needed (~54% less code, same safety). Modes: lite / full / ultra / off.</p><h3>What Can You Do?</h3><ul><li>Cut boilerplate and over-engineering automatically</li><li>Reuse existing code instead of re-implementing</li><li>Tune aggressiveness per task (lite/full/ultra/off)</li></ul><h3>Installation</h3><p>Ponytail ships from its own marketplace, so add the marketplace first:</p><pre><code>claude plugin marketplace add DietrichGebert/ponytail\nclaude plugin install ponytail@ponytail</code></pre><p>The app's Install button does both steps for you.</p><h3>Reference</h3><p><a href=\"https://github.com/DietrichGebert/ponytail\" target=\"_blank\">Ponytail on GitHub</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Ajan\u0131 minimal, pratik koda y\u00f6nlendirir; kendi marketplace'inden kurulur." },
            'feature-dev': { title: "Feature Dev Plugin", body: "<p>Structured 7-phase feature development workflow — codebase exploration, architecture, implementation, quality review. Three specialised agents drive the steps.</p><h3>What Can You Do?</h3><ul><li>Move through a defined feature pipeline (no improvisation)</li><li>Hand off between explorer, architect and reviewer agents</li><li>Get quality gates baked into each phase</li></ul><h3>Installation</h3><pre><code>claude plugin install feature-dev@claude-plugins-official</code></pre><h3>Reference</h3><p><a href=\"https://claude.com/plugins/feature-dev\" target=\"_blank\">Feature Dev Page</a></p>", otherLang: 'T\u00fcrk\u00e7e', otherLangHtml: "Explorer, architect ve reviewer agent'lı 7-fazlı özellik akışı." },
        },
        tr: {
            'what-is-mcp': { title: 'MCP ve Eklentiler Nedir?', body: '<p><strong>MCP (Model Context Protocol)</strong> ve <strong>Eklentiler</strong>, Claude Code\'u harici ara\u00e7 entegrasyonlar\u0131yla geni\u015fletir.</p><h3>Eklentiler vs MCP Sunucular\u0131</h3><table><tr><th>\u00d6zellik</th><th>Eklentiler</th><th>MCP Sunucular\u0131</th></tr><tr><td>Kurulum</td><td><code>claude plugin install</code></td><td><code>claude mcp add --scope user</code></td></tr><tr><td>Kimlik Do\u011frulama</td><td>OAuth (otomatik)</td><td>Manuel veya OAuth</td></tr><tr><td>G\u00fcncellemeler</td><td>Otomatik</td><td>Manuel</td></tr><tr><td>\u00d6rnekler</td><td>GitHub, Figma</td><td>PostgreSQL, Postman, Atlassian</td></tr></table><h3>Nas\u0131l \u00c7al\u0131\u015f\u0131r?</h3><p>Bir eklenti veya MCP sunucusu kurdu\u011funuzda, Claude Code yeni yetenekler kazan\u0131r.</p><h3>Temel Avantajlar</h3><ul><li><strong>Do\u011frudan eri\u015fim</strong> \u2014 Kopyala-yap\u0131\u015ft\u0131r olmadan</li><li><strong>Ba\u011flam fark\u0131ndal\u0131\u011f\u0131</strong> \u2014 Veritaban\u0131, Jira, Figma\'y\u0131 anlar</li><li><strong>G\u00fcvenli</strong> \u2014 Kimlik bilgileri yerelde kal\u0131r</li><li><strong>Bile\u015fimsel</strong> \u2014 Birden fazla entegrasyonu birlikte kullan\u0131n</li></ul><h3>Komutlar</h3><table><tr><th>Komut</th><th>A\u00e7\u0131klama</th></tr><tr><td><code>claude plugin install</code></td><td>Eklenti kur</td></tr><tr><td><code>claude plugin list</code></td><td>Eklentileri listele</td></tr><tr><td><code>claude plugin uninstall</code></td><td>Eklenti kald\u0131r</td></tr><tr><td><code>claude mcp add --scope user &lt;name&gt;</code></td><td>MCP sunucusunu t&uuml;m projeler i&ccedil;in ekle</td></tr><tr><td><code>claude mcp list</code></td><td>MCP\'leri listele</td></tr><tr><td><code>/mcp</code></td><td>Durum kontrol ve auth</td></tr></table><h3>Referans</h3><p><a href="https://code.claude.com/docs/en/mcp" target="_blank">MCP Dok\u00fcmantasyonu</a></p>', otherLang: 'English', otherLangHtml: 'MCP and Plugins extend Claude Code with external tool integrations.' },
            'superpowers': { title: 'Superpowers Eklentisi', body: '<p><strong>Superpowers</strong> eklentisi geli\u015fmi\u015f yetenekler ekler.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Geni\u015fletilmi\u015f ara\u00e7 kullan\u0131m\u0131</li><li>\u0130leri dosya manip\u00fclasyonu</li><li>Ak\u0131ll\u0131 ba\u011flam y\u00f6netimi</li></ul><h3>Kurulum</h3><pre><code>claude plugin install superpowers@claude-plugins-official</code></pre><h3>Referans</h3><p><a href="https://claude.com/plugins/superpowers" target="_blank">Superpowers Sayfas\u0131</a></p>', otherLang: 'English', otherLangHtml: 'Enhanced Claude capabilities and shortcuts for complex development tasks.' },
            'github': { title: 'GitHub Eklentisi', body: '<p><strong>GitHub</strong>\'a ba\u011flan\u0131n: PR, issue, code review.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>PR olu\u015fturma, inceleme, birle\u015ftirme</li><li>Issue y\u00f6netimi</li><li>CI/CD kontrol\u00fc</li></ul><h3>Kimlik Do\u011frulama</h3><p><strong>OAuth</strong> \u2014 <code>/mcp</code> ile yetkilendirin.</p><h3>Kurulum</h3><pre><code>claude plugin install github@claude-plugins-official</code></pre><h3>\u00d6rnek Promptlar</h3><table><tr><th>Prompt</th><th>Claude Ne Yapar</th></tr><tr><td><code>A\u00e7\u0131k PR\'lar\u0131 g\u00f6ster</code></td><td>T\u00fcm a\u00e7\u0131k PR\'lar\u0131 listeler</td></tr><tr><td><code>PR olu\u015ftur</code></td><td>Otomatik ba\u015fl\u0131k ile PR a\u00e7ar</td></tr><tr><td><code>PR #42\'yi incele</code></td><td>Kod incelemesi yapar</td></tr></table><h3>Referans</h3><p><a href="https://claude.com/plugins/github" target="_blank">GitHub Eklenti Sayfas\u0131</a></p>', otherLang: 'English', otherLangHtml: '<code>Show open PRs</code> \u2014 Lists PRs<br><code>Create a PR</code> \u2014 Creates PR<br><code>Review PR #42</code> \u2014 Code review' },
            'atlassian': { title: 'Atlassian (Jira) MCP Sunucusu', body: '<p><strong>Jira</strong> issue, sprint ve proje y\u00f6netimi.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Issue CRUD</li><li>Durum ge\u00e7i\u015fi</li><li>Sprint y\u00f6netimi, JQL arama</li></ul><h3>Kimlik Do\u011frulama</h3><p><strong>OAuth</strong> \u2014 <code>/mcp</code> ile yetkilendirin.</p><p>Kurulum user-level Claude MCP yap\u0131land\u0131rmas\u0131na yaz\u0131l\u0131r; bu sayede t\u00fcm projelerde g\u00f6r\u00fcn\u00fcr.</p><h3>Kurulum</h3><pre><code>claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v1/mcp</code></pre><h3>\u00d6rnek Promptlar</h3><table><tr><th>Prompt</th><th>Claude Ne Yapar</th></tr><tr><td><code>PROJ\'deki a\u00e7\u0131k ticket\'lar\u0131m</code></td><td>JQL ile listeler</td></tr><tr><td><code>Bug olu\u015ftur: \u00f6deme yanl\u0131\u015f</code></td><td>Bug olu\u015fturur</td></tr><tr><td><code>PROJ-123 In Progress\'e</code></td><td>Durum de\u011fi\u015ftirir</td></tr></table><h3>Referans</h3><p><a href="https://mcp.atlassian.com/v1/mcp" target="_blank">Atlassian MCP Endpoint</a></p>', otherLang: 'English', otherLangHtml: '<code>Show open tickets in PROJ</code> \u2014 Lists via JQL<br><code>Create bug: payment wrong</code> \u2014 Creates Bug<br><code>Move PROJ-123 to In Progress</code> \u2014 Transitions' },
            'figma': { title: 'Figma Eklentisi', body: '<p><strong>Figma</strong> tasar\u0131m dosyalar\u0131na eri\u015fin.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Bile\u015fen inceleme</li><li>Renk, font \u00e7\u0131karma</li><li>CSS \u00fcretme</li></ul><h3>Kurulum</h3><pre><code>claude plugin install figma@claude-plugins-official</code></pre><h3>Referans</h3><p><a href="https://claude.com/plugins/figma" target="_blank">Figma Sayfas\u0131</a></p>', otherLang: 'English', otherLangHtml: '<code>Show components</code> \u2014 Lists components<br><code>Generate CSS</code> \u2014 Generates CSS' },
            'frontend-design': { title: 'Frontend Design Eklentisi', body: '<p>UI/UX tasar\u0131m yard\u0131m\u0131.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>UI bile\u015fen kodu \u00fcretme</li><li>Responsive layout</li><li>Renk paleti \u00f6nerileri</li></ul><h3>Kurulum</h3><pre><code>claude plugin install frontend-design@claude-plugins-official</code></pre><h3>Referans</h3><p><a href="https://claude.com/plugins/frontend-design" target="_blank">Frontend Design Sayfas\u0131</a></p>', otherLang: 'English', otherLangHtml: '<code>Create pricing card</code> \u2014 Generates responsive card' },
            'code-review': { title: 'Code Review Eklentisi', body: '<p>Otomatik kod inceleme.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Hata ve anti-pattern tespiti</li><li>G\u00fcvenlik zafiyet kontrol\u00fc</li><li>Performans \u00f6nerileri</li></ul><h3>Kurulum</h3><pre><code>claude plugin install code-review@claude-plugins-official</code></pre><h3>Referans</h3><p><a href="https://claude.com/plugins/code-review" target="_blank">Code Review Sayfas\u0131</a></p>', otherLang: 'English', otherLangHtml: '<code>Review this file</code> \u2014 Analyzes for bugs' },
            'code-simplifier': { title: 'Code Simplifier Eklentisi', body: '<p>Kod karma\u015f\u0131kl\u0131\u011f\u0131n\u0131 azalt\u0131r.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Fonksiyon sadele\u015ftirme</li><li>Tekrar kald\u0131rma</li><li>Okunabilirli\u011fi art\u0131rma</li></ul><h3>Kurulum</h3><pre><code>claude plugin install code-simplifier@claude-plugins-official</code></pre><h3>Referans</h3><p><a href="https://claude.com/plugins/code-simplifier" target="_blank">Code Simplifier Sayfas\u0131</a></p>', otherLang: 'English', otherLangHtml: '<code>Simplify this function</code> \u2014 Reduces complexity' },
            'playwright': { title: 'Playwright Eklentisi', body: '<p>Taray\u0131c\u0131 testi ve otomasyon.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Playwright test yazma</li><li>E2E test debug</li><li>Screenshot ve g\u00f6rsel kar\u015f\u0131la\u015ft\u0131rma</li></ul><h3>Kurulum</h3><pre><code>claude plugin install playwright@claude-plugins-official</code></pre><h3>Referans</h3><p><a href="https://claude.com/plugins/playwright" target="_blank">Playwright Sayfas\u0131</a></p>', otherLang: 'English', otherLangHtml: '<code>Write a test for login</code> \u2014 Generates Playwright test' },
            'security-guidance': { title: 'Security Guidance Eklentisi', body: '<p>G\u00fcvenlik zafiyeti tespiti ve en iyi pratikler.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>OWASP Top 10 taramas\u0131</li><li>Hardcoded secret tespiti</li><li>Auth pattern kontrol\u00fc</li></ul><h3>Kurulum</h3><pre><code>claude plugin install security-guidance@claude-plugins-official</code></pre><h3>Referans</h3><p><a href="https://claude.com/plugins/security-guidance" target="_blank">Security Guidance Sayfas\u0131</a></p>', otherLang: 'English', otherLangHtml: '<code>Scan for security issues</code> \u2014 Checks for vulnerabilities' },
            'typescript-lsp': { title: 'TypeScript LSP Eklentisi', body: '<p>TypeScript Language Server entegrasyonu.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Type hata diagnostik</li><li>Referans bulma</li><li>Sembol yeniden adland\u0131rma</li></ul><h3>Kurulum</h3><pre><code>claude plugin install typescript-lsp@claude-plugins-official</code></pre><h3>Referans</h3><p><a href="https://claude.com/plugins/typescript-lsp" target="_blank">TypeScript LSP Sayfas\u0131</a></p>', otherLang: 'English', otherLangHtml: '<code>What type errors?</code> \u2014 Runs diagnostics' },
            'postgres': { title: 'PostgreSQL MCP Sunucusu', body: '<p><strong>PostgreSQL</strong> sorgulama.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>SQL sorgular\u0131</li><li>\u015eema inceleme</li><li>Veri analizi</li></ul><h3>Kurulum</h3><ol><li>MCP Server &amp; Plugin sayfas\u0131nda <strong>"Claude\'a Kur"</strong> butonuna t\u0131klay\u0131n.</li><li>Ba\u011flant\u0131 formunu doldurun.</li><li>Modaldaki <strong>"Claude\'a Kur"</strong> veya <strong>"Kaydet"</strong> butonuna t\u0131klay\u0131n. Uygulama devam etmeden \u00f6nce ba\u011flant\u0131y\u0131 otomatik test eder.</li></ol><p>Ba\u011flant\u0131 bilgileri user-level Claude MCP yap\u0131land\u0131rmas\u0131 olan <code>~/.claude.json</code> dosyas\u0131na yaz\u0131l\u0131r.</p><pre><code>claude mcp add --scope user postgres --transport stdio -- npx @anthropic-ai/postgres-mcp-server "postgresql://user:pass@host:5432/db"</code></pre><h3>\u00d6rnek Promptlar</h3><table><tr><th>Prompt</th><th>Claude Ne Yapar</th></tr><tr><td><code>Ships \u015femas\u0131</code></td><td>S\u00fctunlar\u0131 g\u00f6sterir</td></tr><tr><td><code>Bu ay ka\u00e7 sipari\u015f?</code></td><td>COUNT \u00e7al\u0131\u015ft\u0131r\u0131r</td></tr></table>', otherLang: 'English', otherLangHtml: '<code>Show Ships schema</code> \u2014 Shows columns<br><code>Orders this month?</code> \u2014 Runs COUNT' },
            'postman': { title: 'Postman MCP Sunucusu', body: '<p><strong>Postman</strong> API koleksiyonlar\u0131.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Koleksiyon g\u00f6zden ge\u00e7irme</li><li>Kod \u00fcretme</li></ul><h3>Kurulum</h3><pre><code>claude mcp add --scope user --transport http postman https://mcp.postman.com/mcp</code></pre><h3>Referans</h3><p><a href="https://mcp.postman.com" target="_blank">Postman MCP</a></p>', otherLang: 'English', otherLangHtml: '<code>List collections</code> \u2014 Shows all collections' },
            'context7': { title: "Context7 Eklentisi", body: "<p><strong>Context7</strong> promptlara güncel, sürüme özel dokümantasyon ve kod örnekleri çeker. Eskimiş eğitim verisi halüsinasyonlarını çözer.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Kütüphane adlarını kanonik ID'lere eşleyin</li><li>Kaynak repolardan güncel dokümantasyon çekin</li><li>Örnekleri belirli bir sürüme sabitleyin</li></ul><h3>Kurulum</h3><pre><code>claude plugin install context7@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/context7\" target=\"_blank\">Context7 Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Pulls current docs and examples for a library version into your prompts." },
            'sentry': { title: "Sentry Eklentisi", body: "<p>Claude Code içinde <strong>Sentry</strong> hata izleme. Prod hatalarını ve stack trace'leri IDE'den araştırın.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Sentry issue'larını kullanıcı etkisi ve önem derecesine göre arayın</li><li>Tam stack trace ve breadcrumb okuyun</li><li>Sürümler arası tekrar eden patternleri tespit edin</li></ul><h3>Kurulum</h3><pre><code>claude plugin install sentry@claude-plugins-official</code></pre><h3>Örnek Promptlar</h3><table><tr><th>Prompt</th><th>Claude Ne Yapar</th></tr><tr><td><code>Bu hafta en çok 10 çözülmemiş Sentry issue'u</code></td><td>Sentry'i sorgular, event sayısı ve etkisine göre sıralar</td></tr><tr><td><code>ABC-123 issue stack trace'ini göster</code></td><td>En son event'i çeker, trace'i basar</td></tr></table><h3>Referans</h3><p><a href=\"https://claude.com/plugins/sentry\" target=\"_blank\">Sentry Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Investigate production errors and stack traces from Claude Code." },
            'csharp-lsp': { title: "C# LSP Eklentisi", body: "<p><strong>C# LSP</strong> Roslyn destekli kod zekasını .cs dosyalarına getirir: tamamlama, tanı, gezinti, refactoring — .NET / .NET Framework / çoklu proje çözümleri için.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Gerçek zamanlı type hatası ve tanı</li><li>Go-to-definition / referans bulma</li><li>Çözüm genelinde sembol yeniden adlandırma</li><li>Eksik namespace auto-import</li></ul><h3>Kurulum</h3><pre><code>claude plugin install csharp-lsp@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/csharp-lsp\" target=\"_blank\">C# LSP Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Roslyn-based language server for C# completion, diagnostics and refactoring." },
            'microsoft-docs': { title: "Microsoft Docs Eklentisi", body: "<p><strong>learn.microsoft.com</strong>'a doğrudan erişim — Azure, .NET, Windows dokümanları arasında semantik arama. API halüsinasyonlarını birinci el dokümanlara karşı doğrulayarak ortadan kaldırır.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Microsoft teknik kütüphaneleri arasında semantik arama</li><li>Tam dokümantasyon sayfalarını markdown'a çevirme</li><li>Filtrelenmiş SDK kod örneklerini bulma</li><li>API imzalarını resmi kaynaklara göre doğrulama</li></ul><h3>Kurulum</h3><pre><code>claude plugin install microsoft-docs@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/microsoft-docs\" target=\"_blank\">Microsoft Docs Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Semantic search and code samples from learn.microsoft.com." },
            'mcp-server-dev': { title: "MCP Server Dev Eklentisi", body: "<p><strong>MCP sunucu</strong> tasarlama ve inşa için kapsamlı rehber. Deployment modelleri, tool tasarımı, auth ve paketlemeyi kapsar.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Deployment yaklaşımı seçme (uzak HTTP vs yerel MCPB bundle)</li><li>Tool ve interaktif UI widget tasarımı</li><li>Sunucu kodu ve auth scaffold</li><li>Dağıtım için MCPB bundle paketleme</li></ul><h3>Kurulum</h3><pre><code>claude plugin install mcp-server-dev@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/mcp-server-dev\" target=\"_blank\">MCP Server Dev Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Guided workflow to design, build and package an MCP server." },
            'learning-output-style': { title: "Learning Output Style Eklentisi", body: "<p>Kodlama oturumlarını uygulamalı öğrenmeye çevirir. Stratejik karar noktalarında durur ve hazır çözüm vermek yerine kodu SENİN yazmanı ister.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Kopyala-yapıştır tüketici olmaktan çıkın</li><li>Önemli kararlarda rehberli prompt alın</li><li>İş çıkarırken yetkinlik kazanın</li></ul><h3>Kurulum</h3><pre><code>claude plugin install learning-output-style@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/learning-output-style\" target=\"_blank\">Learning Output Style Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Pauses at key decisions so you write the code yourself, not Claude." },
            'session-report': { title: "Oturum Raporu Eklentisi", body: "<p>Yerel transkriptlerden Claude Code oturum kullanımının gezilebilir HTML raporunu üretir. Anthropic onaylı eklenti.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Oturum başına toplam token, cache hit oranı, maliyet</li><li>Subagent ve skill kullanımını inceleyin</li><li>En pahalı promptları bulun</li></ul><h3>Kurulum</h3><pre><code>claude plugin install session-report@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/session-report\" target=\"_blank\">Session Report Sayfası</a></p>", otherLang: 'English', otherLangHtml: "HTML report of Claude Code session usage, cost and skill activity." },
            'chrome-devtools-mcp': { title: "Chrome DevTools Eklentisi", body: "<p>Puppeteer + Chrome DevTools Protocol ile canlı Chrome'u sürer. Otomasyon, performans profili ve debug için 29 tool.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Tıklama ve form otomasyonu</li><li>Performans trace kaydı</li><li>Network request analizi</li><li>Screenshot</li><li>Lighthouse denetimi</li></ul><h3>Kurulum</h3><pre><code>claude plugin install chrome-devtools-mcp@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/chrome-devtools-mcp\" target=\"_blank\">Chrome DevTools Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Drive a real Chrome browser — automation, perf trace, Lighthouse, screenshots." },
            'playground': { title: "Playground Eklentisi", body: "<p>Görsel kontrollü ve canlı önizlemeli, tek dosyalık HTML playground üretir. Altı hazır şablon.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Tek HTML dosyada sandbox kurun</li><li>Design, Data Explorer, Concept Map, Document Critique, Diff Review, Code Map şablonlarından seçin</li><li>Görsel kontrollerle ayar, anlık güncelleme</li></ul><h3>Kurulum</h3><pre><code>claude plugin install playground@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/playground\" target=\"_blank\">Playground Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Single-file HTML playgrounds with visual controls and live preview." },
            'hookify': { title: "Hookify Eklentisi", body: "<p>Düz markdown ile Claude için davranış sınırları tanımla — tehlikeli komutları, prod'daki debug kodunu, hardcoded credential'ları engelle. Kod yazmaya gerek yok.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Sınırları markdown dosyaları olarak yazın</li><li>Claude'un asla üretmemesi gereken patternleri engelleyin</li><li>Hassas bölgelerde review'ı sıkılaştırın</li></ul><h3>Kurulum</h3><pre><code>claude plugin install hookify@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/hookify\" target=\"_blank\">Hookify Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Define behavioural guardrails for Claude using plain markdown." },
            'ralph-loop': { title: "Ralph Loop Eklentisi", body: "<p>Ralph Wiggum tekniği ile yinelemeli geliştirme — Claude aynı promptu en son dosyalarla, testler geçene veya sen durana kadar tekrar koşar. Yinelemeler arası git geçmişini korur.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Başarısız testlerde otomatik yineleyin</li><li>Promptu yeniden yazmadan taslakları iyileştirin</li><li>Yinelemeler arası temiz dosya geçmişi</li></ul><h3>Kurulum</h3><pre><code>claude plugin install ralph-loop@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/ralph-loop\" target=\"_blank\">Ralph Loop Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Iterative development loops — Claude refines work until completion." },
            'claude-md-management': { title: "CLAUDE.md Yönetimi Eklentisi", body: "<p><code>CLAUDE.md</code> dosyalarını dene ve bakım yap. Skill repoyu tarayıp kaliteyi puanlar; <code>/revise-claude-md</code> komutu oturum çıkarımlarını proje belleğine işler.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Mevcut CLAUDE.md'yi kalite kriterlerine göre puanlayın</li><li>Bir oturumdan yeni içgörüler yakalayın</li><li>Yazmadan önce onayınızla doc güncellemesi önerin</li></ul><h3>Kurulum</h3><pre><code>claude plugin install claude-md-management@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/claude-md-management\" target=\"_blank\">CLAUDE.md Management Sayfası</a></p>", otherLang: 'English', otherLangHtml: "Audit and update CLAUDE.md files; capture session learnings to project memory." },
            'ponytail': { title: "Ponytail Eklentisi", body: "<p><strong>Ponytail</strong>, kod yazmadan \u00f6nce bir karar merdiveni uygulayarak ajan\u0131 minimal ve pratik koda y\u00f6nlendirir \u2014 gereksiz \u00f6zellikleri atla, mevcut kodu yeniden kullan, native API tercih et, sadece gerekeni yaz (~%54 daha az kod, ayn\u0131 g\u00fcvenlik). Modlar: lite / full / ultra / off.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Boilerplate ve a\u015f\u0131r\u0131 m\u00fchendisli\u011fi otomatik k\u0131s</li><li>Yeniden yazmak yerine mevcut kodu kullan</li><li>G\u00f6rev ba\u015f\u0131na agresifli\u011fi ayarla (lite/full/ultra/off)</li></ul><h3>Kurulum</h3><p>Ponytail kendi marketplace'inden gelir, \u00f6nce marketplace eklenir:</p><pre><code>claude plugin marketplace add DietrichGebert/ponytail\nclaude plugin install ponytail@ponytail</code></pre><p>Uygulamadaki Kur butonu iki ad\u0131m\u0131 da yapar.</p><h3>Referans</h3><p><a href=\"https://github.com/DietrichGebert/ponytail\" target=\"_blank\">GitHub'da Ponytail</a></p>", otherLang: 'English', otherLangHtml: "Guides the agent to minimal, practical code; installs from its own marketplace." },
            'feature-dev': { title: "Feature Dev Eklentisi", body: "<p>Yapılandırılmış 7-fazlı özellik geliştirme akışı — kod tabanı keşfi, mimari, uygulama, kalite review. Üç özel agent adımları yönetir.</p><h3>Neler Yapabilirsiniz?</h3><ul><li>Tanımlı bir özellik pipeline'ında ilerleyin (doğaçlama yok)</li><li>Explorer, architect ve reviewer agent'ları arasında devir</li><li>Her faza gömülü kalite gate'leri alın</li></ul><h3>Kurulum</h3><pre><code>claude plugin install feature-dev@claude-plugins-official</code></pre><h3>Referans</h3><p><a href=\"https://claude.com/plugins/feature-dev\" target=\"_blank\">Feature Dev Sayfası</a></p>", otherLang: 'English', otherLangHtml: "7-phase feature workflow with explorer, architect and reviewer agents." },
        }
    },

    _buildChapters: function () {
        var lang = Bridge._langCode || 'en';
        var t = this._i18n[lang] || this._i18n.en;
        var chapters = [];

        for (var i = 0; i < this._chapterDefs.length; i++) {
            var def = this._chapterDefs[i];
            var data = t[def.id] || {};
            var num = String(i + 1);

            // Build body HTML with other-lang box appended
            var bodyHtml = '<div class="mcp-guide-content">' + (data.body || '') + '</div>';
            if (data.otherLangHtml) {
                bodyHtml += '<div class="mcp-guide-other-lang">' +
                    '<div class="mcp-guide-other-lang-header"><span class="mi" style="font-size:16px">translate</span> ' + this._escapeHtml(data.otherLang || '') + '</div>' +
                    '<div class="mcp-guide-other-lang-body">' + data.otherLangHtml + '</div>' +
                '</div>';
            }

            // Searchable plain text
            var tmp = document.createElement('div');
            tmp.innerHTML = data.body || '';
            var searchableText = ((data.title || '') + ' ' + (tmp.textContent || tmp.innerText || '')).toLowerCase();

            chapters.push({
                id: def.id,
                icon: def.icon,
                num: num,
                title: data.title || def.id,
                bodyHtml: bodyHtml,
                searchableText: searchableText
            });
        }

        return chapters;
    },

    _renderChapterHtml: function (chapter) {
        return '<div class="bp-chapter" id="mcp-ch-' + chapter.num + '">' +
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
                    '<span class="mi">hub</span>' +
                    t.title +
                '</div>' +
                '<div class="subpage-scroll bp-shell">' +
                    '<div class="bp-content">' +
                        '<div class="bp-toc-sidebar" id="mcp-toc-sidebar">' +
                            '<div class="bp-search-box">' +
                                '<span class="mi">search</span>' +
                                '<input type="text" class="bp-search-input" id="mcp-search" placeholder="' + t.searchPlaceholder + '">' +
                            '</div>' +
                            '<div class="bp-toc-header">' +
                                '<span class="bp-toc-title">' + t.tocTitle + '</span>' +
                            '</div>' +
                            '<ul class="bp-toc-list" id="mcp-toc-list"></ul>' +
                        '</div>' +
                        '<div class="bp-main">' +
                            '<div class="bp-main-scroll" id="mcp-main-scroll">' +
                                '<div class="loading-container" id="mcp-loading">' +
                                    '<div class="loading-text">' + (Bridge.lang('CommonLoading') || 'Loading...') + '</div>' +
                                '</div>' +
                                '<div id="mcp-search-results" style="display:none"></div>' +
                                '<div id="mcp-chapter-view" style="display:none"></div>' +
                                '<div class="bp-no-result" id="mcp-no-result" style="display:none">' + t.noResult + '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="bp-page-actions subpage-footer" id="mcp-page-nav" style="display:none">' +
                '<div class="bp-page-actions-side bp-page-actions-left"></div>' +
                '<div class="bp-page-actions-center">' +
                    '<button class="bp-page-nav-btn" id="mcp-prev"><span class="mi">navigate_before</span>' + t.prevPage + '</button>' +
                    '<span class="bp-page-indicator" id="mcp-page-indicator"></span>' +
                    '<button class="bp-page-nav-btn" id="mcp-next">' + t.nextPage + '<span class="mi">navigate_next</span></button>' +
                '</div>' +
                '<div class="bp-page-actions-side bp-page-actions-right"></div>' +
            '</div>' +
        '</div>';
    },

    afterRender: function () {
        var self = this;
        var t = this._t;
        var tocSidebar = document.getElementById('mcp-toc-sidebar');
        var tocList = document.getElementById('mcp-toc-list');
        var searchInput = document.getElementById('mcp-search');
        var loading = document.getElementById('mcp-loading');
        var chapterView = document.getElementById('mcp-chapter-view');
        var searchResults = document.getElementById('mcp-search-results');
        var noResult = document.getElementById('mcp-no-result');
        var mainScroll = document.getElementById('mcp-main-scroll');
        var pageNav = document.getElementById('mcp-page-nav');
        var prevBtn = document.getElementById('mcp-prev');
        var nextBtn = document.getElementById('mcp-next');
        var indicator = document.getElementById('mcp-page-indicator');

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

            if (mainScroll) mainScroll.scrollTop = 0;
        }

        function showSearchResults(query) {
            var q = (query || '').toLowerCase().trim();
            if (!q) { showPage(currentPage); return; }

            var matches = [];
            for (var i = 0; i < chapters.length; i++) {
                if (chapters[i].searchableText.indexOf(q) >= 0) matches.push(i);
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

        if (prevBtn) prevBtn.addEventListener('click', function () { if (currentPage > 0) { if (searchInput) searchInput.value = ''; showPage(currentPage - 1); } });
        if (nextBtn) nextBtn.addEventListener('click', function () { if (currentPage < chapters.length - 1) { if (searchInput) searchInput.value = ''; showPage(currentPage + 1); } });
        if (searchInput) searchInput.addEventListener('input', function () { showSearchResults(this.value); });

        if (tocList) {
            tocList.addEventListener('click', function (e) {
                var target = e.target;
                while (target && target !== tocList) {
                    if (target.classList && target.classList.contains('bp-toc-link')) {
                        e.preventDefault();
                        var pageIdx = parseInt(target.getAttribute('data-page'), 10);
                        if (!isNaN(pageIdx)) { if (searchInput) searchInput.value = ''; showPage(pageIdx); }
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
                        if (!isNaN(pageIdx)) { if (searchInput) searchInput.value = ''; showPage(pageIdx); }
                        return;
                    }
                    target = target.parentElement;
                }
            });
        }

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
