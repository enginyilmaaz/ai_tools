// About Page
window.AboutPage = {
    render: function () {
        var L = Bridge.lang.bind(Bridge);
        var settings = Bridge._settings || {};
        var version = settings.appVersion || '1.0.0.0';
        var buildId = settings.buildId || 'dev';

        return '' +
        '<div class="subpage-layout">' +
            '<div class="card about-page-card subpage-card">' +
                '<div class="card-title">' +
                    '<span class="mi">info</span>' +
                    (L('AboutTitle') || 'About') +
                '</div>' +
                '<div class="subpage-scroll about-shell">' +
                    '<div class="about-content">' +
                        '<div class="about-app-name">' + (L('AppName') || 'AI Tool') + '</div>' +
                        '<img src="assets/app-icon.png" class="about-app-icon" alt="">' +
                        '<div class="about-row">' +
                            '<span class="about-label">' + (L('AboutVersion') || 'Version') + '</span>' +
                            '<span class="about-value">' + version + '</span>' +
                        '</div>' +
                        '<div class="about-row">' +
                            '<span class="about-label">' + (L('AboutBuildId') || 'Build ID') + '</span>' +
                            '<span class="about-value">' + buildId + '</span>' +
                        '</div>' +
                        '<div class="about-divider"></div>' +
                        '<div class="about-row">' +
                            '<span class="about-label">' + (L('AboutAuthor') || 'Author') + '</span>' +
                            '<span class="about-value">enginyilmaaz</span>' +
                        '</div>' +
                        '<div class="about-row">' +
                            '<span class="about-label">' + (L('AboutGitHub') || 'GitHub') + '</span>' +
                            '<a class="about-link" id="about-github-link" href="#">github.com/enginyilmaaz</a>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="about-actions subpage-footer">' +
                '<button class="btn btn-secondary" id="about-close">' + (L('NavBack') || 'Close') + '</button>' +
            '</div>' +
        '</div>';
    },

    afterRender: function () {
        var link = document.getElementById('about-github-link');
        if (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                Bridge.send('openUrl', { url: 'https://github.com/enginyilmaaz' });
            });
        }

        var closeBtn = document.getElementById('about-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                Bridge.send('closeWindow', {});
            });
        }
    }
};
