// launch-fare-bd -- node logic tests (no deps).
// Run: node --test tests/logic.test.js
const assert = require('node:assert');
const { test } = require('node:test');
const L = require('../js/logic.js');

const EXPECTED = {
  'dhaka-barisal': { 'deck': 350, 'single-nonac': 1200, 'double-nonac': 2400, 'family': [2000, 3500], 'vip': [6000, 8000] },
  'dhaka-chandpur': { 'deck': [100, 150], 'chair': [250, 300], 'single-nonac': [500, 600], 'single-ac': [700, 800], 'double-nonac': [1000, 1200], 'double-ac': [1200, 1500], 'vip': [2000, 3000] },
  'dhaka-bhola': { 'economy': 600, 'business': 800, 'single-nonac': 1000 },
  'dhaka-hatiya': { 'deck': [400, 600], 'single-nonac': [1500, 2200], 'double-nonac': [2500, 3500] },
  'dhaka-patuakhali': { 'deck': [400, 480] },
  'dhaka-barisal-mahsud': { 'deck': 600, 'second': 1650, 'first': 2600 },
};

test('dataset integrity: 6 routes, 22 fare cells, no invented cells', () => {
  assert.strictEqual(L.ROUTES.length, 6);
  assert.strictEqual(L.STATIONS.length, 6);
  assert.strictEqual(L.CLASSES.length, 12);
  let cells = 0;
  const routeIds = new Set();
  for (const r of L.ROUTES) {
    assert.ok(!routeIds.has(r.id), 'duplicate route id: ' + r.id);
    routeIds.add(r.id);
    assert.ok(L.stationById(r.from), r.id + ' from station known');
    assert.ok(L.stationById(r.to), r.id + ' to station known');
    assert.notStrictEqual(r.from, r.to, r.id + ' endpoints differ');
    for (const [cls, fare] of Object.entries(r.fares)) {
      assert.ok(L.classById(cls), r.id + ' class known: ' + cls);
      if (typeof fare === 'number') assert.ok(Number.isInteger(fare) && fare > 0, r.id + ' ' + cls);
      else assert.ok(Array.isArray(fare) && fare[1] >= fare[0] && fare[0] > 0, r.id + ' ' + cls + ' range valid');
      cells++;
    }
  }
  assert.strictEqual(cells, 22, 'exactly 22 fare cells');
  assert.strictEqual(L.fareTableRows().length, 22);
});

test('every fare matches the sourced value', () => {
  for (const [routeId, fares] of Object.entries(EXPECTED)) {
    for (const [cls, fare] of Object.entries(fares)) {
      assert.deepStrictEqual(L.fareFor(routeId, cls), fare, routeId + ' / ' + cls);
    }
    assert.deepStrictEqual(
      Object.keys(L.routeById(routeId).fares).sort(),
      Object.keys(fares).sort(),
      routeId + ' fare set is exactly the sourced set',
    );
  }
});

test('unpriced cells are absent (null), never invented', () => {
  assert.strictEqual(L.fareFor('dhaka-barisal', 'second'), null, 'no steamer class on regular Barisal');
  assert.strictEqual(L.fareFor('dhaka-barisal-mahsud', 'single-nonac'), null, 'no cabin on PS Mahsud');
  assert.strictEqual(L.fareFor('dhaka-patuakhali', 'single-nonac'), null, 'no cabin fare verified for Patuakhali');
  assert.strictEqual(L.fareFor('dhaka-bhola', 'deck'), null, 'no deck fare on Bhola (economy/business instead)');
  assert.strictEqual(L.fareFor('dhaka-chandpur', 'economy'), null, 'no economy on Chandpur');
  assert.strictEqual(L.fareFor('no-such-route', 'deck'), null, 'unknown route');
  assert.strictEqual(L.fareFor('dhaka-barisal', 'royal'), null, 'unknown class');
});

test('fare badges: verified / single-source / reports-vary', () => {
  assert.strictEqual(L.fareBadge('dhaka-barisal', 'deck'), 'verified');
  assert.strictEqual(L.fareBadge('dhaka-barisal-mahsud', 'first'), 'verified');
  assert.strictEqual(L.fareBadge('dhaka-barisal', 'family'), 'varies');
  assert.strictEqual(L.fareBadge('dhaka-chandpur', 'deck'), 'varies');
  assert.strictEqual(L.fareBadge('dhaka-chandpur', 'chair'), 'single');
  assert.strictEqual(L.fareBadge('dhaka-bhola', 'economy'), 'single');
  assert.strictEqual(L.fareBadge('dhaka-hatiya', 'deck'), 'single');
  assert.strictEqual(L.fareBadge('dhaka-patuakhali', 'deck'), 'single');
});

test('routesForPair: unordered, both directions same fare', () => {
  assert.strictEqual(L.routesForPair('dhaka', 'barisal').length, 2, 'regular + steamer');
  assert.strictEqual(L.routesForPair('barisal', 'dhaka').length, 2);
  assert.deepStrictEqual(
    L.routesForPair('barisal', 'dhaka').map((r) => r.id).sort(),
    ['dhaka-barisal', 'dhaka-barisal-mahsud'],
  );
  assert.strictEqual(L.routesForPair('dhaka', 'chandpur').length, 1);
  assert.strictEqual(L.routesForPair('dhaka', 'dhaka').length, 0, 'same station');
  assert.strictEqual(L.routesForPair('chandpur', 'bhola').length, 0, 'no verified route');
  assert.strictEqual(L.fareFor('dhaka-barisal', 'deck'), 350);
});

test('classesForRoute: only classes with a sourced fare', () => {
  assert.deepStrictEqual(
    L.classesForRoute('dhaka-barisal').map((c) => c.id),
    ['deck', 'single-nonac', 'double-nonac', 'family', 'vip'],
  );
  assert.deepStrictEqual(
    L.classesForRoute('dhaka-barisal-mahsud').map((c) => c.id),
    ['deck', 'second', 'first'],
  );
  assert.deepStrictEqual(L.classesForRoute('dhaka-patuakhali').map((c) => c.id), ['deck']);
  assert.deepStrictEqual(L.classesForRoute('nope'), []);
});

test('deckCeilingKm: official May 2026 per-km rates', () => {
  // 50 km: 50 x 2.95 = 147.5 -> 148.
  assert.deepStrictEqual(L.deckCeilingKm(50), { ok: true, km: 50, fare: 148 });
  // 100 km: 295.
  assert.deepStrictEqual(L.deckCeilingKm(100), { ok: true, km: 100, fare: 295 });
  // 150 km: 295 + 50 x 2.52 = 421.
  assert.deepStrictEqual(L.deckCeilingKm(150), { ok: true, km: 150, fare: 421 });
  // 180 km: 295 + 80 x 2.52 = 496.6 -> 497 (ceiling is above the 350 counter fare).
  assert.deepStrictEqual(L.deckCeilingKm(180), { ok: true, km: 180, fare: 497 });
  // 10 km: 29.5 -> 30, but the 32 Tk minimum applies.
  assert.deepStrictEqual(L.deckCeilingKm(10), { ok: true, km: 10, fare: 32 });
  // 11 km: 32.45 -> 32 (rounds to 32, above the minimum anyway).
  assert.deepStrictEqual(L.deckCeilingKm(11), { ok: true, km: 11, fare: 32 });
  assert.strictEqual(L.deckCeilingKm(0).ok, false);
  assert.strictEqual(L.deckCeilingKm(1001).ok, false);
  assert.strictEqual(L.deckCeilingKm(NaN).ok, false);
  assert.strictEqual(L.deckCeilingKm('180').ok, false);
});

const base = {
  from: 'dhaka', to: 'barisal', routeId: 'dhaka-barisal',
  classId: 'deck', adults: 1, children512: 0, under5: 0,
};

test('calculate: single adult, fixed fare', () => {
  const r = L.calculate(base);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.breakdown.adultFare, 350);
  assert.strictEqual(r.breakdown.total, 350);
  assert.strictEqual(r.breakdown.isRange, false);
  assert.strictEqual(r.breakdown.rounded, false);
});

test('calculate: range fare uses midpoint + range flag', () => {
  // Chandpur deck 100-150: midpoint 125; 2 adults = 250.
  const r = L.calculate({ ...base, to: 'chandpur', routeId: 'dhaka-chandpur', adults: 2 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.breakdown.adultFare, 125);
  assert.strictEqual(r.breakdown.isRange, true);
  assert.strictEqual(r.breakdown.total, 250);
  // Hatiya single 1500-2200: midpoint 1850.
  const r2 = L.calculate({ ...base, to: 'hatiya', routeId: 'dhaka-hatiya', classId: 'single-nonac' });
  assert.strictEqual(r2.breakdown.adultFare, 1850);
  assert.strictEqual(r2.breakdown.total, 1850);
});

test('calculate: child half-fare + rounding', () => {
  // Barisal single 1200: 1 adult + 1 child = 1200 + 600 = 1800.
  const r = L.calculate({ ...base, classId: 'single-nonac', children512: 1 });
  assert.strictEqual(r.breakdown.childFare, 600);
  assert.strictEqual(r.breakdown.total, 1800);
  // Chandpur deck midpoint 125: child = 62.5; 1 adult + 1 child = 187.5 -> 188.
  const r2 = L.calculate({ ...base, to: 'chandpur', routeId: 'dhaka-chandpur', children512: 1 });
  assert.strictEqual(r2.breakdown.childFare, 62.5);
  assert.strictEqual(r2.breakdown.totalExact, 187.5);
  assert.strictEqual(r2.breakdown.rounded, true);
  assert.strictEqual(r2.breakdown.total, 188);
});

test('calculate: under-5 free, children-only party allowed', () => {
  const r = L.calculate({ ...base, under5: 2 });
  assert.strictEqual(r.breakdown.total, 350, 'under-5 adds nothing');
  const r2 = L.calculate({ ...base, adults: 0, children512: 2 });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.breakdown.total, 350); // 2 x 175
});

test('calculate: every route/class spot-check totals', () => {
  const cases = [
    ['dhaka-barisal', 'double-nonac', 2400],
    ['dhaka-barisal-mahsud', 'first', 2600],
    ['dhaka-barisal-mahsud', 'second', 1650],
    ['dhaka-bhola', 'business', 800],
    ['dhaka-chandpur', 'vip', 2500], // midpoint of 2000-3000
    ['dhaka-hatiya', 'double-nonac', 3000], // midpoint of 2500-3500
    ['dhaka-patuakhali', 'deck', 440], // midpoint of 400-480
  ];
  for (const [routeId, cls, fare] of cases) {
    const rt = L.routeById(routeId);
    const r = L.calculate({ ...base, from: rt.from, to: rt.to, routeId, classId: cls });
    assert.strictEqual(r.ok, true, routeId + '/' + cls);
    assert.strictEqual(r.breakdown.total, fare, routeId + '/' + cls);
  }
});

test('validateCalculation: all error paths', () => {
  const bad = [
    ['same station', { ...base, to: 'dhaka' }],
    ['no route for pair', { ...base, to: 'bhola', routeId: 'dhaka-chandpur' }],
    ['unknown station', { ...base, from: 'khulna' }],
    ['unknown route', { ...base, routeId: 'dhaka-khulna' }],
    ['route/pair mismatch', { ...base, routeId: 'dhaka-chandpur' }],
    ['class with no fare on route', { ...base, classId: 'second' }],
    ['unknown class', { ...base, classId: 'royal' }],
    ['zero paying passengers', { ...base, adults: 0, children512: 0, under5: 3 }],
    ['adults over 6', { ...base, adults: 7 }],
    ['negative children', { ...base, children512: -1 }],
    ['fractional adults', { ...base, adults: 1.5 }],
    ['non-integer under5', { ...base, under5: 'two' }],
    ['children over 4', { ...base, children512: 5 }],
  ];
  for (const [name, input] of bad) {
    assert.strictEqual(L.validateCalculation(input).ok, false, name + ' must be rejected');
    assert.strictEqual(L.calculate(input).ok, false, name + ' calculate must fail');
    assert.strictEqual(L.calculate(input).breakdown, null, name + ' breakdown null');
  }
  assert.strictEqual(L.validateCalculation(null).ok, false, 'null input');
  assert.strictEqual(L.validateCalculation(base).ok, true, 'valid input passes');
});

test('validateImport: valid round-trip + malformed cases', () => {
  const good = {
    app: 'launch-fare-bd', version: 1,
    calcs: [{
      id: 'c1', name: 'Family Barisal', routeId: 'dhaka-barisal', classId: 'single-nonac',
      from: 'dhaka', to: 'barisal', adults: 2, children512: 1, under5: 0,
      total: 9999, createdAt: '2026-11-11',
    }],
  };
  // 2x1200 + 600 = 3000 (recomputed on import, stored 9999 discarded).
  const v = L.validateImport(JSON.parse(JSON.stringify(good)));
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.calcs.length, 1);
  assert.strictEqual(v.calcs[0].total, 3000, 'import recomputes total from the fare data');

  const bad = [
    ['not an object', 'hello'],
    ['null', null],
    ['array', []],
    ['wrong app', { app: 'train-fare-bd', version: 1, calcs: [] }],
    ['wrong version', { app: 'launch-fare-bd', version: 2, calcs: [] }],
    ['missing calcs', { app: 'launch-fare-bd', version: 1 }],
    ['calcs not array', { app: 'launch-fare-bd', version: 1, calcs: {} }],
    ['unknown route', { app: 'launch-fare-bd', version: 1, calcs: [{ ...good.calcs[0], routeId: 'dhaka-khulna' }] }],
    ['unknown class', { app: 'launch-fare-bd', version: 1, calcs: [{ ...good.calcs[0], classId: 'royal' }] }],
    ['class with no fare', { app: 'launch-fare-bd', version: 1, calcs: [{ ...good.calcs[0], classId: 'second' }] }],
    ['zero paying', { app: 'launch-fare-bd', version: 1, calcs: [{ ...good.calcs[0], adults: 0, children512: 0 }] }],
    ['name too long', { app: 'launch-fare-bd', version: 1, calcs: [{ ...good.calcs[0], name: 'x'.repeat(61) }] }],
    ['one good one bad', { app: 'launch-fare-bd', version: 1, calcs: [good.calcs[0], { ...good.calcs[0], id: 'c2', routeId: 'nope' }] }],
  ];
  for (const [name, data] of bad) {
    assert.strictEqual(L.validateImport(data).ok, false, name + ' must be rejected');
  }
  assert.strictEqual(L.validateImport({ app: 'launch-fare-bd', version: 1, calcs: [] }).ok, true, 'empty calcs valid');
});
