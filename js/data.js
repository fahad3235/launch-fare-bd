// launch-fare-bd -- fare dataset (pure ASCII; Bengali names live in js/i18n.js).
// Every fare below is sourced in DATA_NOTES.md. A fare cell is either a fixed
// integer (verified single price) or [lo, hi] (a reported range -- the counter
// may quote any price inside it). Nothing here is invented: a class with no
// sourced fare simply has no cell on that route.
const STATIONS = [
  { id: 'dhaka', name: 'Dhaka (Sadarghat)' },
  { id: 'barisal', name: 'Barisal' },
  { id: 'chandpur', name: 'Chandpur' },
  { id: 'bhola', name: 'Bhola (Elisha)' },
  { id: 'hatiya', name: 'Hatiya (Tamaruddi)' },
  { id: 'patuakhali', name: 'Patuakhali' },
];

const CLASSES = [
  { id: 'deck', name: 'Deck' },
  { id: 'chair', name: 'Chair' },
  { id: 'economy', name: 'Economy Class' },
  { id: 'business', name: 'Business Class' },
  { id: 'single-nonac', name: 'Single Cabin (Non-AC)' },
  { id: 'single-ac', name: 'Single Cabin (AC)' },
  { id: 'double-nonac', name: 'Double Cabin (Non-AC)' },
  { id: 'double-ac', name: 'Double Cabin (AC)' },
  { id: 'family', name: 'Family Cabin' },
  { id: 'vip', name: 'VIP Cabin' },
  { id: 'second', name: 'Second Class' },
  { id: 'first', name: 'First Class' },
];

// fares: fixed integer, or [lo, hi] range. varies: {classId: note} marks a fare
// whose sources disagree. singleSource: the whole route rests on one source.
const ROUTES = [
  {
    id: 'dhaka-barisal', from: 'dhaka', to: 'barisal',
    duration: '6-7 h, overnight',
    fares: {
      'deck': 350,
      'single-nonac': 1200,
      'double-nonac': 2400,
      'family': [2000, 3500],
      'vip': [6000, 8000],
    },
    varies: {
      'family': '2000-3500 (community dataset) vs 4000 (FE, 2022)',
      'vip': '6000-8000 (community dataset) vs 6000 (FE, 2022)',
    },
  },
  {
    id: 'dhaka-chandpur', from: 'dhaka', to: 'chandpur',
    duration: '3-4 h',
    singleSource: true,
    fares: {
      'deck': [100, 150],
      'chair': [250, 300],
      'single-nonac': [500, 600],
      'single-ac': [700, 800],
      'double-nonac': [1000, 1200],
      'double-ac': [1200, 1500],
      'vip': [2000, 3000],
    },
    varies: {
      'deck': '100-150 (travel blog) vs "should cost 100" (FE, Mar 2026)',
    },
  },
  {
    id: 'dhaka-bhola', from: 'dhaka', to: 'bhola',
    duration: '5-6 h',
    singleSource: true,
    fares: { 'economy': 600, 'business': 800, 'single-nonac': 1000 },
  },
  {
    id: 'dhaka-hatiya', from: 'dhaka', to: 'hatiya',
    duration: '12-14 h, overnight',
    singleSource: true,
    fares: {
      'deck': [400, 600],
      'single-nonac': [1500, 2200],
      'double-nonac': [2500, 3500],
    },
  },
  {
    id: 'dhaka-patuakhali', from: 'dhaka', to: 'patuakhali',
    duration: '7-8 h, overnight',
    singleSource: true,
    fares: { 'deck': [400, 480] },
  },
  {
    id: 'dhaka-barisal-mahsud', from: 'dhaka', to: 'barisal',
    duration: 'Weekly, Fri 08:30',
    steamer: true,
    fares: { 'deck': 600, 'second': 1650, 'first': 2600 },
  },
];

// Official maximum deck fare (Ministry of Shipping gazette, 5 May 2026,
// under Rule 27 of the 2019 Rules; reported by New Age + TBS, 6 May 2026).
const FORMULA = {
  rateFirst100: 2.95,   // Tk per km, first 100 km
  rateBeyond100: 2.52,  // Tk per km, beyond 100 km
  minFare: 32,          // Tk minimum fare
  effectiveFrom: '2026-05-05',
  authority: 'Ministry of Shipping gazette, 5 May 2026 (Rule 27, 2019 Rules)',
};

if (typeof module !== 'undefined') {
  module.exports = { STATIONS, CLASSES, ROUTES, FORMULA };
}
if (typeof window !== 'undefined') {
  window.__LFBD_DATA = { STATIONS, CLASSES, ROUTES, FORMULA };
}
