/* =========================================================================
   Data layer — runs at BUILD TIME (server side, during `next build`).
   Pulls ethanol-free fuel stations from OpenStreetMap (Overpass), cleans and
   groups them. Falls back to data/seed.json when the network is unavailable
   (e.g. offline / restricted CI), so the build never fails.
   ========================================================================= */
import { readFile } from "node:fs/promises";
import path from "node:path";

const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const COUNTRY_ISO = process.env.COUNTRY_ISO || "IN";

const OVERPASS_QUERY = `
[out:json][timeout:180];
area["ISO3166-1"="${COUNTRY_ISO}"][admin_level=2]->.country;
(
  nwr["amenity"="fuel"]["fuel:e0"="yes"](area.country);
  nwr["amenity"="fuel"]["fuel:ethanol_free"="yes"](area.country);
);
out center tags;`;

const titleCase = (s) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();

export const slugify = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-");

async function fetchFromOSM() {
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: OVERPASS_QUERY,
    // Build-time-only fetch; force-cache keeps the route statically exportable.
    cache: "force-cache",
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = await res.json();
  const els = json.elements || [];
  return els.map((el) => {
    const t = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    return {
      id: `osm-${el.type}-${el.id}`,
      name: t.name || t.brand || t.operator || "Ethanol-free fuel station",
      brand: t.brand || t.operator || "",
      lat, lon,
      city: t["addr:city"] || t["addr:suburb"] || t["addr:district"] || "",
      state: t["addr:state"] || "",
      addr: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
      source: "osm",
    };
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
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
    pumps = await fetchFromOSM();
    if (!pumps.length) throw new Error("OSM returned 0 pumps");
    console.log(`[data] OSM pull: ${pumps.length} pumps`);
  } catch (e) {
    console.warn(`[data] OSM unavailable (${e.message}); using seed.json`);
    pumps = await loadSeed();
  }
  pumps = clean(await mergeExtra(pumps));

  const map = new Map();
  for (const p of pumps) {
    if (!map.has(p.citySlug))
      map.set(p.citySlug, { slug: p.citySlug, city: p.city, state: p.state, pumps: [] });
    map.get(p.citySlug).pumps.push(p);
  }
  const groups = [...map.values()].sort((a, b) => b.pumps.length - a.pumps.length);
  const states = new Set(pumps.map((p) => p.state).filter(Boolean));

  _cache = {
    pumps,
    groups,
    stats: { total: pumps.length, cities: groups.length, states: states.size },
  };
  return _cache;
}
