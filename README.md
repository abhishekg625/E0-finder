# E0 Finder — Next.js

Full multi-page site for finding ethanol-free (E0) petrol pumps, built with
**Next.js (App Router)**. Pump data is pulled from **OpenStreetMap** at build time;
city pages are statically generated for SEO. Exports to a static site — deploys to
Cloudflare Pages, Vercel, Netlify, or any static host.

## Stack & why
- **Next.js App Router + static export** (`output: "export"`) — the reference site is
  Next.js too. Per-city pages are pre-rendered with `generateStaticParams`, each with
  its own `<title>`/description/canonical for search. No server needed at runtime.
- **Leaflet + OpenStreetMap tiles** for the map (loaded browser-only so static export works).
- **Zero backend.** The only build-time input is the OpenStreetMap Overpass API.

## Routes
| Route | Rendering | What it is |
|-------|-----------|------------|
| `/` | Static | Home — counts + CTAs |
| `/find/` | Static + client map | Full map, "use my location" (nearest-first), optional live OSM refresh |
| `/cities/` | Static | City index, sorted by pump count |
| `/city/[slug]/` | SSG (one per city) | City map + pump list |
| `/about/` | Static | What E0 is, data source, disclaimer |

## Develop
```bash
npm install
npm run dev        # http://localhost:3000
```

## Build (static export)
```bash
npm run build      # pulls OSM data, writes ./out
npx serve out      # preview the static site
```
The build queries Overpass for stations tagged `fuel:e0=yes` / `fuel:ethanol_free=yes`.
**No network / restricted CI?** It automatically falls back to `data/seed.json` (clearly
labelled sample points) so the build still succeeds.

## Configuration (env vars)
| Var | Default | Purpose |
|-----|---------|---------|
| `SITE_URL` | `https://example.pages.dev` | Canonical / OG URLs |
| `COUNTRY_ISO` | `IN` | Country to query (ISO 3166-1) |
| `OVERPASS_URL` | `https://overpass-api.de/api/interpreter` | Overpass endpoint |

```bash
SITE_URL=https://your-site.pages.dev npm run build
```

## Growing coverage
OSM's ethanol-free tagging is sparse. Two ways to add pumps:
1. Add/verify the tag on OpenStreetMap itself — every rebuild picks it up.
2. Drop `data/extra.json` (an array shaped like `seed.json`'s `pumps`); the build merges it.

## Deploy to Cloudflare Pages
1. Push to a Git repo.
2. Pages → Create project → connect repo.
3. Framework preset: **Next.js (Static HTML Export)** · Build command `npm run build` · Output dir `out`.
4. Add env var `SITE_URL`.
5. Enable **Web Analytics** in the project to track traffic.

## Important — unofficial
Community data from OpenStreetMap. A listed pump is **not** a guarantee of ethanol-free
stock; availability changes. Always confirm at the pump. Use at your own risk.

## Security / dependency notes
- Runtime third party is **Leaflet** + public OSM tiles/Overpass. Verify Leaflet against
  your org's approved-software list before production.
- Public Overpass/Nominatim have fair-use rate limits. The site is static so normal
  browsing hits no API; live Overpass calls fire only when a user taps "Refresh live from OSM".
  For heavy use, self-host Overpass or use a paid endpoint.
