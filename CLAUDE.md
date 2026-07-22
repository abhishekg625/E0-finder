# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js (App Router) static-export site mapping petrol pumps across India, with a
particular focus on flagging which are confirmed to sell ethanol-free (E0) premium
fuel. Pump data comes from OpenStreetMap; there is no backend or database — everything
is either a build-time-generated JSON file or client-side fetch/state.

## Commands

```bash
npm install
npm run dev              # dev server at http://localhost:3000
npm run update-pumps      # regenerate public/data/pumps.json from OSM Overpass (takes ~1 min, hits a public API)
npm run build             # next build -> static export to ./out (reads public/data/pumps.json, does NOT hit the network)
npx serve out              # preview the static export locally
npm run lint
```

There is no test suite in this repo.

`npm run update-pumps` talks to the public Overpass API and can take multiple retries —
its own retry/backoff logic handles Overpass returning HTTP 200 with an HTML "server
busy" page (not just 5xx), which happens often on the free instance. Don't skip that
retry logic when touching the script; a naive `res.json()` will occasionally crash on
a busy-server HTML response.

## Architecture

### Data pipeline (build-time, not request-time)

1. `scripts/update-pumps.mjs` queries Overpass for **every** `amenity=fuel` node in
   India (not just E0-tagged ones — OSM currently has **zero** stations in India tagged
   `fuel:e0=yes` or `fuel:ethanol_free=yes`), normalizes and dedupes them, and writes
   `public/data/pumps.json`. This is a manual/periodic step, not part of `npm run build`.
   Output is committed to git (it's the only real content this site has).
2. `lib/data.js`'s `getData()` reads that generated file at Next.js build time (used by
   `generateStaticParams`/`generateMetadata`/page components across `app/`). If
   `public/data/pumps.json` doesn't exist, it falls back to `data/seed.json` — a tiny
   set of explicitly fake/illustrative "(sample)" pumps, only ever meant to let a fresh
   checkout build without having run the crawler. **Never treat seed.json data as real
   or merge it into the generated dataset** — it exists purely so `next build` doesn't
   fail on a fresh clone.
3. `getData()` also groups pumps by city (`groups`) and computes `stats` (including
   `e0Known`, the count of pumps with a confirmed true/false E0 status — almost always
   near zero given point 1). The `"unlisted"` city group (pumps OSM has no `addr:city`
   for — currently ~92% of all pumps) is explicitly sorted last regardless of count, so
   it never appears as a "top city" by size.

### E0 status is tri-state, everywhere

`pump.e0` is `true | false | "unknown"`, never a plain boolean. `"unknown"` means "OSM
has no data," not "confirmed not E0" — UI copy and any new code must preserve that
distinction. This is the central data-integrity constraint of the whole project: since
real E0 tagging is currently ~0%, treating "unknown" as "false" would make almost every
pump look confirmed-not-E0, which is wrong.

### Static export vs. client-side data loading

The site is a full static export (`output: "export"` in `next.config.mjs`,
`trailingSlash: true`). Two different patterns are used for pump data depending on
page scope, and this distinction matters if you're adding a new page:

- **City pages** (`app/city/[slug]/page.jsx`) pass their (small, per-city) pump list
  directly as server-rendered props into `<MapView pumps={...} />`.
- **The `/find/` page** (nationwide, ~19k pumps) instead passes
  `<MapView dataUrl="/data/pumps.json" />`, which fetches the JSON client-side after
  mount. Embedding the full dataset in page props once bloated `/find/`'s HTML/RSC
  payload badly — don't reintroduce that by passing the full `pumps`/`groups` (with
  nested pump arrays) into any client component. `components/CityBrowser.jsx` follows
  the same rule: it only ever receives lightweight `{slug, city, state, count}` objects,
  not full pump arrays, even though `getData()`'s `groups` has the full arrays available.

### MapView's async-mount gotcha

`components/MapView.jsx` dynamically imports Leaflet inside a `useEffect` (Leaflet
touches `window`, which doesn't exist during static export). Marker drawing is a
*separate* effect keyed on the filtered/sorted pump list, plus an explicit `mapReady`
state flag — both are required. If you key the marker-draw effect on the pump list
alone, markers won't render on any page where the pump list is static from mount (i.e.
every page except `/find/`, where a post-mount data fetch happens to change state and
mask the bug). This was a real, previously-shipped bug — don't remove the `mapReady`
dependency when touching this file.

### Brand normalization

Raw OSM `brand`/`operator` tags for Indian fuel retailers are extremely inconsistent
(~300 raw strings for a handful of real companies — typos, abbreviations, case
variants). `scripts/update-pumps.mjs`'s `canonicalBrand()` collapses only the
*unambiguous* ones (regex list in `BRAND_PATTERNS`) into canonical names like
`"Indian Oil (IOCL)"`; anything not confidently matched is left as titlecased raw text
rather than guessed. `components/MapView.jsx`'s `KNOWN_BRANDS` list and
`components/PumpCard.jsx`'s `BRAND_SHORT` map must stay in sync with the canonical
names produced by `canonicalBrand()` — brands outside `KNOWN_BRANDS` fall into an
"Other" filter bucket.

### No backend — by design, for now

There's no database, no auth, no write path. The "Verify / edit on OSM" link in
`components/PumpCard.jsx` points users to the actual OpenStreetMap node/way to correct
data upstream — that's the real feedback loop today. A Supabase-backed community
verification system (price reporting, "was E0 available here" voting) has been
discussed as a future phase but is intentionally not built: don't add UI that implies
live voting/verification/pricing works unless a real backend is wired up alongside it.

### Offline support

`public/sw.js` is a minimal network-first service worker (registered by
`components/ServiceWorkerRegister.jsx` in `app/layout.jsx`), precaching the shell routes
and `/data/pumps.json`. It's hand-written, not generated by a framework plugin — keep
that in mind if the caching strategy needs to change.

### Theming

Dark/light theme is handled via a `data-theme` attribute on `<html>`, set by an inline
script in `app/layout.jsx` (before hydration, to avoid a flash) and toggled by
`components/ThemeToggle.jsx` via `localStorage`. All colors are CSS custom properties in
`app/globals.css` (`:root` for dark/default, `:root[data-theme="light"]` overrides) —
new UI should use those variables rather than hardcoded colors.

## Configuration (env vars, used by `update-pumps.mjs` and `next build`)

| Var | Default | Purpose |
|-----|---------|---------|
| `SITE_URL` | `https://example.pages.dev` | Canonical/OG URLs (used in `app/layout.jsx`) |
| `COUNTRY_ISO` | `IN` | Country to query in the Overpass crawler |
| `OVERPASS_URL` | `https://overpass-api.de/api/interpreter` | Overpass endpoint |
