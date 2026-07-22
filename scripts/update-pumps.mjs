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

// OSM has ~300 raw brand strings for a handful of actual companies (typos,
// abbreviations, case variants). Collapse the unambiguous ones so the
// brand filter is usable; leave anything not confidently matched as-is
// rather than guessing.
const BRAND_PATTERNS = [
  [/indian\s*oil|\biocl\b|\bioc\b/i, "Indian Oil (IOCL)"],
  [/hindust[ha]n\s*petro|\bhpcl\b|^hp$/i, "HP (HPCL)"],
  [/bharath?\s*petro|\bbpcl\b/i, "Bharat Petroleum (BPCL)"],
  [/nayara|essar/i, "Nayara Energy"],
  [/jio.?bp|^bp$/i, "bp / Jio-bp"],
  [/shell/i, "Shell"],
  [/reliance/i, "Reliance"],
  [/\bigl\b|indraprastha\s*gas/i, "Indraprastha Gas (IGL)"],
  [/\bgail\b/i, "GAIL"],
];

function canonicalBrand(raw) {
  const b = (raw || "").trim();
  if (!b) return "";
  for (const [re, canonical] of BRAND_PATTERNS) {
    if (re.test(b)) return canonical;
  }
  return titleCase(b);
}

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");
const slugify = (s) => {
  const slug = s.toLowerCase().normalize("NFKD").replace(COMBINING_MARKS, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-");
  return slug || "unlisted";
};

const YES_NO = (v) => (v === "yes" ? true : v === "no" ? false : null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchFromOSM(attempt = 1) {
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "User-Agent": "e0-finder/1.0 (+https://github.com/abhishekg625/E0-finder)",
    },
    body: OVERPASS_QUERY,
  });
  if (!res.ok) {
    if ([502, 503, 504].includes(res.status) && attempt < 5) {
      const wait = attempt * 20000;
      console.warn(`[update-pumps] Overpass HTTP ${res.status} (attempt ${attempt}); retrying in ${wait / 1000}s...`);
      await sleep(wait);
      return fetchFromOSM(attempt + 1);
    }
    throw new Error(`Overpass HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    // Overpass returns a 200 OK HTML error page when its server is too
    // busy to handle the query — not a real failure, just needs a retry.
    const text = await res.text();
    if (attempt >= 5) throw new Error(`Overpass returned non-JSON after ${attempt} attempts: ${text.slice(0, 200)}`);
    const wait = attempt * 20000;
    console.warn(`[update-pumps] Overpass busy (attempt ${attempt}); retrying in ${wait / 1000}s...`);
    await sleep(wait);
    return fetchFromOSM(attempt + 1);
  }

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
    brand: canonicalBrand(t.brand || t.operator || ""),
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
    phone: t.phone || t["contact:phone"] || "",
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
