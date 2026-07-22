#!/usr/bin/env node
/* Pulls every fuel station in India from OpenStreetMap Overpass and writes
   public/data/pumps.json. Run with: npm run update-pumps

   E0 (ethanol-free) status is derived from OSM's fuel:e0 / fuel:ethanol_free
   tags. As of writing, no station in India carries either tag, so every
   record ships with e0:"unknown" until someone (OSM mapper or, later, our
   own community reports) actually confirms it one way or the other. Treat
   "unknown" as "no data", not as "confirmed absent". */

import { writeFile } from "node:fs/promises";
import path from "node:path";

const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const COUNTRY_ISO = process.env.COUNTRY_ISO || "IN";
const OUT_PATH = path.join(process.cwd(), "public", "data", "pumps.json");

const OVERPASS_QUERY = `
[out:json][timeout:180];
area["ISO3166-1"="${COUNTRY_ISO}"][admin_level=2]->.country;
(
  nwr["amenity"="fuel"](area.country);
);
out center tags;`;

const titleCase = (s) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");
const slugify = (s) => {
  const slug = s.toLowerCase().normalize("NFKD").replace(COMBINING_MARKS, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-");
  return slug || "unlisted";
};

const YES_NO = (v) => (v === "yes" ? true : v === "no" ? false : null);

async function fetchFromOSM() {
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "User-Agent": "e0-finder/1.0 (+https://github.com/abhishekg625/E0-finder)",
    },
    body: OVERPASS_QUERY,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = await res.json();
  return json.elements || [];
}

function normalize(el) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const e0Tag = t["fuel:e0"] ?? t["fuel:ethanol_free"];
  let city = (t["addr:city"] || t["addr:suburb"] || t["addr:district"] || "").replace(/\s*,.*$/, "").trim();
  city = city ? titleCase(city) : "Unlisted";

  return {
    id: `osm-${el.type}-${el.id}`,
    brand: t.brand || t.operator || "",
    name: t.name || t.brand || t.operator || "Fuel station",
    addr: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
    city,
    citySlug: slugify(city),
    state: titleCase(t["addr:state"] || ""),
    lat,
    lon,
    fuel: {
      petrol: t["fuel:octane_91"] === "yes" || t["fuel:octane_95"] === "yes" || YES_NO(t["fuel:petrol"]) !== false,
      diesel: YES_NO(t["fuel:diesel"]),
      xp95: null,
      xp100: null,
      power100: null,
      speed100: null,
    },
    e0: e0Tag === "yes" ? true : e0Tag === "no" ? false : "unknown",
    verified: false,
    source: "osm",
  };
}

function dedupe(pumps) {
  const seen = new Set();
  const out = [];
  for (const p of pumps) {
    const key = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

async function main() {
  console.log(`[update-pumps] querying Overpass for amenity=fuel in ${COUNTRY_ISO}...`);
  const elements = await fetchFromOSM();
  console.log(`[update-pumps] received ${elements.length} elements`);

  const pumps = dedupe(elements.map(normalize).filter(Boolean));
  const e0Known = pumps.filter((p) => p.e0 !== "unknown").length;

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "OpenStreetMap Overpass API (ODbL)",
    count: pumps.length,
    e0Known,
    pumps,
  };

  await writeFile(OUT_PATH, JSON.stringify(payload), "utf8");
  console.log(`[update-pumps] wrote ${pumps.length} pumps (${e0Known} with known E0 status) to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("[update-pumps] failed:", err.message);
  process.exitCode = 1;
});
