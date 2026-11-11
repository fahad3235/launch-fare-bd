# DATA_NOTES.md -- launch-fare-bd

All fares were checked by web search on 2026-11-11. A fare cell is either a
fixed price (one number) or a reported range `[lo, hi]` (the counter may quote
any price inside it). The app badges every cell: **Verified** (two or more
independent sources, or an official notice), **Single source** (one source
only), **Reports vary** (sources disagree).

## The official per-km ceiling (used by the Formula tab)

- Ministry of Shipping gazette, effective 5 May 2026, under Rule 27 of the
  Bangladesh Inland Water Transport (Nautical Routes, Permits, Timetables and
  Fare Fixation) Rules, 2019: **2.95 Tk/km for the first 100 km, 2.52 Tk/km
  beyond 100 km, minimum fare 32 Tk**. Previous rates were 2.77 / 2.38 / 29 Tk.
- Reported by New Age ("Bangladesh govt increases launch fare by up to Tk 0.18
  a kilometre", 6 May 2026) and TBS ("Govt increases launch fares by up to 18
  paisa per km", 6 May 2026), both citing the gazette / Prothom Alo.
- An earlier Financial Express report (22 Apr 2026) quoted a BIWTA/owners
  meeting agreeing 3.00 / 2.57 Tk/km with a 35 Tk minimum -- that was a
  *proposal* sent for approval; the gazette figures above (2.95 / 2.52 / 32)
  supersede it and are the ones in the app.
- The formula is a **maximum** (ceiling), not the price charged. Worked
  check: 180 km -> 295 + 80 x 2.52 = 496.6 -> 497 Tk ceiling, while the
  Barisal deck fare actually charged is 350 Tk.

## Route fares

### Dhaka-Barisal (regular launches) -- VERIFIED for deck/single/double
- Deck **350 Tk**, single cabin **1,200 Tk**, double cabin **2,400 Tk**.
  The Daily Star ("Dhaka-Barishal launch fares rise 17-20% after Tk 20 diesel
  price hike") and Dhaka Tribune ("Launch fares rise without official order...",
  22 Apr 2026) agree: deck rose 300 -> 350, single 1,000 -> 1,200, double
  2,000 -> 2,400 after the April 2026 diesel hike. A March 2026 Dhaka
  Tribune Eid report still quoted single 1,200 / double 2,000, consistent
  with the hike landing in April.
- Family cabin **2,000-3,500 Tk** and VIP cabin **6,000-8,000 Tk** -- ranges
  from the launch-route.vercel.app community dataset (MV Adventure 1).
  Conflicts: Financial Express (Eid 2022) quoted family 4,000 and VIP 6,000.
  Badged **Reports vary**; the calculator uses the range midpoint.
- Journey 6-7 h, overnight; evening departures from Sadarghat.

### Dhaka-Barisal, PS Mahsud steamer -- VERIFIED
- Deck **600 Tk**, Second Class **1,650 Tk**, First Class **2,600 Tk**.
  BSS (29 Nov 2025): BIWTC set these fares when the historic paddle steamer
  resumed service after 3 years; weekly, departs Dhaka Fridays 08:30,
  returns Saturdays 08:30. 12 first-class cabins (24 berths), 10 second-class
  cabins (40 berths), deck 900+.

### Dhaka-Chandpur -- SINGLE SOURCE (travel blog, Dec 2025)
- Deck **100-150**, Chair **250-300**, single non-AC **500-600**, single AC
  **700-800**, double non-AC **1,000-1,200**, double AC **1,200-1,500**,
  VIP **2,000-3,000** (rakibulislamnayon.com, "Chandpur to Dhaka Launch
  Time", published 10 Dec 2025).
- Deck conflict: Financial Express (19 Mar 2026) reports Chandpur passengers
  saying a trip "that should cost Tk 100 is being charged Tk 200 to 250".
  The deck cell is therefore badged **Reports vary**; the other Chandpur
  cells are **Single source**.
- Journey 3-4 h; ~20-30 launches/day on the route (FE, Mar 2026).

### Dhaka-Bhola (Elisha) -- SINGLE SOURCE (2023 page, may be outdated)
- Economy **600**, Business **800**, single cabin **1,000**
  (wikiofinfo.com, "Dhaka To Bhola Launch Schedule", updated 21 Dec 2023).
  The same page lists a "Family Cabin 250" figure that is clearly a typo and
  is NOT included. No deck fare is listed for this route (Greenline-style
  seated launches), so none is shown.
- Journey 5-6 h to Elisha ghat.

### Dhaka-Hatiya (Tamaruddi) -- SINGLE SOURCE (2026 guide)
- Deck **400-600**, single cabin **1,500-2,200**, double cabin **2,500-3,500**
  (unseenbangladesh.com, "Nijhum Dwip Travel Guide and Cost 2026",
  published 29 Oct 2026). Daily 17:30 departure, ~12-14 h overnight.
- Journey 12-14 h.

### Dhaka-Patuakhali -- SINGLE SOURCE (2022 report, stale)
- Deck **400-480** (Financial Express, "Passengers throng Sadarghat
  terminal", Eid 2022: deck fares on Dhaka-Barisal / Patuakhali / Barguna
  routes "range between Tk 400 and Tk 480"). This is the only Patuakhali
  figure found; it is 4 years old and Eid-season, so it is badged
  **Single source** and no cabin fare is shown (none could be verified).
- Journey ~7-8 h, overnight.

## Child fares -- UNVERIFIED, labelled in the app

No official BIWTA child-fare rule was found in any source searched on
2026-11-11 (the search returned only Indian railway and Dhaka metro rules,
which do not apply). One travel blog (bd-info.com, Barisal page) claims
"children under 12 can travel free", which contradicts the usual practice
and is not trusted. The app therefore uses the common practice reported by
travellers -- **half fare for ages 5-12, free under 5** -- and says so in the
calculator note, the rules tab and this file. Confirm at the counter.

## Booking practice (rules tab)

- Deck: sold at the terminal on the day, no advance booking.
- Cabins: usually booked 2-4 days ahead by phone, often 50% advance via
  bKash/Nagad (vromonkari.com guide; rakibulislamnayon.com Barisal guide).
- Eid / public holidays: fares commonly rise 10-20% (Chandpur blog).
- Complaints about overcharging: BIWTA river-port office, Sadarghat
  (the app's rule 8 is advice, not a verified procedure).

## What is NOT in the app

- No fare is shown for a route/class without a source (e.g. Patuakhali
  cabins, Bhola deck, Barisal chair). Absent cells are never invented.
- No departure timetable (departures change daily and are not published in
  a stable form); the app gives journey durations only.
- No live data, no booking, no operator contact numbers (numbers change
  often and could not be verified as current).
