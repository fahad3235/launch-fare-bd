// launch-fare-bd -- UI wiring (browser only; logic lives in js/logic.js).
(function () {
  'use strict';
  const DATA = window.__LFBD_DATA;
  const LS_CALCS = 'lfbd_calcs_v1';
  const LS_LANG = 'lfbd_lang';
  const BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

  const state = {
    lang: localStorage.getItem(LS_LANG) || 'en',
    calcs: loadCalcs(),
    lastCalc: null,
  };

  function loadCalcs() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_CALCS) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter((c) => validateCalculation(c).ok);
    } catch (e) { return []; }
  }
  function saveCalcs() { localStorage.setItem(LS_CALCS, JSON.stringify(state.calcs)); }

  function t(key) {
    const pack = (window.I18N && window.I18N[state.lang]) || window.I18N.en;
    return pack[key] !== undefined ? pack[key] : (window.I18N.en[key] || key);
  }
  function toBnDigits(s) {
    if (state.lang !== 'bn') return s;
    return String(s).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
  }
  function fmt(n) {
    if (typeof n === 'number' && !Number.isInteger(n)) {
      return toBnDigits(n.toLocaleString('en-US', { maximumFractionDigits: 1 }));
    }
    return toBnDigits(Number(n).toLocaleString('en-US'));
  }
  function money(n) { return fmt(n) + ' ' + (state.lang === 'bn' ? '\u099f\u09be\u0995\u09be' : 'Tk'); }
  // Range fares (e.g. 100-150) must not go through money(): Number('100-150') is NaN.
  function fareDisplay(fare) {
    if (fare === null || fare === undefined) return '';
    if (typeof fare === 'number') return money(fare);
    return toBnDigits(fare[0]) + '-' + toBnDigits(fare[1]) + ' ' + (state.lang === 'bn' ? '\u099f\u09be\u0995\u09be' : 'Tk');
  }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function stationName(id) { return t('station_' + id); }
  function className(id) { return t('class_' + id); }
  function routeLabel(r) {
    return stationName(r.from) + ' - ' + stationName(r.to) + (r.steamer ? ' (PS Mahsud)' : '');
  }

  // ---- tabs ----
  function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    if (name === 'data') renderSaved();
    if (name === 'table') renderTable();
  }
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ---- calculator selects (preserve the current choice across re-renders,
  // e.g. a language toggle must not reset the user's route/class) ----
  function fillStations() {
    const prevFrom = $('fromSelect').value, prevTo = $('toSelect').value;
    for (const id of ['fromSelect', 'toSelect']) {
      const sel = $(id);
      sel.innerHTML = '';
      for (const s of DATA.STATIONS) {
        const o = document.createElement('option');
        o.value = s.id; o.textContent = stationName(s.id);
        sel.appendChild(o);
      }
    }
    $('fromSelect').value = DATA.STATIONS.some((s) => s.id === prevFrom) ? prevFrom : 'dhaka';
    $('toSelect').value = DATA.STATIONS.some((s) => s.id === prevTo) ? prevTo : 'barisal';
  }
  function fillRoutes() {
    const prev = $('routeSelect').value;
    const from = $('fromSelect').value, to = $('toSelect').value;
    const routes = routesForPair(from, to);
    const sel = $('routeSelect');
    sel.innerHTML = '';
    for (const r of routes) {
      const o = document.createElement('option');
      o.value = r.id; o.textContent = routeLabel(r) + ' (' + r.duration + ')';
      sel.appendChild(o);
    }
    if (prev && routes.some((r) => r.id === prev)) sel.value = prev;
    fillClasses();
  }
  function fillClasses() {
    const prev = $('classSelect').value;
    const sel = $('classSelect');
    const routeId = $('routeSelect').value;
    sel.innerHTML = '';
    const classes = classesForRoute(routeId);
    for (const c of classes) {
      const o = document.createElement('option');
      o.value = c.id;
      const fare = fareFor(routeId, c.id);
      o.textContent = className(c.id) + ' - ' + fareDisplay(fare);
      sel.appendChild(o);
    }
    if (prev && classes.some((c) => c.id === prev)) sel.value = prev;
  }
  $('fromSelect').addEventListener('change', fillRoutes);
  $('toSelect').addEventListener('change', fillRoutes);
  $('routeSelect').addEventListener('change', fillClasses);
  $('swapBtn').addEventListener('click', () => {
    const a = $('fromSelect').value;
    $('fromSelect').value = $('toSelect').value;
    $('toSelect').value = a;
    fillRoutes();
  });

  function readCalc() {
    return {
      from: $('fromSelect').value, to: $('toSelect').value,
      routeId: $('routeSelect').value, classId: $('classSelect').value,
      adults: parseInt($('adultsInput').value, 10),
      children512: parseInt($('children512Input').value, 10),
      under5: parseInt($('under5Input').value, 10),
    };
  }
  function applyCalc(c) {
    $('fromSelect').value = c.from; $('toSelect').value = c.to;
    fillRoutes();
    $('routeSelect').value = c.routeId;
    fillClasses();
    $('classSelect').value = c.classId;
    $('adultsInput').value = c.adults;
    $('children512Input').value = c.children512;
    $('under5Input').value = c.under5;
  }
  $('calcBtn').addEventListener('click', () => {
    const c = readCalc();
    const r = calculate(c);
    $('calcError').hidden = true;
    $('saveMsg').hidden = true;
    if (!r.ok) {
      $('resultBox').hidden = true;
      $('calcError').textContent = t(r.error);
      $('calcError').hidden = false;
      return;
    }
    state.lastCalc = c;
    const b = r.breakdown;
    const route = routeById(c.routeId);
    $('resultRoute').textContent = routeLabel(route) + '  |  ' + className(c.classId) + '  |  ' + t('journey') + ': ' + route.duration;
    const rows = [];
    rows.push('<tr><td>' + esc(t('adultsRow')) + ' x ' + toBnDigits(c.adults) + ' @ ' + money(b.adultFare) + '</td><td>' + money(b.adultsSubtotal) + '</td></tr>');
    if (c.children512 > 0) rows.push('<tr><td>' + esc(t('childrenRow')) + ' x ' + toBnDigits(c.children512) + ' @ ' + money(b.childFare) + '</td><td>' + money(b.childrenSubtotal) + '</td></tr>');
    if (c.under5 > 0) rows.push('<tr><td>' + esc(t('under5Row')) + ' x ' + toBnDigits(c.under5) + '</td><td>' + (state.lang === 'bn' ? '\u09ac\u09bf\u09a8\u09be\u09ae\u09c2\u09b2\u09cd\u09af\u09c7' : 'Free') + '</td></tr>');
    $('breakdownBody').innerHTML = rows.join('');
    $('grandTotalCell').textContent = money(b.total);
    $('rangeNote').hidden = !b.isRange;
    $('roundingNote').hidden = !b.rounded;
    $('resultBox').hidden = false;
  });

  $('saveCalcBtn').addEventListener('click', () => {
    if (!state.lastCalc) return;
    const c = Object.assign({}, state.lastCalc, {
      id: 'c' + Date.now(),
      name: $('calcName').value.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    });
    const r = calculate(c);
    c.total = r.breakdown.total;
    state.calcs.unshift(c);
    saveCalcs();
    $('saveMsg').hidden = false;
    $('calcName').value = '';
  });

  // ---- fare table ----
  function renderTable() {
    const q = ($('tableSearch').value || '').toLowerCase();
    const rows = fareTableRows().filter((row) => {
      if (!q) return true;
      const hay = (stationName(row.from) + ' ' + stationName(row.to) + ' ' + className(row.classId) + ' ' + routeById(row.routeId).id).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    $('tableCount').textContent = t('tableCount').replace('{n}', toBnDigits(rows.length));
    $('fareTableBody').innerHTML = rows.map((row) => {
      const badge = t('badge_' + row.badge);
      return '<tr class="fare-row" data-route-id="' + row.routeId + '" data-class-id="' + row.classId + '">' +
        '<td>' + esc(stationName(row.from)) + ' - ' + esc(stationName(row.to)) + '</td>' +
        '<td>' + esc(className(row.classId)) + '</td>' +
        '<td class="fare-cell">' + fareDisplay(row.fare) + '</td>' +
        '<td><span class="badge ' + row.badge + '">' + esc(badge) + '</span></td></tr>';
    }).join('');
    document.querySelectorAll('#fareTableBody .fare-row').forEach((tr) => {
      tr.addEventListener('click', () => {
        const route = routeById(tr.dataset.routeId);
        applyCalc({
          from: route.from, to: route.to, routeId: route.id,
          classId: tr.dataset.classId, adults: 1, children512: 0, under5: 0,
        });
        showTab('calc');
        $('calcBtn').click();
      });
    });
  }
  $('tableSearch').addEventListener('input', renderTable);

  // ---- per-km formula ----
  $('formulaBtn').addEventListener('click', () => {
    const km = parseFloat($('distanceInput').value);
    const r = deckCeilingKm(km);
    $('formulaError').hidden = true;
    if (!r.ok) {
      $('formulaResult').hidden = true;
      $('formulaError').textContent = t(r.error);
      $('formulaError').hidden = false;
      return;
    }
    $('formulaResult').textContent = t('formulaResult')
      .replace('{fare}', money(r.fare)).replace('{km}', toBnDigits(r.km));
    $('formulaResult').hidden = false;
  });

  // ---- class guide ----
  function renderClasses() {
    $('classList').innerHTML = DATA.CLASSES.map((c) => {
      const onRoutes = fareTableRows().filter((row) => row.classId === c.id);
      const list = onRoutes.length
        ? onRoutes.map((row) => esc(stationName(row.from)) + '-' + esc(stationName(row.to)) + ': ' + fareDisplay(row.fare)).join('<br>')
        : '<em>' + esc(t('noFareNote')) + '</em>';
      return '<div class="class-card" data-class-id="' + c.id + '"><h3>' + esc(className(c.id)) + '</h3>' +
        '<p>' + esc(t('classdesc_' + c.id)) + '</p>' +
        '<p><strong>' + esc(t('classOnRoutes')) + ':</strong><br>' + list + '</p></div>';
    }).join('');
  }

  // ---- rules ----
  function renderRules() {
    const items = [];
    for (let i = 1; i <= 8; i++) items.push('<li>' + esc(t('rule_' + i)) + '</li>');
    $('rulesList').innerHTML = items.join('');
  }

  // ---- saved data ----
  function renderSaved() {
    const list = $('savedList');
    $('savedEmpty').hidden = state.calcs.length > 0;
    list.innerHTML = state.calcs.map((c, idx) => {
      const route = routeById(c.routeId);
      return '<div class="trip-card"><div><strong>' + esc(c.name || (routeLabel(route) + ' - ' + className(c.classId))) + '</strong><br>' +
        esc(routeLabel(route)) + ' | ' + esc(className(c.classId)) + ' | ' +
        toBnDigits(c.adults) + ' ' + esc(t('adults')) + ' | ' + money(c.total) + '</div>' +
        '<div><button type="button" class="save-btn" data-idx="' + idx + '">' + esc(t('loadBtn')) + '</button> ' +
        '<button type="button" class="delete-btn" data-idx="' + idx + '">' + esc(t('deleteBtn')) + '</button></div></div>';
    }).join('');
    list.querySelectorAll('.save-btn').forEach((b) => b.addEventListener('click', () => {
      applyCalc(state.calcs[+b.dataset.idx]);
      showTab('calc');
      $('calcBtn').click();
    }));
    list.querySelectorAll('.delete-btn').forEach((b) => b.addEventListener('click', () => {
      state.calcs.splice(+b.dataset.idx, 1);
      saveCalcs();
      renderSaved();
    }));
  }

  $('exportBtn').addEventListener('click', () => {
    $('importText').value = JSON.stringify({ app: 'launch-fare-bd', version: 1, calcs: state.calcs });
  });
  $('importBtn').addEventListener('click', () => {
    $('importOk').hidden = true;
    $('importFail').hidden = true;
    let data;
    try { data = JSON.parse($('importText').value); }
    catch (e) { $('importFail').textContent = t('importFail') + 'invalid JSON'; $('importFail').hidden = false; return; }
    const v = validateImport(data);
    if (!v.ok) { $('importFail').textContent = t('importFail') + v.error; $('importFail').hidden = false; return; }
    state.calcs = v.calcs;
    saveCalcs();
    renderSaved();
    $('importOk').hidden = false;
  });
  $('eraseBtn').addEventListener('click', () => {
    $('eraseWrong').hidden = true;
    $('erasedMsg').hidden = true;
    if ($('eraseInput').value !== 'DELETE') { $('eraseWrong').hidden = false; return; }
    state.calcs = [];
    saveCalcs();
    $('eraseInput').value = '';
    renderSaved();
    $('erasedMsg').hidden = false;
  });

  // ---- i18n ----
  function applyLang() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $('title').textContent = t('title');
    $('subtitle').textContent = t('subtitle');
    document.querySelectorAll('[data-tab]').forEach((b) => { b.textContent = t('tab_' + b.dataset.tab); });
    $('langBtn').textContent = state.lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
    $('childNote').textContent = t('childNote');
    $('resultTitle').textContent = t('resultTitle');
    $('totalLabel').textContent = t('total');
    $('rangeNote').textContent = t('rangeNote');
    $('roundingNote').textContent = t('roundingNote');
    $('calcName').placeholder = t('saveNamePh');
    $('saveMsg').textContent = t('savedMsg');
    $('tableTitle').textContent = t('tableTitle');
    $('tableSearch').placeholder = t('tableSearchPh');
    $('thRoute').textContent = t('route');
    $('thClass').textContent = t('travelClass');
    $('thFare').textContent = state.lang === 'bn' ? '\u09ad\u09be\u09a1\u09bc\u09be' : 'Fare';
    $('thBadge').textContent = state.lang === 'bn' ? '\u0989\u09ce\u09b8' : 'Source';
    $('formulaTitle').textContent = t('formulaTitle');
    $('formulaDesc').textContent = t('formulaDesc');
    $('formulaNote').textContent = t('formulaNote');
    $('classesTitle').textContent = t('classesTitle');
    $('rulesTitle').textContent = t('rulesTitle');
    $('dataTitle').textContent = t('dataTitle');
    $('savedEmpty').textContent = t('savedEmpty');
    $('importText').placeholder = t('importPh');
    $('importOk').textContent = t('importOk');
    $('eraseTitle').textContent = t('eraseTitle');
    $('eraseLabel').textContent = t('eraseLabel');
    $('eraseWrong').textContent = t('eraseWrong');
    $('erasedMsg').textContent = t('erasedMsg');
    $('footerText').textContent = t('footer');
    document.title = t('title');
    fillStations();
    fillRoutes();
    renderClasses();
    renderRules();
    renderTable();
    renderSaved();
    // Re-render a visible result in the new language (digits, labels).
    if (state.lastCalc && !$('resultBox').hidden) $('calcBtn').click();
  }
  $('langBtn').addEventListener('click', () => {
    state.lang = state.lang === 'bn' ? 'en' : 'bn';
    localStorage.setItem(LS_LANG, state.lang);
    applyLang();
  });

  // ---- test hooks (same pattern as train-fare-bd) ----
  window.__lfbd = {
    state,
    exportPayload: () => JSON.stringify({ app: 'launch-fare-bd', version: 1, calcs: state.calcs }),
    importPayload: (s) => {
      let data;
      try { data = JSON.parse(s); } catch (e) { return { ok: false, error: 'invalid JSON' }; }
      const v = validateImport(data);
      if (!v.ok) return v;
      state.calcs = v.calcs;
      saveCalcs();
      renderSaved();
      return { ok: true };
    },
    eraseAll: () => { state.calcs = []; saveCalcs(); renderSaved(); },
  };

  applyLang();
})();
