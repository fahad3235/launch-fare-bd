// launch-fare-bd -- pure logic (Node + browser). No DOM here.
const D = (typeof require === 'function')
  ? require('./data.js')
  : { STATIONS: window.__LFBD_DATA.STATIONS, CLASSES: window.__LFBD_DATA.CLASSES, ROUTES: window.__LFBD_DATA.ROUTES, FORMULA: window.__LFBD_DATA.FORMULA };
const { STATIONS: ST, CLASSES: CL, ROUTES: RT, FORMULA: FM } = D;

const APP_ID = 'launch-fare-bd';
const MAX_ADULTS = 6, MAX_CHILDREN = 4, MAX_UNDER5 = 4, MAX_NAME = 60;

function stationById(id) { return ST.find((s) => s.id === id) || null; }
function routeById(id) { return RT.find((r) => r.id === id) || null; }
function classById(id) { return CL.find((c) => c.id === id) || null; }

// Fare cell: fixed integer, [lo, hi] range, or null when no sourced fare.
function fareFor(routeId, classId) {
  const r = routeById(routeId);
  if (!r || !classById(classId)) return null;
  const f = r.fares[classId];
  if (typeof f === 'number') return f;
  if (Array.isArray(f) && f.length === 2 && f[0] > 0 && f[1] >= f[0]) return [f[0], f[1]];
  return null;
}
function isRange(fare) { return Array.isArray(fare); }
function fareMid(fare) {
  if (typeof fare === 'number') return fare;
  return (fare[0] + fare[1]) / 2;
}
function fareLabel(fare) {
  if (fare === null || fare === undefined) return null;
  if (typeof fare === 'number') return String(fare);
  return fare[0] + '-' + fare[1];
}
// Badge for a fare cell: 'varies' > 'single' > 'verified'.
function fareBadge(routeId, classId) {
  const r = routeById(routeId);
  if (!r) return null;
  if (r.varies && r.varies[classId]) return 'varies';
  if (r.singleSource) return 'single';
  return 'verified';
}

function routesForPair(from, to) {
  if (!stationById(from) || !stationById(to) || from === to) return [];
  return RT.filter((r) =>
    (r.from === from && r.to === to) || (r.from === to && r.to === from));
}
function classesForRoute(routeId) {
  const r = routeById(routeId);
  if (!r) return [];
  return CL.filter((c) => fareFor(routeId, c.id) !== null);
}
function fareTableRows() {
  const rows = [];
  for (const r of RT) {
    for (const [classId, fare] of Object.entries(r.fares)) {
      rows.push({ routeId: r.id, from: r.from, to: r.to, classId, fare, badge: fareBadge(r.id, classId) });
    }
  }
  return rows;
}

// Official maximum deck fare for a river distance (gazette ceiling).
// fare = max(minFare, round(2.95 * min(km,100) + 2.52 * max(0, km-100)))
function deckCeilingKm(km) {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 1 || km > 1000) {
    return { ok: false, error: 'formulaErr' };
  }
  const raw = FM.rateFirst100 * Math.min(km, 100)
    + FM.rateBeyond100 * Math.max(0, km - 100);
  return { ok: true, km, fare: Math.max(FM.minFare, Math.round(raw)) };
}

function isIntIn(v, lo, hi) {
  return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
}

function validateCalculation(c) {
  if (!c || typeof c !== 'object') return { ok: false, error: 'err_route' };
  if (!stationById(c.from) || !stationById(c.to)) return { ok: false, error: 'err_noroute' };
  if (c.from === c.to) return { ok: false, error: 'err_same' };
  if (routesForPair(c.from, c.to).length === 0) return { ok: false, error: 'err_noroute' };
  if (!routeById(c.routeId)) return { ok: false, error: 'err_route' };
  const r = routeById(c.routeId);
  if (!((r.from === c.from && r.to === c.to) || (r.from === c.to && r.to === c.from))) {
    return { ok: false, error: 'err_route' };
  }
  if (!classById(c.classId)) return { ok: false, error: 'err_class' };
  if (fareFor(c.routeId, c.classId) === null) return { ok: false, error: 'err_class' };
  if (!isIntIn(c.adults, 0, MAX_ADULTS)) return { ok: false, error: 'err_adults' };
  if (!isIntIn(c.children512, 0, MAX_CHILDREN)) return { ok: false, error: 'err_children' };
  if (!isIntIn(c.under5, 0, MAX_UNDER5)) return { ok: false, error: 'err_under5' };
  if (c.adults + c.children512 < 1) return { ok: false, error: 'err_nopaying' };
  return { ok: true };
}

// Children 5-12 pay half fare; under-5s travel free. No official BIWTA child
// rule was found -- this follows the common practice reported by travellers
// and is labelled as such in the UI (see DATA_NOTES.md).
function calculate(c) {
  const v = validateCalculation(c);
  if (!v.ok) return { ok: false, error: v.error, breakdown: null };
  const fare = fareFor(c.routeId, c.classId);
  const mid = fareMid(fare);
  const adultFare = mid;
  const childFare = mid / 2;
  const adultsSubtotal = c.adults * adultFare;
  const childrenSubtotal = c.children512 * childFare;
  const totalExact = adultsSubtotal + childrenSubtotal;
  const total = Math.round(totalExact);
  return {
    ok: true,
    breakdown: {
      fare, fareLabel: fareLabel(fare), isRange: isRange(fare),
      adultFare, childFare, adultsSubtotal, childrenSubtotal,
      totalExact, total, rounded: total !== totalExact,
    },
  };
}

function normalizeCalc(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.name === 'string' && raw.name.length > MAX_NAME) return null;
  const c = {
    id: typeof raw.id === 'string' ? raw.id : ('c' + Date.now() + Math.floor(Math.random() * 1e6)),
    name: typeof raw.name === 'string' ? raw.name : '',
    from: raw.from, to: raw.to, routeId: raw.routeId, classId: raw.classId,
    adults: raw.adults, children512: raw.children512, under5: raw.under5,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString().slice(0, 10),
  };
  const v = validateCalculation(c);
  if (!v.ok) return null;
  const r = calculate(c);
  c.total = r.breakdown.total;
  return c;
}

function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'not an object' };
  if (data.app !== APP_ID) return { ok: false, error: 'wrong app' };
  if (data.version !== 1) return { ok: false, error: 'wrong version' };
  if (!Array.isArray(data.calcs)) return { ok: false, error: 'calcs must be an array' };
  const calcs = [];
  for (const raw of data.calcs) {
    const c = normalizeCalc(raw);
    if (!c) return { ok: false, error: 'invalid calculation entry' };
    calcs.push(c);
  }
  return { ok: true, calcs };
}

if (typeof module !== 'undefined') {
  module.exports = {
    STATIONS: ST, CLASSES: CL, ROUTES: RT, FORMULA: FM, APP_ID,
    stationById, routeById, classById, fareFor, isRange, fareMid, fareLabel,
    fareBadge, routesForPair, classesForRoute, fareTableRows,
    deckCeilingKm, validateCalculation, calculate, validateImport, normalizeCalc,
  };
}
