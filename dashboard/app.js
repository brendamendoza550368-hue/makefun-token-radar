// Launch Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, one detail view per protocol with the model's arithmetic and the farm plan
// exactly as board.json carries it, the live-token set the multiples were calibrated from, and the
// method page. No network: every byte it shows is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  var main = document.getElementById('board');

  // ---------- formatting ----------
  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function fmtPct(n) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30.4) + ' mo';
    return (days / 365).toFixed(1) + ' yrs';
  }
  function fmtMult(n) { return n.toFixed(2) + '×'; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---------- state ----------
  var params = new URLSearchParams(location.search);
  var state = {
    view: params.get('view') || 'board',
    slug: params.get('slug') || null,
    q: params.get('q') || '',
    category: params.get('cat') || '',
    chain: params.get('chain') || '',
    watchOnly: params.get('watch') === '1',
    minTvl: Number(params.get('min') || 0),
    sortKey: 'rank',
    sortDir: 1,
  };

  var bySlug = {};
  DATA.rows.forEach(function (r) { bySlug[r.slug] = r; });

  function categories() {
    var seen = {};
    DATA.rows.forEach(function (r) { if (r.category) seen[r.category] = 1; });
    return Object.keys(seen).sort();
  }
  function chains() {
    var seen = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { seen[c] = 1; }); });
    return Object.keys(seen).sort();
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
  }

  var SORTS = {
    rank: function (a, b) { return a.rank - b.rank; },
    implied: function (a, b) { return a.implied_value_usd - b.implied_value_usd; },
    tvl: function (a, b) { return a.tvl_usd - b.tvl_usd; },
    growth: function (a, b) { return (a.change_7d || 0) - (b.change_7d || 0); },
    age: function (a, b) { return (a.age_days || 0) - (b.age_days || 0); },
    multiple: function (a, b) { return a.category_multiple - b.category_multiple; },
  };

  // ---------- chrome ----------
  function header() {
    var h = el('header', 'mast');
    var left = el('div');
    left.appendChild(el('div', 'brand', '◉ LAUNCH RADAR'));
    left.appendChild(el('div', 'tagline', 'Pre-token protocols ranked by implied value — every figure from one sealed snapshot, no name special-cased.'));
    h.appendChild(left);
    var stats = el('div', 'mast-stats');
    [
      [DATA.board_size, 'protocols ranked'],
      [DATA.watchlist_size + '/' + DATA.watchlist_size, 'watchlist covered'],
      [DATA.traded_protocols, 'traded peers calibrated'],
      [DATA.as_of, 'snapshot date'],
    ].forEach(function (pair) {
      var s = el('div', 'mast-stat');
      s.appendChild(el('div', 'mast-num', String(pair[0])));
      s.appendChild(el('div', 'mast-lab', pair[1]));
      stats.appendChild(s);
    });
    h.appendChild(stats);
    var nav = el('nav', 'views');
    [['board', 'Board'], ['live', 'Live tokens'], ['method', 'Method & calibration']].forEach(function (v) {
      var b = el('button', 'view-btn' + (state.view === v[0] || (v[0] === 'board' && state.view === 'detail') ? ' on' : ''), v[1]);
      b.addEventListener('click', function () { state.view = v[0]; state.slug = null; render(); });
      nav.appendChild(b);
    });
    h.appendChild(nav);
    return h;
  }

  function footer() {
    var f = el('footer', 'foot');
    f.textContent = 'Model ' + DATA.model_version + ' · Implied value is this board\u2019s own claim from the snapshot\u2019s figures, not a prediction that a token will be issued. Source: ' + DATA.source;
    return f;
  }

  function toolbar() {
    var bar = el('div', 'toolbar');
    var search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search protocols…';
    search.value = state.q;
    search.className = 'search';
    search.addEventListener('input', function () { state.q = search.value; renderTable(); });
    bar.appendChild(search);

    function select(allLabel, values, current, onPick) {
      var s = document.createElement('select');
      s.className = 'sel';
      var o = document.createElement('option');
      o.value = ''; o.textContent = allLabel;
      s.appendChild(o);
      values.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        if (v === current) opt.selected = true;
        s.appendChild(opt);
      });
      s.addEventListener('change', function () { onPick(s.value); renderTable(); });
      return s;
    }
    bar.appendChild(select('All categories', categories(), state.category, function (v) { state.category = v; }));
    bar.appendChild(select('All chains', chains(), state.chain, function (v) { state.chain = v; }));
    bar.appendChild(select('Any TVL', ['$50M+', '$100M+', '$500M+', '$1B+'],
      state.minTvl ? '$' + (state.minTvl / 1e6) + 'M+' : '',
      function (v) { state.minTvl = v === '' ? 0 : Number(v.replace(/[^0-9]/g, '')) * 1e6; }));
    var wl = el('label', 'watch-toggle');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = state.watchOnly;
    cb.addEventListener('change', function () { state.watchOnly = cb.checked; renderTable(); });
    wl.appendChild(cb);
    wl.appendChild(document.createTextNode(' Watchlist only'));
    bar.appendChild(wl);
    var count = el('span', 'row-count');
    count.id = 'row-count';
    bar.appendChild(count);
    return bar;
  }

  // ---------- board ----------
  var tableWrap = null;
  function boardView() {
    var frag = document.createDocumentFragment();
    frag.appendChild(header());
    frag.appendChild(toolbar());
    tableWrap = el('div', 'table-wrap');
    frag.appendChild(tableWrap);
    frag.appendChild(footer());
    main.appendChild(frag);
    renderTable();
  }

  function renderTable() {
    if (!tableWrap) return;
    var sorter = SORTS[state.sortKey] || SORTS.rank;
    var rows = filtered().slice().sort(function (a, b) { return sorter(a, b) * state.sortDir; });
    var count = document.getElementById('row-count');
    if (count) count.textContent = rows.length + ' of ' + DATA.board_size + ' protocols';
    var t = el('table', 'board');
    var thead = el('thead');
    var trh = el('tr');
    var cols = [
      ['rank', '#'], ['name', 'Protocol'], ['chains', 'Chains'], ['tvl', 'TVL'],
      ['growth', '7d'], ['age', 'Age'], ['multiple', 'Multiple'], ['implied', 'Implied value'],
    ];
    cols.forEach(function (c) {
      var th = el('th', '', c[1]);
      if (SORTS[c[0]]) {
        th.className = 'sortable';
        th.addEventListener('click', function () {
          if (state.sortKey === c[0]) state.sortDir *= -1;
          else { state.sortKey = c[0]; state.sortDir = c[0] === 'rank' ? 1 : -1; }
          renderTable();
        });
        if (state.sortKey === c[0]) th.textContent = c[1] + (state.sortDir === 1 ? ' ↑' : ' ↓');
      }
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    t.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr', 'row');
      tr.addEventListener('click', function () { state.view = 'detail'; state.slug = r.slug; render(); });
      tr.appendChild(el('td', 'num rank', String(r.rank)));
      var nameTd = el('td', 'name');
      nameTd.appendChild(el('span', 'pname', r.name));
      if (r.watchlist) nameTd.appendChild(el('span', 'badge', 'WATCHLIST'));
      nameTd.appendChild(el('div', 'pcat', r.category || 'Uncategorized'));
      tr.appendChild(nameTd);
      tr.appendChild(el('td', 'chains', r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '')));
      tr.appendChild(el('td', 'num', fmtUsd(r.tvl_usd)));
      tr.appendChild(el('td', 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), fmtPct(r.change_7d)));
      tr.appendChild(el('td', 'num', fmtAge(r.age_days)));
      tr.appendChild(el('td', 'num', fmtMult(r.category_multiple)));
      tr.appendChild(el('td', 'num implied', fmtUsd(r.implied_value_usd)));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    tableWrap.textContent = '';
    tableWrap.appendChild(t);
  }

  // ---------- detail ----------
  function bar(label, valueText, frac) {
    var row = el('div', 'bar-row');
    row.appendChild(el('span', 'bar-lab', label));
    var track = el('div', 'bar-track');
    var fill = el('div', 'bar-fill');
    fill.style.width = Math.max(2, Math.min(100, frac * 100)) + '%';
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el('span', 'bar-val', valueText));
    return row;
  }

  function detailView() {
    var r = bySlug[state.slug];
    var frag = document.createDocumentFragment();
    frag.appendChild(header());
    if (!r) {
      frag.appendChild(el('p', 'empty', 'That protocol is not on the board.'));
      main.appendChild(frag);
      return;
    }
    var back = el('button', 'back', '← Back to the board');
    back.addEventListener('click', function () { state.view = 'board'; state.slug = null; render(); });
    frag.appendChild(back);

    var head = el('div', 'detail-head');
    var title = el('div');
    title.appendChild(el('span', 'detail-rank', '#' + r.rank));
    title.appendChild(el('span', 'detail-name', r.name));
    if (r.watchlist) title.appendChild(el('span', 'badge', 'WATCHLIST'));
    title.appendChild(el('div', 'pcat', (r.category || 'Uncategorized') + ' · ' + r.chains.join(', ') + ' · tracked since ' + (r.listed_at || 'unknown')));
    head.appendChild(title);
    var big = el('div', 'detail-implied');
    big.appendChild(el('div', 'mast-num big', fmtUsd(r.implied_value_usd)));
    big.appendChild(el('div', 'mast-lab', 'implied value'));
    head.appendChild(big);
    frag.appendChild(head);

    var grid = el('div', 'stat-grid');
    [
      ['TVL', fmtUsd(r.tvl_usd)],
      ['7-day TVL change', fmtPct(r.change_7d)],
      ['Age with no token', fmtAge(r.age_days)],
      ['Category multiple', fmtMult(r.category_multiple)],
    ].forEach(function (pair) {
      var s = el('div', 'stat');
      s.appendChild(el('div', 'stat-val', pair[1]));
      s.appendChild(el('div', 'mast-lab', pair[0]));
      grid.appendChild(s);
    });
    frag.appendChild(grid);

    var model = el('section', 'panel');
    model.appendChild(el('h2', '', 'How the model values ' + r.name));
    var eq = el('p', 'equation',
      'implied = TVL × category multiple × growth × maturity = ' +
      fmtUsd(r.tvl_usd) + ' × ' + fmtMult(r.category_multiple) + ' × ' +
      r.growth_multiplier.toFixed(2) + '× × ' + r.maturity_multiplier.toFixed(2) + '× = ' + fmtUsd(r.implied_value_usd));
    model.appendChild(eq);
    model.appendChild(bar('Category multiple (' + (r.multiple_calibrated ? 'median of ' + r.multiple_peers + ' traded ' + (r.category || '') + ' peers' : 'universe median — only ' + r.multiple_peers + ' traded peers in this category') + ')', fmtMult(r.category_multiple), r.category_multiple / 3));
    model.appendChild(bar('Growth multiplier (7d change ' + fmtPct(r.change_7d) + ')', r.growth_multiplier.toFixed(2) + '×', (r.growth_multiplier - 0.7) / 0.9));
    model.appendChild(bar('Maturity multiplier (age ' + fmtAge(r.age_days) + ')', r.maturity_multiplier.toFixed(2) + '×', r.maturity_multiplier - 0.6));
    model.appendChild(el('p', 'note', 'The multiple is the median market-cap / TVL ratio of the snapshot\u2019s own traded protocols in this category, clamped to [0.05×, 3×]. It is a comparables figure, not a forecast.'));
    frag.appendChild(model);

    var farm = el('section', 'panel');
    farm.appendChild(el('h2', '', 'Farm plan'));
    var ol = el('ol', 'farm');
    r.farm_steps.forEach(function (s) {
      ol.appendChild(el('li', '', s));
    });
    farm.appendChild(ol);
    frag.appendChild(farm);
    frag.appendChild(footer());
    main.appendChild(frag);
  }

  // ---------- live tokens ----------
  function liveView() {
    var frag = document.createDocumentFragment();
    frag.appendChild(header());
    var intro = el('p', 'intro', 'These protocols already trade, so the board never ranks them: it shows the market\u2019s own value. Their market-cap / TVL ratios are the raw material the model calibrates each category\u2019s multiple from — the radar\u2019s pre-token values are comparables against this set.');
    frag.appendChild(intro);
    var t = el('table', 'board');
    var thead = el('thead');
    var trh = el('tr');
    ['Protocol', 'Chains', 'TVL', 'Market cap', 'Mcap / TVL', '7d'].forEach(function (h) { trh.appendChild(el('th', '', h)); });
    thead.appendChild(trh);
    t.appendChild(thead);
    var tb = el('tbody');
    DATA.live.forEach(function (r) {
      var tr = el('tr');
      var nameTd = el('td', 'name');
      nameTd.appendChild(el('span', 'pname', r.name));
      nameTd.appendChild(el('div', 'pcat', r.category || 'Uncategorized'));
      tr.appendChild(nameTd);
      tr.appendChild(el('td', 'chains', r.chains.slice(0, 3).join(', ')));
      tr.appendChild(el('td', 'num', fmtUsd(r.tvl_usd)));
      tr.appendChild(el('td', 'num implied', fmtUsd(r.mcap_usd)));
      tr.appendChild(el('td', 'num', r.multiple === null ? '—' : fmtMult(r.multiple)));
      tr.appendChild(el('td', 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), fmtPct(r.change_7d)));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    var wrap = el('div', 'table-wrap');
    wrap.appendChild(t);
    frag.appendChild(wrap);
    frag.appendChild(footer());
    main.appendChild(frag);
  }

  // ---------- method ----------
  function methodView() {
    var frag = document.createDocumentFragment();
    frag.appendChild(header());
    var s1 = el('section', 'panel');
    s1.appendChild(el('h2', '', 'The model'));
    s1.appendChild(el('p', '', 'implied = TVL × category multiple × growth multiplier × maturity multiplier. The growth multiplier is 1 + (clamped 7-day TVL change / 100) × 0.5, with the change clamped to [−60%, +120%]. The maturity multiplier runs from 0.6× for a brand-new listing to 1.0× at three years tracked with no token: the longer a protocol has operated tokenless at size, the more of its TVL the model credits. A protocol whose listing date is unknown is scored as one year old.'));
    s1.appendChild(el('p', '', 'The category multiple is calibrated from the snapshot itself at run time: for every traded protocol, market cap ÷ TVL; a category\u2019s multiple is the median of its traded protocols\u2019 ratios, clamped to [0.05×, 3×]. Categories with fewer than three traded peers use the universe median (' + fmtMult(DATA.fallback_multiple) + ' from ' + DATA.traded_protocols + ' traded protocols) and are marked as fallback in the table below. Nothing is hardcoded per protocol: change the snapshot and every figure moves.'));
    frag.appendChild(s1);

    var s2 = el('section', 'panel');
    s2.appendChild(el('h2', '', 'Who is on the board, and who is not'));
    s2.appendChild(el('p', '', 'A protocol is pre-token when its record carries no token: no market cap, no CoinGecko id, no symbol. The board ranks every pre-token protocol except wrapped, staked or bridged products of a token that already trades, exchange house products, and versioned pools of another protocol — the same exclusions the snapshot\u2019s watchlist states, applied to the whole universe. All ' + DATA.watchlist_size + ' watchlist protocols are on the board (the floor), plus ' + DATA.early_size + ' earlier finds below the $' + (DATA.floor_usd / 1e6) + 'M floor. Traded protocols are never ranked: they appear on the Live tokens page at market value.'));
    s2.appendChild(el('p', '', 'Read the record carefully: the snapshot says a protocol records no token, never that it has none — a token DefiLlama does not carry would not appear here.'));
    frag.appendChild(s2);

    var s3 = el('section', 'panel');
    s3.appendChild(el('h2', '', 'Calibration table — the multiples this run used'));
    var t = el('table', 'board calib');
    var thead = el('thead');
    var trh = el('tr');
    ['Category', 'Multiple', 'Traded peers', 'Basis'].forEach(function (h) { trh.appendChild(el('th', '', h)); });
    thead.appendChild(trh);
    t.appendChild(thead);
    var tb = el('tbody');
    DATA.calibration.forEach(function (c) {
      var tr = el('tr');
      tr.appendChild(el('td', '', c.category));
      tr.appendChild(el('td', 'num', fmtMult(c.multiple)));
      tr.appendChild(el('td', 'num', String(c.peers)));
      tr.appendChild(el('td', '', c.calibrated ? 'category median' : 'universe fallback'));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    s3.appendChild(t);
    frag.appendChild(s3);
    frag.appendChild(footer());
    main.appendChild(frag);
  }

  // ---------- render ----------
  function render() {
    main.textContent = '';
    tableWrap = null;
    if (state.view === 'detail') detailView();
    else if (state.view === 'live') liveView();
    else if (state.view === 'method') methodView();
    else boardView();
    main.removeAttribute('aria-busy');
    window.scrollTo(0, 0);
  }

  render();
})();
