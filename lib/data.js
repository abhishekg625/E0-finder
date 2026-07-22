/* =========================================================================
   Data layer — runs at BUILD TIME (server side, during `next build`).
   Reads the pre-generated public/data/pumps.json (produced by
   `npm run update-pumps`, which pulls from OpenStreetMap Overpass). Falls
   back to the tiny illustrative data/seed.json only when pumps.json hasn't
   been generated yet, so a fresh checkout can still build.
   ========================================================================= */
import { readFile } from "node:fs/promises";
import path from "node:path";

const titleCase = (s) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");
export const slugify = (s) => {
  const slug = s.toLowerCase().normalize("NFKD").replace(COMBINING_MARKS, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-");
  return slug || "unlisted";
};

async function loadGenerated() {
  const raw = await readFile(path.join(process.cwd(), "public", "data", "pumps.json"), "utf8");
  return JSON.parse(raw).pumps;
}

async function loadSeed() {
  const raw = await readFile(path.join(process.cwd(), "data", "seed.json"), "utf8");
  return JSON.parse(raw).pumps;
}

async function mergeExtra(pumps) {
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "extra.json"), "utf8");
    return pumps.concat(JSON.parse(raw));
  } catch {
    return pumps; // no extra file — fine
  }
}

function clean(pumps) {
  const seen = new Set();
  const out = [];
  for (const p of pumps) {
    const key = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let city = (p.city || "").replace(/\s*,.*$/, "").trim();
    city = city ? titleCase(city) : "Unlisted";
    out.push({ ...p, city, state: titleCase(p.state || ""), citySlug: slugify(city) });
  }
  return out;
}

let _cache = null;

/** Returns { pumps, groups, stats }. Memoized across pages in one build. */
export async function getData() {
  if (_cache) return _cache;

  let pumps;
  try {
    pumps = await loadGenerated();
    if (!pumps.length) throw new Error("pumps.json has 0 pumps");
    console.log(`[data] loaded ${pumps.length} pumps from public/data/pumps.json`);
  } catch (e) {
    console.warn(`[data] pumps.json unavailable (${e.message}); using illustrative seed.json — run "npm run update-pumps" for real data`);
    pumps = await loadSeed();
  }
  pumps = clean(await mergeExtra(pumps));

  const map = new Map();
  for (const p of pumps) {
    if (!map.has(p.citySlug))
      map.set(p.citySlug, { slug: p.citySlug, city: p.city, state: p.state, pumps: [] });
    map.get(p.citySlug).pumps.push(p);
  }
  // "unlisted" is a data-quality bucket (pumps with no addr:city in OSM), not
  // a real place — keep it last regardless of size so it never reads as
  // the "most popular" city.
  const groups = [...map.values()].sort((a, b) => {
    if (a.slug === "unlisted") return 1;
    if (b.slug === "unlisted") return -1;
    return b.pumps.length - a.pumps.length;
  });
  const states = new Set(pumps.map((p) => p.state).filter(Boolean));
  const e0Known = pumps.filter((p) => p.e0 === true || p.e0 === false).length;

  _cache = {
    pumps,
    groups,
    stats: { total: pumps.length, cities: groups.length, states: states.size, e0Known },
  };
  return _cache;
}
