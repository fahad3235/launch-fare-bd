# TEST_RESULTS.md -- launch-fare-bd (factory run #306, 2026-11-11 14:00 slot)

## Node unit tests -- 14/14 pass

Run: `node --test tests/logic.test.js` (no dependencies).

- Dataset integrity: 6 routes, 6 stations, 12 classes, exactly 22 fare cells.
- Every fare matches the sourced value (fixed prices and ranges, per route).
- Unpriced cells are absent (null), never invented (Patuakhali cabins, Bhola
  deck, steamer classes on regular Barisal, etc.).
- Fare badges: Verified / Single source / Reports vary, as documented.
- routesForPair: unordered, both directions; 2 Barisal variants (regular +
  PS Mahsud steamer); no route for unserved pairs.
- classesForRoute: only classes with a sourced fare.
- deckCeilingKm (official May 2026 rates): 50 km -> 148; 100 km -> 295;
  150 km -> 421; 180 km -> 497; 10 km -> 32 (minimum fare applies);
  0 / 1001 / NaN / string rejected.
- calculate: 1 adult Barisal deck = 350; range midpoint (Chandpur deck
  100-150 -> 125; 2 adults = 250); child half-fare (single 1200 -> 600);
  rounding (Chandpur 1 adult + 1 child = 187.5 -> 188); under-5 free;
  children-only party allowed; spot-check totals for all 6 routes.
- validateCalculation: 13 error paths rejected (same station, no route,
  unknown station/route/class, class with no fare, zero paying, over-limit
  and fractional counts).
- validateImport: valid round-trip recomputes the total from fare data
  (stored total discarded); 13 malformed cases rejected (wrong app/version,
  unknown route/class, class with no fare, zero paying, over-long name,
  one-good-one-bad).

## Headless-Chrome smoke tests -- 85/85 pass, 0 console/page errors

Run: `node tests/smoke.js` (raw CDP, headless_shell-1187, file://).

- Load defaults: Dhaka -> Barisal, 2 route variants, regular route default,
  5 classes, steamer class absent, child-rule note shown.
- Calculator: 1 adult deck = 350 Tk; single 1 adult + 1 child = 1,800 Tk;
  Chandpur deck range 1 adult + 1 child = 188 Tk with range + rounding
  notes; 1 adult + 2 under-5 = 350 Tk with "Free" row; PS Mahsud First
  Class = 2,600 Tk; steamer offers 3 classes.
- Validation: same station, no-route pair (Chandpur-Bhola), zero paying
  passengers -- all show inline errors; valid calc recovers after errors.
- Swap button exchanges From/To.
- Fare table: 22 rows; 6 Verified, 13 Single-source, 3 Reports-vary badges;
  Barisal deck cell 350; Chandpur deck cell "100-150"; search "hatiya" -> 3
  rows, "mahsud" -> 3 rows, clear restores 22; row tap loads the calculator
  (Chandpur VIP -> 2,500 Tk midpoint).
- Per-km formula: 50 km -> 148 Tk; 180 km -> 497 Tk; note names the 2.95
  rate; 0 km rejected.
- Class guide: 12 cards; First Class mentions PS Mahsud; Deck mentions mat.
- Rules tab: mentions 2.95 per km, BIWTA, Eid 10-20%.
- Save/load/delete round-trip in the Data tab; export payload is
  launch-fare-bd v1 and carries the saved calc; eraseAll empties calcs;
  valid import restores; wrong-app / unknown-route / class-with-no-fare
  imports rejected with data intact; bad UI import shows an error, good UI
  import succeeds; typed-DELETE erases, wrong word rejected with data kept.
- Language toggle: Bengali title, Bengali-digit total, Bengali tab label;
  persists across reload; back to English.
- Footer carries the verify-at-the-counter disclaimer.
- Mobile 390px: no horizontal overflow on any of the 6 tabs.
- Zero non-file:// network requests (fully offline).
- No console or page errors.

## Repairs during testing (2 real app bugs + 1 test bug)

1. `saveMsg` vs `savedMsg` id typo in `applyLang` -- threw on load, left the
   selects empty (found by the smoke run; fixed in `js/app.js`).
2. Browser fallback in `js/logic.js` read `window.__LFBD_DATA.ST` etc.
   (keys renamed by a bulk sed) instead of `.STATIONS` -- `stationById`
   threw (found by the smoke run; fixed).
3. Range fares rendered as "NaN Tk" (`money()` applied to a "100-150"
   label) -- added `fareDisplay()` in `js/app.js`, used in the class
   select, fare table and class guide.
4. No-route pairs showed "Choose a launch route" instead of the
   "No verified fare" message -- `validateCalculation` now returns
   `err_noroute` when the pair has no routes.
5. Language toggle did not re-render a visible total in Bengali digits and
   reset the calculator selections -- selects now preserve the current
   choice, and a visible result is re-calculated on toggle.
6. Test-side fixes: two logic-test cases used `vip` (which *does* have a
   Barisal fare) as the no-fare class -- changed to `second`; three smoke
   assertions used spaced JSON (`"app": "..."`) while `JSON.stringify`
   emits none -- corrected to the compact form.
7. `normalizeCalc` sliced over-long names instead of rejecting them --
   now rejects (matches the test contract).

Final state: 14/14 unit, 85/85 smoke, 0 errors, 0 repairs outstanding.
