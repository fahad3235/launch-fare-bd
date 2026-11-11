# Launch Fare BD

Offline bilingual (English / Bangla) Bangladesh launch (steamer) fare calculator, fare table and official per-km ceiling checker. Runs entirely in the browser -- no network requests, no account, no data leaves the device.

## Problem

Launch fares from Dhaka's Sadarghat terminal vary by launch, season and demand, and there is no single official fare chart that travellers can check. Deck tickets are sold at the counter on the day, cabins are booked by phone days ahead, and quoted prices often differ from what passengers expect. This app gives travellers one place to check a sourced fare before they travel.

## Features

- **Fare calculator** -- pick From / To (Sadarghat + 5 destinations), launch route, class, adults (0-6), children 5-12 (0-4, half fare), children under 5 (0-4, free). Shows an itemised breakdown, the total in taka, and notes when a range fare (midpoint used) or rounding applied.
- **Fare table** -- all 22 sourced fares across 6 routes, with source badges (**Verified** / **Single source** / **Reports vary**), live search, and tap-a-row to load that fare into the calculator.
- **Official per-km ceiling** -- enter any river distance (km) and see the maximum deck fare under the Ministry of Shipping gazette of 5 May 2026 (2.95 Tk/km for the first 100 km, 2.52 Tk/km beyond, minimum 32 Tk). Labelled as a ceiling, not the counter price.
- **Class guide** -- 12 launch classes (Deck, Chair, Economy, Business, Single/Double cabins AC & non-AC, Family, VIP, BIWTC steamer First/Second) with plain descriptions and the routes each serves.
- **Fare rules** -- 8 practical rules: deck vs cabin booking, the gazette rates, Eid surcharges, the (unverified) child-fare practice, what to bring, departure times, and where to complain about overcharging.
- **Saved calculations** -- name and save a calculation, load or delete it later; JSON export / strict import (invalid files are rejected with data intact); typed-`DELETE` erase-all.
- **Bilingual** -- full English / Bangla toggle, persisted, with Bengali digits. All shipped sources are pure ASCII (Bengali is emitted as `\uXXXX` escapes by `tools/gen_i18n.py`).

## Fares in this app

6 routes, 22 fare cells. Verified fares (two or more independent sources, or an official notice): Dhaka-Barisal deck 350 Tk, single cabin 1,200 Tk, double cabin 2,400 Tk; PS Mahsud steamer deck 600 Tk, Second Class 1,650 Tk, First Class 2,600 Tk. Everything else is a reported range or a single-source figure and is badged as such in the app. See `DATA_NOTES.md` for every source, conflict and caveat -- including the fact that **no official BIWTA child-fare rule was found**: half fare for ages 5-12 and free travel under 5 is the common practice reported by travellers, labelled as unverified in the app.

## Stack

Vanilla HTML/CSS/JS, no dependencies, no build step, no backend. Data in `js/data.js`, pure logic in `js/logic.js` (shared by Node tests and the browser), UI in `js/app.js`, strings in `js/i18n.js` (generated -- see below).

## Run it

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Regenerating the Bengali strings

`js/i18n.js` is generated from `tools/gen_i18n.py` (the single source of truth for all UI strings, English + Bengali). After editing the strings, regenerate:

```sh
python3 tools/gen_i18n.py
```

The generator asserts the English and Bengali key sets match and writes pure-ASCII output, so a GitHub push can never corrupt Bengali text in transit.

## Testing

```sh
node --test tests/logic.test.js   # 14 unit tests: dataset, fares, ceiling formula, calc, validation, import
node tests/smoke.js               # 85 headless-Chrome checks (raw CDP): calculator, table, formula,
                                  # class guide, rules, save/export/import/erase, Bengali toggle,
                                  # 390px mobile, zero network requests, zero console errors
```

Results: see `TEST_RESULTS.md`.

## Limitations

- Fares are estimates from the sources listed in `DATA_NOTES.md`, checked 2026-11-11. Launch operators change prices without notice, especially around Eid and fuel-price hikes. **Always confirm at the counter.**
- Only 6 routes have sourced fares. Patuakhali has a deck fare only -- no cabin fare could be verified, so none is shown.
- The per-km formula gives the official **maximum** deck fare (a ceiling). Operators usually charge less (e.g. Barisal deck is 350 Tk; the ceiling for 180 km is 497 Tk).
- Child fares (half fare 5-12, free under 5) are common practice, not a verified official rule.
- No live data, no booking, no departure times -- this is a fare reference, not a ticket service.

## Status

Factory run #306 (14:00 slot, 2026-11-11). Complete, tested, published. Not affiliated with BIWTA, BIWTC or any launch operator.
