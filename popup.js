(function () {
  'use strict';

  var STORAGE_KEY     = 'cr_cache';
  var HISTORY_KEY     = 'cr_history';
  var currentFilter   = 'all';
  var currentProvider = 'all';
  var currentSearch   = '';
  var allRegions      = [];
  var cachedStatuses  = {};
  var cachedHistory   = {};
  var expandedCards   = {};
  var favorites       = {};
  var collapsedGroups = {};

  // ─── HELPERS ─────────────────────────────────────────────────────────────────
  function esc(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function timeAgo(ts) {
    if (!ts) return '';
    var d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60)    return 'just now';
    if (d < 3600)  return Math.floor(d/60) + ' min ago';
    if (d < 86400) return Math.floor(d/3600) + ' h ago';
    return new Date(ts).toLocaleDateString('en', {day:'numeric', month:'short'});
  }

  function fmtDate(str) {
    if (!str && str !== 0) return '';
    try {
      var d = (typeof str === 'number') ? new Date(str) : new Date(str);
      if (isNaN(d.getTime())) return str;
      return d.toLocaleDateString('en', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
    } catch(e) { return str; }
  }

  function calcUptime(history) {
    if (!history || history.length < 2) return null;
    var cutoff = Date.now() - 48 * 60 * 60 * 1000;
    var recent = history.filter(function(h) { return h.t && h.t >= cutoff; });
    if (recent.length < 2) recent = history.slice(-576);
    if (recent.length < 2) return null;
    var ok = recent.filter(function(h) { return h.s === 1; }).length;
    return Math.round((ok / recent.length) * 100);
  }

  var STATUS_LABELS = {
    ok:          'Operational',
    minor:       'Incident',
    major:       'Outage',
    maintenance: 'Maintenance',
    checking:    'Checking',
    unknown:     'Unknown'
  };

  // ─── SUMMARY ─────────────────────────────────────────────────────────────────
  function updateSummary(cache) {
    var ok = 0, minor = 0, major = 0, total = allRegions.length || 72;
    var withData = 0;
    Object.values(cache).forEach(function(s) {
      withData++;
      if      (s.status === 'ok')          ok++;
      else if (s.status === 'minor')       minor++;
      else if (s.status === 'major')       major++;
    });

    var dot  = document.getElementById('summary-dot');
    var text = document.getElementById('summary-text');
    var sd   = document.getElementById('stat-ok-n');
    var sm   = document.getElementById('stat-minor-n');
    var smj  = document.getElementById('stat-major-n');
    var st   = document.getElementById('stat-total');

    if (sd)  sd.textContent  = ok;
    if (sm)  sm.textContent  = minor;
    if (smj) smj.textContent = major;
    if (st)  st.textContent  = total + ' regions';

    if (!dot || !text) return;

    if (major > 0) {
      dot.className = 'summary-dot major';
      text.textContent = major + ' region' + (major > 1 ? 's' : '') + ' with outages';
    } else if (minor > 0) {
      dot.className = 'summary-dot minor';
      text.textContent = minor + ' region' + (minor > 1 ? 's' : '') + ' with incidents';
    } else if (withData > 0) {
      dot.className = 'summary-dot ok';
      text.textContent = 'All regions operational';
    } else {
      dot.className = 'summary-dot checking';
      text.textContent = 'Checking regions…';
    }
  }

  // ─── HISTORY BAR ─────────────────────────────────────────────────────────────
  function buildHistoryBar(history) {
    if (!history || history.length < 3) return null;
    var bar = document.createElement('div');
    bar.className = 'history-bar';
    bar.title = 'Last 24h';
    var raw = history.slice(-288);
    var step = Math.max(1, Math.floor(raw.length / 48));
    var segs = raw.filter(function(_, i) { return i % step === 0; }).slice(-48);
    segs.forEach(function(s) {
      var seg = document.createElement('div');
      var cls = s.s === 1 ? 'ok' : s.s === 2 ? 'minor' : s.s === 3 ? 'major' : s.s === 4 ? 'maint' : '';
      seg.className = 'hb-seg' + (cls ? ' ' + cls : '');
      bar.appendChild(seg);
    });
    return bar;
  }

  // ─── BUILD CARD ──────────────────────────────────────────────────────────────
  function buildCard(region, data) {
    var status    = (data && data.status)      || 'checking';
    var desc      = (data && data.description) || '';
    var incidents = (data && data.incidents)   || [];
    var ts        = data && data.checkedAt;
    var history   = cachedHistory[region.id];
    var pageUrl   = region.statusPageUrl || 'https://health.aws.amazon.com/health/status';
    var provider  = region.provider || 'aws';
    var providerLabels = { aws: 'AWS', gcp: 'GCP', azure: 'Azure' };
    var providerLabel  = providerLabels[provider] || provider.toUpperCase();

    var isGenericOk = !desc || desc === 'Todos los servicios operativos' || desc === 'All services operational';
    var uptime = calcUptime(history);

    var wrap = document.createElement('div');
    wrap.className = 'service-card-wrap';

    var card = document.createElement('div');
    card.className = 'service-card ' + status;
    if (incidents.length) card.classList.add('has-incidents');
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', region.name + ': ' + (STATUS_LABELS[status] || status));

    var iconEl = document.createElement('div');
    iconEl.className = 'region-icon';
    // BUG FIX #7: el regex original solo cubría prefijos AWS. Para GCP codes como
    // 'northamerica-northeast1', 'southamerica-east1', 'australia-southeast1' y
    // para Azure codes como 'eastus', 'westeurope' el shortCode quedaba igual de largo.
    // Ahora se extrae solo la parte más descriptiva para todos los providers.
    var shortCode;
    if (provider === 'gcp') {
      // GCP: 'us-central1' → 'central1', 'europe-west1' → 'west1',
      // 'northamerica-northeast1' → 'ne1', 'australia-southeast1' → 'se1'
      shortCode = region.code
        .replace(/^(northamerica|southamerica|australia)-/, '')
        .replace(/^(us|europe|asia|me)-/, '')
        .replace(/northeast/g, 'ne').replace(/southeast/g, 'se').replace(/central/g, 'c');
    } else if (provider === 'azure') {
      // Azure: 'eastus' → 'eus', 'westeurope' → 'weu', 'germanywestcentral' → 'gwc'
      shortCode = region.code
        .replace('central', 'c').replace('north', 'n').replace('south', 's')
        .replace('east', 'e').replace('west', 'w').replace('europe', 'eu')
        .replace('asia', 'as').replace('india', 'in').replace('japan', 'jp')
        .replace('korea', 'kr').replace('australia', 'au').replace('africa', 'af')
        .replace('germany', 'de').replace('france', 'fr').replace('sweden', 'se')
        .replace('canada', 'ca').replace('brazil', 'br').replace('uae', 'ae')
        .replace('uk', 'uk').slice(0, 6);
    } else {
      // AWS: 'us-east-1' → 'east', 'ap-southeast-2' → 'southeast'
      shortCode = region.code.replace(/^(us|eu|ap|sa|ca|me|af|il|mx)-/, '').replace(/-\d+$/, '');
    }
    if (region.flag && region.flag !== '🌐') {
      iconEl.innerHTML =
        '<div class="region-code-badge">' +
          '<span class="region-flag">' + region.flag + '</span>' +
          '<span class="region-code-text">' + esc(shortCode) + '</span>' +
        '</div>';
    } else {
      iconEl.innerHTML =
        '<div class="region-icon-aws">' +
          '<svg viewBox="0 0 80 50" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M22 35 L28 15 L34 35 M24 29 L32 29" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
            '<path d="M40 15 L40 35 M40 15 C40 15 52 15 52 22 C52 29 40 29 40 29 M40 29 C40 29 54 29 54 37" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
            '<path d="M60 15 L68 35 M76 15 L68 35 M62 28 L74 28" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
          '</svg>' +
          '<span class="region-code-text">' + esc(shortCode) + '</span>' +
        '</div>';
    }

    var info = document.createElement('div');
    info.className = 'service-info';

    var metaText = isGenericOk
      ? (ts ? timeAgo(ts) : '')
      : (desc ? esc(desc) + (ts ? ' · ' + timeAgo(ts) : '') : (ts ? timeAgo(ts) : ''));

    var uptimePill = '';
    if (uptime !== null) {
      var uptimeCls = uptime >= 99 ? 'uptime-ok' : uptime >= 95 ? 'uptime-minor' : 'uptime-major';
      uptimePill = '<span class="uptime-pill ' + uptimeCls + '">' + uptime + '%</span>';
    }

    info.innerHTML =
      '<div class="service-name">' + esc(region.name) + '</div>' +
      '<div class="service-meta">' +
        '<span class="region-code-label">' + esc(region.code) + '</span>' +
        '<span class="provider-badge ' + provider + '">' + providerLabel + '</span>' +
        uptimePill +
        '<span class="meta-desc">' + metaText + '</span>' +
      '</div>';

    var hBar = buildHistoryBar(history);
    if (hBar) info.appendChild(hBar);

    var badgeWrap = document.createElement('div');
    badgeWrap.className = 'badge-wrap';

    var badge = document.createElement('div');
    badge.className = 'status-badge ' + status;
    badge.innerHTML = '<span class="dot" aria-hidden="true"></span><span>' + esc(STATUS_LABELS[status] || status) + '</span>';
    badgeWrap.appendChild(badge);

    var extLink = document.createElement('a');
    extLink.href = pageUrl;
    extLink.target = '_blank';
    extLink.rel = 'noopener noreferrer';
    extLink.className = 'ext-link';
    extLink.title = providerLabel + ' Status Page';
    extLink.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    badgeWrap.appendChild(extLink);

    var pinBtn = document.createElement('button');
    pinBtn.className = 'pin-btn' + (favorites[region.id] ? ' pinned' : '');
    pinBtn.title = favorites[region.id] ? 'Unpin' : 'Pin to top';
    pinBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="' + (favorites[region.id] ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    pinBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: 'TOGGLE_FAVORITE', id: region.id }, function(resp) {
        if (chrome.runtime.lastError) return;
        if (resp && resp.favorites) { favorites = resp.favorites; renderList(); }
      });
    });
    badgeWrap.appendChild(pinBtn);

    card.appendChild(iconEl);
    card.appendChild(info);
    card.appendChild(badgeWrap);
    wrap.appendChild(card);

    // ── INCIDENTS PANEL ────────────────────────────────────────────────────────
    if (incidents.length) {
      var expanded = !!expandedCards[region.id];
      var panel = document.createElement('div');
      panel.className = 'incidents-panel' + (expanded ? ' open' : '');
      panel.setAttribute('aria-hidden', expanded ? 'false' : 'true');

      var hint = document.createElement('div');
      hint.className = 'expand-hint';
      hint.textContent = incidents.length + ' incident' + (incidents.length > 1 ? 's' : '') + ' · click to expand';
      // BUG FIX #3: hint debe estar oculto si el panel ya arranca expandido
      if (expanded) hint.style.display = 'none';
      card.appendChild(hint);

      incidents.forEach(function(inc) {
        var item = document.createElement('div');
        item.className = 'incident-item';
        item.innerHTML =
          '<div class="incident-title">' + esc(inc.name) + '</div>' +
          '<div>' +
            '<span class="incident-status">' + esc(inc.status) + '</span>' +
            (inc.updated ? '<span class="incident-time"> · ' + fmtDate(inc.updated) + '</span>' : '') +
          '</div>';
        panel.appendChild(item);
      });
      wrap.appendChild(panel);
      card.addEventListener('click', function(e) {
        if (e.target.closest('.ext-link') || e.target.closest('.pin-btn')) return;
        expandedCards[region.id] = !expandedCards[region.id];
        panel.classList.toggle('open', expandedCards[region.id]);
        panel.setAttribute('aria-hidden', expandedCards[region.id] ? 'false' : 'true');
        hint.style.display = expandedCards[region.id] ? 'none' : '';
      });
    }

    return wrap;
  }

  // ─── RENDER LIST ─────────────────────────────────────────────────────────────
  function renderList() {
    var list = document.getElementById('services-list');
    if (!allRegions.length) return;

    var children = Array.from(list.children);
    for (var _i = children.length - 1; _i >= 0; _i--) {
      if (children[_i].id !== 'loading-state') list.removeChild(children[_i]);
    }
    var loading = document.getElementById('loading-state');
    if (loading) loading.style.display = 'none';

    var s = currentSearch.toLowerCase().trim();

    var filtered = allRegions.filter(function(r) {
      var st = (cachedStatuses[r.id] || {}).status || 'checking';
      var mf = currentFilter === 'all'    ? true
             : currentFilter === 'ok'     ? st === 'ok'
             : currentFilter === 'issues' ? (st === 'minor' || st === 'major')
             : true;
      var mp = currentProvider === 'all' ? true : (r.provider || 'aws') === currentProvider;
      var ms = !s || r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s) || r.cat.toLowerCase().includes(s) || (r.flag && r.flag.includes(s));
      return mf && mp && ms;
    });

    if (!filtered.length) {
      var none = document.createElement('div');
      none.className = 'no-results';
      none.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;opacity:0.3;margin-bottom:8px"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
        '<div>' + (s ? 'No results for <strong>"' + esc(currentSearch) + '"</strong>' : 'No regions in this category') + '</div>';
      list.appendChild(none);
      return;
    }

    var STATUS_SORT = { major:0, minor:1, maintenance:2, unknown:3, checking:4, ok:5 };

    // ── PINNED ─────────────────────────────────────────────────────────────────
    var pinned = filtered.filter(function(r) { return favorites[r.id]; });
    if (pinned.length) {
      var pinnedLbl = document.createElement('div');
      pinnedLbl.className = 'group-label pinned-label';
      pinnedLbl.innerHTML = '<span class="group-flag">★</span> Pinned <span class="group-count">' + pinned.length + '</span>';
      list.appendChild(pinnedLbl);
      var pinnedSorted = pinned.slice().sort(function(a, b) {
        var ra = STATUS_SORT[(cachedStatuses[a.id] || {}).status];
        var rb = STATUS_SORT[(cachedStatuses[b.id] || {}).status];
        return (ra !== undefined ? ra : 4) - (rb !== undefined ? rb : 4);
      });
      pinnedSorted.forEach(function(r, idx) {
        var el = buildCard(r, cachedStatuses[r.id]);
        el.classList.add('service-card-wrap-anim');
        el.style.animationDelay = (idx * 25) + 'ms';
        list.appendChild(el);
      });
    }

    // ── BY CONTINENT ──────────────────────────────────────────────────────────
    var CAT_ORDER = ['North America', 'South America', 'Europe', 'Middle East', 'Africa', 'Asia Pacific', 'Australia & NZ'];
    var CAT_FLAGS = {
      'North America':  '🌎',
      'South America':  '🌎',
      'Europe':         '🌍',
      'Middle East':    '🌍',
      'Africa':         '🌍',
      'Asia Pacific':   '🌏',
      'Australia & NZ': '🌏'
    };

    var groups = {};
    filtered.forEach(function(r) {
      if (favorites[r.id]) return;
      if (!groups[r.cat]) groups[r.cat] = [];
      groups[r.cat].push(r);
    });

    function renderGroup(cat, regions, flag) {
      var isCollapsed = !!collapsedGroups[cat];
      var issueCount = regions.filter(function(r) {
        var st = (cachedStatuses[r.id] || {}).status;
        return st === 'major' || st === 'minor';
      }).length;

      var lbl = document.createElement('div');
      lbl.className = 'group-label group-collapsible' + (isCollapsed ? ' collapsed' : '');
      lbl.setAttribute('role', 'button');
      lbl.setAttribute('tabindex', '0');
      lbl.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      lbl.title = isCollapsed ? 'Expand' : 'Collapse';

      var countBadge = issueCount > 0
        ? '<span class="group-issues">' + issueCount + ' alert' + (issueCount > 1 ? 's' : '') + '</span>'
        : '<span class="group-count">' + regions.length + '</span>';

      lbl.innerHTML =
        '<span class="group-flag">' + (flag || '🌐') + '</span>' +
        '<span class="group-name">' + esc(cat) + '</span>' +
        countBadge +
        '<span class="group-chevron" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</span>';
      list.appendChild(lbl);

      var body = document.createElement('div');
      body.className = 'group-body' + (isCollapsed ? ' group-body-hidden' : '');
      list.appendChild(body);

      var sorted = regions.slice().sort(function(a, b) {
        var ra = STATUS_SORT[(cachedStatuses[a.id] || {}).status];
        var rb = STATUS_SORT[(cachedStatuses[b.id] || {}).status];
        return (ra !== undefined ? ra : 4) - (rb !== undefined ? rb : 4);
      });

      sorted.forEach(function(r, idx) {
        var el = buildCard(r, cachedStatuses[r.id]);
        if (!isCollapsed) {
          el.classList.add('service-card-wrap-anim');
          el.style.animationDelay = (idx * 20) + 'ms';
        }
        body.appendChild(el);
      });

      function toggle() {
        var isHidden = body.classList.contains('group-body-hidden');
        if (isHidden) {
          body.classList.remove('group-body-hidden');
          body.style.opacity = '0';
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              body.style.transition = 'opacity 0.18s ease';
              body.style.opacity = '1';
              setTimeout(function() {
                body.style.transition = '';
                body.style.opacity = '';
              }, 200);
            });
          });
          delete collapsedGroups[cat];
          lbl.classList.remove('collapsed');
          lbl.setAttribute('aria-expanded', 'true');
          lbl.title = 'Collapse';
          Array.from(body.children).forEach(function(el, idx) {
            el.classList.add('service-card-wrap-anim');
            el.style.animationDelay = (idx * 18) + 'ms';
          });
        } else {
          body.style.opacity = '0';
          body.style.transition = 'opacity 0.15s ease';
          setTimeout(function() {
            body.classList.add('group-body-hidden');
            body.style.opacity = '';
            body.style.transition = '';
          }, 160);
          collapsedGroups[cat] = true;
          lbl.classList.add('collapsed');
          lbl.setAttribute('aria-expanded', 'false');
          lbl.title = 'Expand';
        }
        chrome.storage.local.set({ cr_collapsed: collapsedGroups });
      }

      lbl.addEventListener('click', toggle);
      lbl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    }

    CAT_ORDER.forEach(function(cat) {
      if (!groups[cat] || !groups[cat].length) return;
      renderGroup(cat, groups[cat], CAT_FLAGS[cat]);
    });

    Object.keys(groups).forEach(function(cat) {
      if (CAT_ORDER.includes(cat)) return;
      renderGroup(cat, groups[cat], '🌐');
    });
  }

  // ─── LOAD DATA ───────────────────────────────────────────────────────────────
  var _lastCheckTs = 0;

  function updateSummaryTime() {
    var timeEl = document.getElementById('summary-time');
    if (timeEl && _lastCheckTs) timeEl.textContent = timeAgo(_lastCheckTs);
  }
  setInterval(updateSummaryTime, 30000);

  function loadData() {
    chrome.storage.local.get([STORAGE_KEY, HISTORY_KEY, 'cr_favorites', 'cr_collapsed'], function(stored) {
      favorites       = stored.cr_favorites  || {};
      cachedStatuses  = stored[STORAGE_KEY]  || {};
      cachedHistory   = stored[HISTORY_KEY]  || {};
      collapsedGroups = stored.cr_collapsed  || {};
      var lastCheck = Object.values(cachedStatuses)
        .reduce(function(acc, s) { return s.checkedAt > acc ? s.checkedAt : acc; }, 0);
      _lastCheckTs = lastCheck;
      var timeEl = document.getElementById('summary-time');
      if (timeEl && lastCheck) timeEl.textContent = timeAgo(lastCheck);
      updateSummary(cachedStatuses);
      renderList();
    });
  }

  // ─── THEME ───────────────────────────────────────────────────────────────────
  function applyTheme(theme) {
    document.body.classList.toggle('theme-light', theme === 'light');
    var btnD = document.getElementById('btn-theme-dark');
    var btnL = document.getElementById('btn-theme-light');
    if (btnD) btnD.classList.toggle('active', theme !== 'light');
    if (btnL) btnL.classList.toggle('active', theme === 'light');
  }

  // ─── TOAST ───────────────────────────────────────────────────────────────────
  function showToast(msg, type) {
    var t = document.getElementById('copy-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'copy-toast';
      t.className = 'copy-toast';
      document.getElementById('app').appendChild(t);
    }
    t.textContent = msg;
    t.className = 'copy-toast' + (type ? ' toast-' + type : '');
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
  }

  // ─── EXPORT ──────────────────────────────────────────────────────────────────
  function exportSummary() {
    var lines = ['CloudRadar — Multi-Cloud Status (AWS · GCP · Azure)\n' + new Date().toLocaleString('en')];
    var pinnedRegions = allRegions.filter(function(r) { return favorites[r.id]; });
    if (pinnedRegions.length) {
      lines.push('\n★ Pinned');
      pinnedRegions.forEach(function(r) {
        var st = (cachedStatuses[r.id] || {}).status || '?';
        var emoji = st === 'ok' ? '✅' : st === 'minor' ? '⚠️' : st === 'major' ? '🔴' : '⚙️';
        lines.push(emoji + ' [' + (r.provider || 'aws').toUpperCase() + '] ' + r.name + ' (' + r.code + ')');
      });
    }
    var cats = {};
    allRegions.forEach(function(r) {
      if (favorites[r.id]) return;
      if (!cats[r.cat]) cats[r.cat] = [];
      cats[r.cat].push(r);
    });
    var EXPORT_CAT_ORDER = ['North America', 'South America', 'Europe', 'Middle East', 'Africa', 'Asia Pacific', 'Australia & NZ'];
    var orderedCats = EXPORT_CAT_ORDER.filter(function(c) { return cats[c]; })
      .concat(Object.keys(cats).filter(function(c) { return !EXPORT_CAT_ORDER.includes(c); }));
    orderedCats.forEach(function(cat) {
      lines.push('\n' + cat);
      cats[cat].forEach(function(r) {
        var st = (cachedStatuses[r.id] || {}).status || '?';
        var emoji = st === 'ok' ? '✅' : st === 'minor' ? '⚠️' : st === 'major' ? '🔴' : '⚙️';
        lines.push(emoji + ' [' + (r.provider || 'aws').toUpperCase() + '] ' + r.name + ' (' + r.code + ')');
      });
    });
    navigator.clipboard.writeText(lines.join('\n')).then(function() {
      showToast('✓ Summary copied', 'ok');
    }).catch(function() {
      showToast('Could not copy', 'error');
    });
  }

  // ─── INIT ────────────────────────────────────────────────────────────────────
  function init() {
    chrome.storage.local.get(['cr_theme', 'cr_interval'], function(prefs) {
      var theme    = prefs.cr_theme    || 'dark';
      var interval = prefs.cr_interval || 5;
      applyTheme(theme);

      var selInterval = document.getElementById('select-interval');
      if (selInterval) selInterval.value = String(interval);

      chrome.runtime.sendMessage({ type: 'PING' }, function() {
        void chrome.runtime.lastError;
        loadRegionsWithRetry();
      });

      function loadRegionsWithRetry(attempt) {
        attempt = attempt || 1;
        chrome.runtime.sendMessage({ type: 'GET_REGIONS' }, function(resp) {
          if (chrome.runtime.lastError || !resp || !resp.regions || !resp.regions.length) {
            if (attempt < 5) {
              var delay = Math.min(400 * Math.pow(1.5, attempt - 1), 3000);
              setTimeout(function() { loadRegionsWithRetry(attempt + 1); }, delay);
            } else {
              loadData();
            }
            return;
          }
          allRegions = resp.regions;
          loadData();
        });
      }
    });

    // ── FILTER TABS ──────────────────────────────────────────────────────────────
    document.querySelectorAll('.tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        currentFilter = btn.getAttribute('data-filter');
        renderList();
      });
    });

    // ── PROVIDER TABS ─────────────────────────────────────────────────────────────
    var brandTag = document.querySelector('.brand-tag');
    document.querySelectorAll('.ptab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.ptab').forEach(function(t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        currentProvider = btn.getAttribute('data-provider');
        // BUG FIX #4: actualizar el brand-tag del header según el provider activo
        if (brandTag) {
          var labels = { all: 'AWS · GCP · Azure', aws: 'AWS', gcp: 'GCP', azure: 'Azure' };
          brandTag.textContent = labels[currentProvider] || 'AWS';
        }
        renderList();
      });
    });

    // ── SEARCH ───────────────────────────────────────────────────────────────────
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
      function onSearchChange() {
        currentSearch = searchInput.value;
        renderList();
      }
      searchInput.addEventListener('input', onSearchChange);
      searchInput.addEventListener('search', onSearchChange);
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          searchInput.value = '';
          currentSearch = '';
          renderList();
          searchInput.blur();
        }
      });
    }

    // ── REFRESH ──────────────────────────────────────────────────────────────────
    var btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', function() {
        if (btnRefresh.classList.contains('spinning')) return;
        btnRefresh.classList.add('spinning');
        var safetyTimer = setTimeout(function() { btnRefresh.classList.remove('spinning'); }, 8000);
        chrome.runtime.sendMessage({ type: 'REFRESH' }, function(resp) {
          clearTimeout(safetyTimer);
          btnRefresh.classList.remove('spinning');
          if (resp && resp.cache) {
            cachedStatuses = resp.cache;
            var lastCheck = Object.values(cachedStatuses)
              .reduce(function(acc, s) { return s.checkedAt > acc ? s.checkedAt : acc; }, 0);
            _lastCheckTs = lastCheck;
            updateSummaryTime();
            updateSummary(cachedStatuses);
            renderList();
            showToast('✓ Updated', 'ok');
          }
        });
      });
    }

    // ── SETTINGS ─────────────────────────────────────────────────────────────────
    var btnSettings      = document.getElementById('btn-settings');
    var panelSettings    = document.getElementById('panel-settings');
    var btnSettingsClose = document.getElementById('btn-settings-close');

    if (btnSettings && panelSettings) {
      btnSettings.addEventListener('click', function() { panelSettings.classList.add('open'); });
    }
    if (btnSettingsClose && panelSettings) {
      btnSettingsClose.addEventListener('click', function() { panelSettings.classList.remove('open'); });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && panelSettings && panelSettings.classList.contains('open')) {
        panelSettings.classList.remove('open');
        return;
      }
      if ((e.key === 'r' || e.key === 'R') &&
          document.activeElement !== searchInput &&
          panelSettings && !panelSettings.classList.contains('open')) {
        var rbtn = document.getElementById('btn-refresh');
        if (rbtn && !rbtn.classList.contains('spinning')) rbtn.click();
      }
    });

    var btnThemeDark  = document.getElementById('btn-theme-dark');
    var btnThemeLight = document.getElementById('btn-theme-light');
    if (btnThemeDark) {
      btnThemeDark.addEventListener('click', function() {
        chrome.storage.local.set({ cr_theme: 'dark' });
        applyTheme('dark');
      });
    }
    if (btnThemeLight) {
      btnThemeLight.addEventListener('click', function() {
        chrome.storage.local.set({ cr_theme: 'light' });
        applyTheme('light');
      });
    }

    var selInterval = document.getElementById('select-interval');
    if (selInterval) {
      selInterval.addEventListener('change', function() {
        var val = parseInt(selInterval.value, 10) || 5;
        chrome.runtime.sendMessage({ type: 'SET_INTERVAL', interval: val });
        showToast('Interval: every ' + val + ' min');
      });
    }

    var btnExport = document.getElementById('btn-export');
    if (btnExport) { btnExport.addEventListener('click', exportSummary); }

    // ── LIVE STATUS UPDATES ───────────────────────────────────────────────────────
    chrome.runtime.onMessage.addListener(function(msg) {
      if (msg.type === 'STATUS_UPDATE' && msg.cache) {
        cachedStatuses = msg.cache;
        var lastCheck = Object.values(cachedStatuses)
          .reduce(function(acc, s) { return s.checkedAt > acc ? s.checkedAt : acc; }, 0);
        _lastCheckTs = lastCheck;
        chrome.storage.local.get([HISTORY_KEY, 'cr_favorites', 'cr_collapsed'], function(stored) {
          cachedHistory   = stored[HISTORY_KEY]   || {};
          favorites       = stored.cr_favorites   || {};
          collapsedGroups = stored.cr_collapsed   || {};
          updateSummaryTime();
          updateSummary(cachedStatuses);
          renderList();
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

})();
