// launch-fare-bd -- headless-Chrome smoke test via raw CDP (no puppeteer).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9356;
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/lfbd-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const nav = async (url) => { await send('Page.navigate', { url }); await wait(1400); };
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const clickTab = async (name) => ev(`document.querySelector('[data-tab="${name}"]').click()`);
  const setSelect = async (id, val) => ev(`document.getElementById('${id}').value='${val}'; document.getElementById('${id}').dispatchEvent(new Event('change'))`);
  const setNum = async (id, val) => ev(`document.getElementById('${id}').value='${val}'`);
  const BN_TITLE = '\u09b2\u099e\u09cd\u099a\u0020\u09ad\u09be\u09a1\u09bc\u09be\u0020\u09ac\u09bf\u09a1\u09bf';

  // ---- Load: defaults Dhaka -> Barisal, regular route, 5 classes ----
  await nav(BASE);
  check('page title mentions Launch Fare', (await ev('document.title'))?.includes('Launch Fare'));
  check('default From is Dhaka', (await ev(`document.getElementById('fromSelect').value`)) === 'dhaka');
  check('default To is Barisal', (await ev(`document.getElementById('toSelect').value`)) === 'barisal');
  check('two Barisal route variants offered', (await ev(`document.getElementById('routeSelect').options.length`)) === 2);
  check('default route is regular Barisal', (await ev(`document.getElementById('routeSelect').value`)) === 'dhaka-barisal');
  check('Barisal offers 5 classes', (await ev(`document.getElementById('classSelect').options.length`)) === 5);
  check('steamer class NOT on regular Barisal', (await ev(`[...document.getElementById('classSelect').options].map(o=>o.value).join(',')`)).indexOf('first') === -1);
  check('child note shown (no official child rule)', (await ev(`document.getElementById('childNote').textContent`)).includes('No official BIWTA'));

  // ---- Calculator: 1 adult Deck Barisal = 350 ----
  await ev(`document.getElementById('calcBtn').click()`);
  check('1 adult Deck Barisal = 350 Tk', (await ev(`document.getElementById('grandTotalCell').textContent`)).includes('350'));
  check('result route line shows Barisal', (await ev(`document.getElementById('resultRoute').textContent`)).includes('Barisal'));

  // ---- Child half-fare: Single Cabin 1200, 1 adult + 1 child = 1800 ----
  await setSelect('classSelect', 'single-nonac');
  await setNum('children512Input', '1');
  await ev(`document.getElementById('calcBtn').click()`);
  check('Single 1 adult + 1 child = 1,800 Tk', (await ev(`document.getElementById('grandTotalCell').textContent`)).includes('1,800'));
  check('child fare row shows 600', (await ev(`document.getElementById('breakdownBody').textContent`)).includes('600'));

  // ---- Range fare midpoint + rounding: Chandpur Deck 100-150, 1 adult + 1 child = 188 ----
  await setSelect('toSelect', 'chandpur');
  await setSelect('classSelect', 'deck');
  await ev(`document.getElementById('calcBtn').click()`);
  check('Chandpur Deck 1 adult + 1 child = 188 Tk', (await ev(`document.getElementById('grandTotalCell').textContent`)).includes('188'));
  check('range note shows for range fare', (await ev(`document.getElementById('rangeNote').hidden`)) === false);
  check('rounding note shows for .5 total', (await ev(`document.getElementById('roundingNote').hidden`)) === false);

  // ---- Under-5 free: 1 adult + 2 under-5, Barisal deck = 350 ----
  await setSelect('toSelect', 'barisal');
  await setSelect('classSelect', 'deck');
  await setNum('children512Input', '0');
  await setNum('under5Input', '2');
  await ev(`document.getElementById('calcBtn').click()`);
  check('1 adult + 2 under-5 = 350 Tk', (await ev(`document.getElementById('grandTotalCell').textContent`)).includes('350'));
  check('under-5 row shows Free', (await ev(`document.getElementById('breakdownBody').textContent`)).includes('Free'));
  await setNum('under5Input', '0');

  // ---- PS Mahsud steamer: First Class = 2600 ----
  await setSelect('routeSelect', 'dhaka-barisal-mahsud');
  await setSelect('classSelect', 'first');
  await ev(`document.getElementById('calcBtn').click()`);
  check('PS Mahsud First Class = 2,600 Tk', (await ev(`document.getElementById('grandTotalCell').textContent`)).includes('2,600'));
  check('steamer offers 3 classes', (await ev(`document.getElementById('classSelect').options.length`)) === 3);
  await setSelect('routeSelect', 'dhaka-barisal');
  await setSelect('classSelect', 'deck');
  await ev(`document.getElementById('calcBtn').click()`);

  // ---- Validation: same station / no route / zero paying ----
  await setSelect('toSelect', 'dhaka');
  await ev(`document.getElementById('calcBtn').click()`);
  check('same station shows inline error', (await ev(`document.getElementById('calcError').hidden`)) === false);
  check('same station error text', (await ev(`document.getElementById('calcError').textContent`)).includes('different stations'));
  await setSelect('fromSelect', 'chandpur');
  await setSelect('toSelect', 'bhola');
  await ev(`document.getElementById('calcBtn').click()`);
  check('no-route pair shows error', (await ev(`document.getElementById('calcError').textContent`)).includes('No verified fare'));
  await setSelect('fromSelect', 'dhaka');
  await setSelect('toSelect', 'barisal');
  await setNum('adultsInput', '0');
  await ev(`document.getElementById('calcBtn').click()`);
  check('zero paying passengers rejected', (await ev(`document.getElementById('calcError').textContent`)).includes('At least 1 paying passenger'));
  await setNum('adultsInput', '1');
  await ev(`document.getElementById('calcBtn').click()`);
  check('valid calc recovers after errors', (await ev(`document.getElementById('grandTotalCell').textContent`)).includes('350'));

  // ---- Swap button ----
  await ev(`document.getElementById('swapBtn').click()`);
  check('swap exchanges From/To', (await ev(`document.getElementById('fromSelect').value`)) === 'barisal' && (await ev(`document.getElementById('toSelect').value`)) === 'dhaka');
  await ev(`document.getElementById('swapBtn').click()`);

  // ---- Fare Table: 22 rows, badges, search, row tap loads calculator ----
  await clickTab('table');
  check('fare table shows 22 fares', (await ev(`document.getElementById('tableCount').textContent`)).includes('22'));
  check('fare table lists 22 rows', (await ev(`document.querySelectorAll('#fareTableBody .fare-row').length`)) === 22);
  check('6 Verified badges', (await ev(`document.querySelectorAll('#fareTableBody .badge.verified').length`)) === 6);
  check('13 Single-source badges', (await ev(`document.querySelectorAll('#fareTableBody .badge.single').length`)) === 13);
  check('3 Reports-vary badges', (await ev(`document.querySelectorAll('#fareTableBody .badge.varies').length`)) === 3);
  check('Barisal deck cell shows 350', (await ev(`document.querySelector('[data-route-id="dhaka-barisal"][data-class-id="deck"] .fare-cell').textContent`)).includes('350'));
  check('Chandpur deck cell shows range 100-150', (await ev(`document.querySelector('[data-route-id="dhaka-chandpur"][data-class-id="deck"] .fare-cell').textContent`)).includes('100-150'));
  await ev(`document.getElementById('tableSearch').value='hatiya'; document.getElementById('tableSearch').dispatchEvent(new Event('input'))`);
  check('search "hatiya" -> 3 rows', (await ev(`document.querySelectorAll('#fareTableBody .fare-row').length`)) === 3);
  await ev(`document.getElementById('tableSearch').value='mahsud'; document.getElementById('tableSearch').dispatchEvent(new Event('input'))`);
  check('search "mahsud" -> 3 rows', (await ev(`document.querySelectorAll('#fareTableBody .fare-row').length`)) === 3);
  await ev(`document.getElementById('tableSearch').value=''; document.getElementById('tableSearch').dispatchEvent(new Event('input'))`);
  check('clearing search restores 22 rows', (await ev(`document.querySelectorAll('#fareTableBody .fare-row').length`)) === 22);
  await ev(`document.querySelector('[data-route-id="dhaka-chandpur"][data-class-id="vip"]').click()`);
  check('row tap switches to calculator tab', (await ev(`document.querySelector('[data-tab="calc"]').classList.contains('active')`)) === true);
  check('row tap sets To Chandpur', (await ev(`document.getElementById('toSelect').value`)) === 'chandpur');
  check('row tap sets VIP, total 2,500 (midpoint)', (await ev(`document.getElementById('grandTotalCell').textContent`)).includes('2,500'));
  await setSelect('fromSelect', 'dhaka');
  await setSelect('toSelect', 'barisal');
  await setSelect('routeSelect', 'dhaka-barisal');
  await setSelect('classSelect', 'deck');
  await ev(`document.getElementById('calcBtn').click()`);

  // ---- Per-km formula: 50 km = 148; 180 km = 497; 0 km rejected ----
  await clickTab('formula');
  await setNum('distanceInput', '50');
  await ev(`document.getElementById('formulaBtn').click()`);
  check('formula 50 km = 148 Tk ceiling', (await ev(`document.getElementById('formulaResult').textContent`)).includes('148'));
  await setNum('distanceInput', '180');
  await ev(`document.getElementById('formulaBtn').click()`);
  check('formula 180 km = 497 Tk ceiling', (await ev(`document.getElementById('formulaResult').textContent`)).includes('497'));
  check('formula note names the 2.95 rate', (await ev(`document.getElementById('formulaNote').textContent`)).includes('2.95'));
  await setNum('distanceInput', '0');
  await ev(`document.getElementById('formulaBtn').click()`);
  check('formula 0 km shows error', (await ev(`document.getElementById('formulaError').hidden`)) === false);

  // ---- Class Guide: 12 cards, First Class mentions PS Mahsud ----
  await clickTab('classes');
  check('class guide renders 12 cards', (await ev(`document.querySelectorAll('#classList .class-card').length`)) === 12);
  check('First Class card mentions PS Mahsud', (await ev(`document.querySelector('#classList [data-class-id="first"]').textContent`)).includes('PS Mahsud'));
  check('Deck card mentions mat', (await ev(`document.querySelector('#classList [data-class-id="deck"]').textContent`)).includes('mat'));

  // ---- Fare Rules tab ----
  await clickTab('rules');
  check('rules tab mentions 2.95 per km', (await ev(`document.getElementById('tab-rules').textContent`)).includes('2.95'));
  check('rules tab mentions BIWTA', (await ev(`document.getElementById('tab-rules').textContent`)).includes('BIWTA'));
  check('rules tab mentions Eid 10-20%', (await ev(`document.getElementById('tab-rules').textContent`)).includes('10-20%'));

  // ---- Save calculation + Data tab load/delete ----
  await clickTab('calc');
  await ev(`document.getElementById('calcName').value='Family Barisal trip'; document.getElementById('saveCalcBtn').click()`);
  check('save shows confirmation', (await ev(`document.getElementById('saveMsg').hidden`)) === false);
  await clickTab('data');
  check('saved calculation appears in Data tab', (await ev(`document.querySelectorAll('#savedList .trip-card').length`)) === 1);
  check('saved name shown', (await ev(`document.querySelector('#savedList .trip-card').textContent`)).includes('Family Barisal trip'));
  await ev(`document.querySelector('#savedList .trip-card .save-btn').click()`);
  check('Load returns to calculator tab', (await ev(`document.querySelector('[data-tab="calc"]').classList.contains('active')`)) === true);
  check('Loaded calc total is 350', (await ev(`document.getElementById('grandTotalCell').textContent`)).includes('350'));
  await clickTab('data');
  await ev(`document.querySelector('#savedList .trip-card .delete-btn').click()`);
  check('delete removes saved calculation', (await ev(`document.querySelectorAll('#savedList .trip-card').length`)) === 0);
  check('empty saved message shows', (await ev(`document.getElementById('savedEmpty').hidden`)) === false);

  // ---- Export / erase / import round-trip via test hooks ----
  await clickTab('calc');
  await ev(`document.getElementById('calcName').value='Export check'; document.getElementById('saveCalcBtn').click()`);
  const payload = await ev(`window.__lfbd.exportPayload()`);
  check('export payload is launch-fare-bd v1', payload.includes('"app":"launch-fare-bd"') && payload.includes('"version":1'), payload.slice(0, 120));
  check('export carries the saved calc', payload.includes('Export check'));
  await ev(`window.__lfbd.eraseAll()`);
  check('eraseAll empties calcs', (await ev(`window.__lfbd.exportPayload()`)).includes('"calcs":[]'));
  const imp = await ev(`JSON.stringify(window.__lfbd.importPayload(${JSON.stringify(payload)}))`);
  check('import valid payload ok', imp.includes('"ok":true'), imp);
  check('import restores calc', (await ev(`window.__lfbd.exportPayload()`)).includes('Export check'));
  const badImp = await ev(`JSON.stringify(window.__lfbd.importPayload('{"app":"train-fare-bd","version":1,"calcs":[]}'))`);
  check('import wrong app rejected', badImp.includes('"ok":false'));
  check('invalid import leaves data intact', (await ev(`window.__lfbd.exportPayload()`)).includes('Export check'));
  const badRoute = await ev(`JSON.stringify(window.__lfbd.importPayload('{"app":"launch-fare-bd","version":1,"calcs":[{"id":"x","routeId":"dhaka-khulna","classId":"deck","from":"dhaka","to":"khulna","adults":1,"children512":0,"under5":0}]}'))`);
  check('import unknown route rejected', badRoute.includes('"ok":false'));
  const badClass = await ev(`JSON.stringify(window.__lfbd.importPayload('{"app":"launch-fare-bd","version":1,"calcs":[{"id":"x","routeId":"dhaka-barisal","classId":"second","from":"dhaka","to":"barisal","adults":1,"children512":0,"under5":0}]}'))`);
  check('import class-with-no-fare rejected', badClass.includes('"ok":false'));
  check('bad-class import leaves data intact', (await ev(`window.__lfbd.exportPayload()`)).includes('Export check'));

  // ---- Bad import via UI textarea shows visible error; good import succeeds ----
  await clickTab('data');
  await ev(`document.getElementById('importText').value='{not json'; document.getElementById('importBtn').click()`);
  check('bad UI import shows error', (await ev(`document.getElementById('importFail').hidden`)) === false);
  await ev(`document.getElementById('importText').value=${JSON.stringify(payload)}; document.getElementById('importBtn').click()`);
  check('good UI import succeeds', (await ev(`document.getElementById('importOk').hidden`)) === false);

  // ---- Typed-DELETE erase via UI; wrong word rejected ----
  await ev(`document.getElementById('eraseInput').value='delete'; document.getElementById('eraseBtn').click();`);
  check('wrong erase word rejected', (await ev(`document.getElementById('eraseWrong').hidden`)) === false);
  check('wrong erase keeps data', (await ev(`window.__lfbd.exportPayload()`)).includes('Export check'));
  await ev(`document.getElementById('eraseInput').value='DELETE'; document.getElementById('eraseBtn').click();`);
  check('DELETE erases data', (await ev(`window.__lfbd.exportPayload()`)).includes('"calcs":[]'));
  check('erase success message shows', (await ev(`document.getElementById('erasedMsg').hidden`)) === false);

  // ---- Language toggle: Bengali title + digits, persists after reload ----
  await clickTab('calc');
  await ev(`document.getElementById('calcBtn').click()`);
  await ev(`document.getElementById('langBtn').click()`);
  check('BN toggle: title in Bengali', (await ev(`document.getElementById('title').textContent`)) === BN_TITLE);
  check('BN toggle: total in Bengali digits', (await ev(`document.getElementById('grandTotalCell').textContent`)).includes('\u09e9\u09eb\u09e6'));
  check('BN toggle: tab label in Bengali', (await ev(`document.querySelector('[data-tab="table"]').textContent`)).includes('\u09ad\u09be\u09a1\u09bc\u09be\u09b0\u0020\u09a4\u09be\u09b2\u09bf\u0995\u09be'));
  await nav(BASE);
  check('BN toggle persists after reload', (await ev(`window.__lfbd.state.lang`)) === 'bn');
  await ev(`document.getElementById('langBtn').click()`);
  check('back to EN', (await ev(`window.__lfbd.state.lang`)) === 'en');

  // ---- Footer disclaimer ----
  check('footer carries verify disclaimer', (await ev(`document.getElementById('footerText').textContent`)).includes('verify at the counter'));

  // ---- Mobile 390px: no horizontal overflow on any tab ----
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav(BASE);
  for (const tab of ['calc', 'table', 'formula', 'classes', 'rules', 'data']) {
    await clickTab(tab);
    await wait(300);
    const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check('390px no overflow on ' + tab + ' tab', overflow <= 0, 'overflow=' + overflow);
  }

  // ---- Zero network requests: app is fully offline (only file:// loads) ----
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); try { chrome.kill(); } catch (_) {} process.exit(2); });
