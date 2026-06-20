// update-ui.js — shared auto-update check + install dialog.
// Loaded in both the main window (index.html) and subwindows (subwindow.html)
// so the manual check on the About page and the startup check share one flow.
(function () {
  'use strict';

  if (!window.api || !window.api.updater) return;

  function L(key, fallback) {
    var v = (window.Bridge && Bridge.lang) ? Bridge.lang(key) : null;
    return (v && v !== key) ? v : (fallback || key);
  }

  function showUpdatingToast() {
    var el = document.createElement('div');
    el.className = 'sm-toast';
    var sp = document.createElement('span');
    sp.className = 'sm-toast-spinner';
    var tx = document.createElement('span');
    tx.className = 'sm-toast-text';
    tx.textContent = L('UpdateWorking', 'Updating…');
    var cl = document.createElement('button');
    cl.className = 'sm-toast-close mi';
    cl.textContent = 'close';
    cl.addEventListener('click', function () { el.remove(); });
    el.appendChild(sp); el.appendChild(tx); el.appendChild(cl);
    document.body.appendChild(el);
    return {
      setText: function (s) { tx.textContent = s; },
      setError: function (s) { el.classList.add('sm-toast-error'); sp.style.display = 'none'; tx.textContent = s; setTimeout(function () { el.remove(); }, 8000); }
    };
  }

  function showAvailable(info) {
    if (document.getElementById('update-overlay')) return;

    var isLinux = !!info.installable;

    var overlay = document.createElement('div');
    overlay.id = 'update-overlay';
    overlay.className = 'modal-overlay';

    var dialog = document.createElement('div');
    dialog.className = 'modal-dialog update-dialog';

    var header = document.createElement('div');
    header.className = 'modal-header';
    var title = document.createElement('span');
    title.className = 'modal-title';
    title.textContent = L('UpdateAvailableTitle', 'Update Available');
    var closeX = document.createElement('button');
    closeX.className = 'modal-close';
    closeX.type = 'button';
    closeX.title = L('UpdateLater', 'Later');
    closeX.innerHTML = '<span class="mi">close</span>';
    header.appendChild(title);
    header.appendChild(closeX);

    var body = document.createElement('div');
    body.className = 'modal-body';

    var msg = document.createElement('div');
    msg.style.cssText = 'font-size:13px;color:var(--text-secondary);margin-bottom:10px';
    msg.textContent = L('UpdateAvailableMsg', 'A newer version of AI Tool is available.');
    body.appendChild(msg);

    var ver = document.createElement('div');
    ver.style.cssText = 'font-size:14px;color:var(--text-primary);font-weight:600;margin-bottom:14px';
    ver.textContent = 'v' + (info.current || '?') + ' → v' + (info.latest || '?');
    body.appendChild(ver);

    var lbl = null, pwInput = null;
    if (isLinux) {
      lbl = document.createElement('label');
      lbl.style.cssText = 'display:block;font-size:12px;color:var(--text-muted);margin-bottom:6px';
      lbl.textContent = L('UpdateSudoLabel', 'Your computer password (sudo) is required to install');
      pwInput = document.createElement('input');
      pwInput.type = 'password';
      pwInput.autocomplete = 'off';
      pwInput.placeholder = '••••••••';
      pwInput.style.cssText = 'width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid var(--border-input);background:var(--bg-input);color:var(--text-primary)';
      body.appendChild(lbl);
      body.appendChild(pwInput);
    } else {
      var note = document.createElement('div');
      note.style.cssText = 'font-size:12px;color:var(--text-muted)';
      note.textContent = L('UpdateManualMsg', 'Download the new version from the releases page.');
      body.appendChild(note);
    }

    var progressBar = document.createElement('div');
    progressBar.className = 'progress-bar progress-bar-green';
    progressBar.style.display = 'none';
    var progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    var progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressBar.appendChild(progressFill);
    progressBar.appendChild(progressText);
    body.appendChild(progressBar);

    var status = document.createElement('div');
    status.style.cssText = 'font-size:12px;margin-top:10px;min-height:16px';
    body.appendChild(status);

    var footer = document.createElement('div');
    footer.className = 'modal-footer';
    var laterBtn = document.createElement('button');
    laterBtn.className = 'btn btn-secondary';
    laterBtn.textContent = L('UpdateLater', 'Later');
    var okBtn = document.createElement('button');
    okBtn.className = 'btn btn-primary';
    okBtn.textContent = isLinux ? L('UpdateInstall', 'Update & restart') : L('UpdateDownload', 'Download');
    footer.appendChild(laterBtn);
    footer.appendChild(okBtn);

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var installing = false, backgrounded = false, toast = null, unsubscribe = null, escHandler = null;

    function close() {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
      overlay.remove();
    }
    function goBackground() {
      if (backgrounded) return;
      backgrounded = true;
      toast = showUpdatingToast();
      if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
      overlay.remove();
    }
    escHandler = function (e) { if (e.key !== 'Escape') return; if (installing) goBackground(); else close(); };
    document.addEventListener('keydown', escHandler);

    closeX.addEventListener('click', function () { if (!installing) close(); });
    laterBtn.addEventListener('click', function () { if (installing) goBackground(); else close(); });

    if (pwInput) {
      setTimeout(function () { pwInput.focus(); }, 50);
      pwInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !okBtn.disabled) { e.preventDefault(); okBtn.click(); }
      });
    }

    function setProgress(received, total) {
      progressBar.style.display = '';
      if (total > 0) {
        var pct = Math.min(100, Math.round((received / total) * 100));
        progressBar.classList.remove('progress-indeterminate');
        progressFill.style.width = pct + '%';
        if (pct >= 100) {
          progressText.textContent = L('UpdateWorking', 'Updating…');
        } else {
          var mb = (received / 1048576).toFixed(1);
          var tot = (total / 1048576).toFixed(1);
          progressText.textContent = pct + '%  (' + mb + '/' + tot + ' MB)';
        }
      } else {
        progressBar.classList.add('progress-indeterminate');
        progressFill.style.width = '100%';
        progressText.textContent = L('UpdateDownloading', 'Downloading');
      }
      if (backgrounded && toast) toast.setText(progressText.textContent || L('UpdateWorking', 'Updating…'));
    }

    function fail(message) {
      if (backgrounded) { if (toast) toast.setError(message); return; }
      installing = false;
      progressBar.style.display = 'none';
      status.style.color = 'var(--color-error)';
      status.textContent = message;
      okBtn.disabled = false; okBtn.textContent = L('UpdateInstall', 'Update & restart');
      laterBtn.textContent = L('UpdateLater', 'Later');
      closeX.disabled = false;
      if (pwInput) { pwInput.disabled = false; pwInput.style.display = ''; pwInput.value = ''; pwInput.focus(); }
      if (lbl) lbl.style.display = '';
    }

    okBtn.addEventListener('click', function () {
      if (!isLinux) { window.api.openExternal(info.releaseUrl); close(); return; }
      var pw = pwInput.value;
      if (!pw) { pwInput.focus(); return; }

      installing = true;
      okBtn.disabled = true; okBtn.textContent = L('UpdateWorking', 'Updating…');
      laterBtn.textContent = L('UpdateRunBackground', 'Run in background');
      closeX.disabled = true; pwInput.disabled = true; pwInput.style.display = 'none';
      if (lbl) lbl.style.display = 'none';
      status.style.color = 'var(--text-secondary)'; status.textContent = '';
      setProgress(0, 0);

      if (window.api.updater.onDownloadProgress) {
        unsubscribe = window.api.updater.onDownloadProgress(function (p) { setProgress(p.received, p.total); });
      }

      window.api.updater.install(info.assetUrl, info.assetName, pw).then(function (res) {
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        if (res && res.success) {
          progressBar.classList.remove('progress-indeterminate');
          progressFill.style.width = '100%';
          progressText.textContent = '';
          status.style.color = 'var(--color-success)';
          status.textContent = L('UpdateRestarting', 'Installed. Restarting…');
          if (backgrounded && toast) toast.setText(L('UpdateRestarting', 'Installed. Restarting…'));
        } else {
          var e = (res && res.error) || L('UpdateCheckFailed', 'Update failed');
          fail(/incorrect sudo password/i.test(e) ? L('UpdateWrongPassword', 'Incorrect computer password.') : e);
        }
      }).catch(function (err) {
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        fail((err && err.message) || L('UpdateCheckFailed', 'Update failed'));
      });
    });
  }

  var _checking = false;
  function check(opts) {
    opts = opts || {};
    if (_checking) return;
    _checking = true;
    if (opts.onStatus && opts.manual) opts.onStatus('checking', L('UpdateChecking', 'Checking for updates…'));
    window.api.updater.check().then(function (info) {
      _checking = false;
      if (info && info.available) {
        showAvailable(info);
        if (opts.onStatus) opts.onStatus('available', L('UpdateLatest', 'Latest') + ': v' + info.latest);
        return;
      }
      if (!opts.manual) return;
      var reason = info && info.reason;
      var kind = 'info', msg;
      if (reason === 'dev') msg = L('UpdateDevMode', 'Update check is disabled in development.');
      else if (reason === 'up-to-date') { kind = 'success'; msg = L('UpdateUpToDate', 'You are on the latest version.'); }
      else { kind = 'error'; msg = L('UpdateCheckFailed', 'Could not check for updates.') + (reason ? ' (' + reason + ')' : ''); }
      if (opts.onStatus) opts.onStatus(kind, msg);
    }).catch(function () {
      _checking = false;
      if (opts.manual && opts.onStatus) opts.onStatus('error', L('UpdateCheckFailed', 'Could not check for updates.'));
    });
  }

  window.UpdateUI = { check: check, showAvailable: showAvailable };
})();
