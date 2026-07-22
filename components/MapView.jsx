"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import PumpCard from "./PumpCard";

/* Leaflet touches `window` at import, so it must load only in the browser.
   We import it dynamically inside useEffect — safe for Next static export. */

const KNOWN_BRANDS = [
  "Indian Oil (IOCL)",
  "HP (HPCL)",
  "Bharat Petroleum (BPCL)",
  "Nayara Energy",
  "bp / Jio-bp",
  "Shell",
  "Reliance",
  "Indraprastha Gas (IGL)",
  "GAIL",
];

function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const dLa = ((bLat - aLat) * Math.PI) / 180;
  const dLo = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLa / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

function brandBucket(brand) {
  if (!brand) return "Unbranded";
  return KNOWN_BRANDS.includes(brand) ? brand : "Other";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * pumps: pre-loaded list (used for small per-city subsets).
 * dataUrl: fetched client-side instead (used for the nationwide /find/ map,
 * so the ~4.5 MB dataset never has to be embedded in page HTML).
 * filters: when true, shows search/brand/E0 controls above the map.
 */
export default function MapView({
  pumps: initialPumps = [],
  dataUrl = null,
  locate = false,
  filters = false,
  showList = true,
  initial = [22.35, 78.66],
  zoom = 5,
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const LRef = useRef(null);
  const userDotRef = useRef(null);
  const originRef = useRef(null);

  const [allPumps, setAllPumps] = useState(initialPumps);
  const [status, setStatus] = useState(dataUrl ? "Loading pump data…" : "");
  const [origin, setOrigin] = useState(null);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [e0Only, setE0Only] = useState(false);

  // fetch the full dataset client-side when a dataUrl is given
  useEffect(() => {
    if (!dataUrl) return;
    let cancelled = false;
    fetch(dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setAllPumps(json.pumps || []);
        setStatus(`${(json.pumps || []).length} pumps loaded.`);
      })
      .catch((e) => {
        if (!cancelled) setStatus(`Couldn't load pump data (${e.message}). Try again shortly.`);
      });
    return () => { cancelled = true; };
  }, [dataUrl]);

  const brandOptions = useMemo(() => {
    const present = new Set(allPumps.map((p) => brandBucket(p.brand)));
    const ordered = [...KNOWN_BRANDS.filter((b) => present.has(b))];
    if (present.has("Other")) ordered.push("Other");
    if (present.has("Unbranded")) ordered.push("Unbranded");
    return ordered;
  }, [allPumps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allPumps.filter((p) => {
      if (brand !== "all" && brandBucket(p.brand) !== brand) return false;
      if (e0Only && p.e0 !== true) return false;
      if (q && !`${p.name} ${p.city} ${p.brand} ${p.addr}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allPumps, query, brand, e0Only]);

  const displayList = useMemo(() => {
    if (!origin) return filtered;
    return filtered
      .map((p) => ({ ...p, d: haversineKm(origin.lat, origin.lon, p.lat, p.lon) }))
      .sort((a, b) => a.d - b.d);
  }, [filtered, origin]);

  const [mapReady, setMapReady] = useState(false);

  // init map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapEl.current, { zoomControl: true }).setView(initial, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw markers whenever the filtered/sorted list changes, or once the
  // (asynchronously loaded) map first becomes ready
  useEffect(() => {
    const L = LRef.current;
    if (!L || !layerRef.current || !mapRef.current) return;
    layerRef.current.clearLayers();
    const capped = displayList.slice(0, 500); // keep the map responsive on the nationwide view
    const markers = [];
    capped.forEach((p) => {
      const m = L.marker([p.lat, p.lon], { icon: pinIcon(L, p.e0) }).addTo(layerRef.current);
      const dist = p.d != null ? `<br>${p.d.toFixed(1)} km away` : "";
      const e0Label = p.e0 === true ? "E0 confirmed" : p.e0 === false ? "Not E0" : "E0 status unknown";
      m.bindPopup(
        `<b>${escapeHtml(p.name)}</b><br>${escapeHtml(p.brand || "")}<br>${escapeHtml(p.addr || p.city || "")}<br>${e0Label}${dist}`
      );
      markers.push(m);
    });
    if (!origin && markers.length) {
      try { mapRef.current.fitBounds(L.featureGroup(markers).getBounds().pad(0.2)); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayList, mapReady]);

  function onLocate() {
    if (!("geolocation" in navigator)) {
      setStatus("Geolocation isn’t available in this browser.");
      return;
    }
    setStatus("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const o = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        originRef.current = o;
        setOrigin(o);
        const L = LRef.current;
        if (userDotRef.current) mapRef.current.removeLayer(userDotRef.current);
        userDotRef.current = L.circleMarker([o.lat, o.lon], {
          radius: 8, color: "#ffd23f", fillColor: "#ffd23f", fillOpacity: 0.9,
        }).addTo(mapRef.current).bindPopup("You are here");
        mapRef.current.setView([o.lat, o.lon], 11);
        setStatus("Showing the closest pumps first.");
      },
      (err) => {
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. You can still browse the map."
            : "Couldn’t get your location."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div>
      {filters && (
        <div className="filter-row">
          <input
            className="search"
            type="search"
            placeholder="Search by name, brand, or city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search pumps"
          />
          <select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Filter by brand">
            <option value="all">All brands</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <label className="toggle">
            <input type="checkbox" checked={e0Only} onChange={(e) => setE0Only(e.target.checked)} />
            E0-confirmed only
          </label>
        </div>
      )}
      {locate && (
        <div className="cta-row">
          <button className="btn primary" type="button" onClick={onLocate}>Use my location</button>
        </div>
      )}
      {(locate || dataUrl) && <p className="status" role="status" aria-live="polite">{status}</p>}
      <div ref={mapEl} className="map" role="application" aria-label="Map of fuel pumps" />
      {showList && (
        <ul className="results">
          {displayList.slice(0, 30).map((p) => <PumpCard key={p.id} pump={p} />)}
          {displayList.length === 0 && allPumps.length > 0 && (
            <li className="card">No pumps match these filters.</li>
          )}
        </ul>
      )}
    </div>
  );
}

// Simple fuel-pump glyph — an inline SVG so it needs no external asset
// (keeps the offline service worker cache self-contained).
const PUMP_SVG = `
<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <rect x="4" y="3" width="10" height="18" rx="1.2"/>
  <rect x="6.5" y="5.5" width="5" height="4" rx="0.5"/>
  <line x1="6" y1="13" x2="12" y2="13"/>
  <path d="M14 8h2.5a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 0 3 0V10l-2.5-2.5"/>
</svg>`;

function pinIcon(L, e0) {
  const cls = e0 === true ? "pin pin-yes" : e0 === false ? "pin pin-no" : "pin pin-unknown";
  return L.divIcon({
    className: "",
    html: `<div class="${cls}">${PUMP_SVG}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -22],
  });
}
