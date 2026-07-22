"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

/* Leaflet touches `window` at import, so it must load only in the browser.
   We import it dynamically inside useEffect — safe for Next static export. */

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

export default function MapView({ pumps = [], locate = false, initial = [22.35, 78.66], zoom = 5 }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const LRef = useRef(null);
  const userDotRef = useRef(null);
  const [status, setStatus] = useState(locate ? "Loading map…" : "");
  const [sorted, setSorted] = useState(null); // nearest-first list once located
  const [showRefresh, setShowRefresh] = useState(false);
  const originRef = useRef(null);

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
      drawMarkers(pumps);
      if (locate) setStatus(`${pumps.length} ethanol-free pumps on the map.`);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pinIcon() {
    const L = LRef.current;
    return L.divIcon({
      className: "",
      html: '<div class="pin"><b>E0</b></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -22],
    });
  }

  function drawMarkers(list, fit = true) {
    const L = LRef.current;
    if (!L || !layerRef.current) return;
    layerRef.current.clearLayers();
    const markers = [];
    list.forEach((p) => {
      const m = L.marker([p.lat, p.lon], { icon: pinIcon() }).addTo(layerRef.current);
      const dist = p.d != null ? `<br>${p.d.toFixed(1)} km away` : "";
      m.bindPopup(`<b>${escapeHtml(p.name)}</b><br>${escapeHtml(p.addr || p.city || "")}${dist}`);
      markers.push(m);
    });
    if (fit && markers.length) {
      try { mapRef.current.fitBounds(L.featureGroup(markers).getBounds().pad(0.2)); } catch {}
    }
  }

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
        const L = LRef.current;
        if (userDotRef.current) mapRef.current.removeLayer(userDotRef.current);
        userDotRef.current = L.circleMarker([o.lat, o.lon], {
          radius: 8, color: "#ffd23f", fillColor: "#ffd23f", fillOpacity: 0.9,
        }).addTo(mapRef.current).bindPopup("You are here");

        const near = pumps
          .map((p) => ({ ...p, d: haversineKm(o.lat, o.lon, p.lat, p.lon) }))
          .sort((a, b) => a.d - b.d);
        setSorted(near);
        drawMarkers(near);
        mapRef.current.setView([o.lat, o.lon], 11);
        setStatus(near[0] ? `Closest pump: ${near[0].d.toFixed(1)} km away.` : "No pumps found nearby.");
        setShowRefresh(true);
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

  async function onLiveRefresh() {
    const o = originRef.current;
    if (!o) return;
    setStatus("Fetching latest ethanol-free stations near you from OpenStreetMap…");
    const q =
      "[out:json][timeout:25];(" +
      `node["amenity"="fuel"]["fuel:e0"="yes"](around:30000,${o.lat},${o.lon});` +
      `node["amenity"="fuel"]["fuel:ethanol_free"="yes"](around:30000,${o.lat},${o.lon});` +
      ");out center tags;";
    try {
      const r = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST", headers: { "Content-Type": "text/plain" }, body: q,
      });
      if (!r.ok) throw new Error(`Overpass ${r.status}`);
      const d = await r.json();
      const live = (d.elements || [])
        .map((e) => {
          const t = e.tags || {};
          return {
            name: t.name || t.brand || "E0 station",
            lat: e.lat ?? e.center?.lat,
            lon: e.lon ?? e.center?.lon,
            addr: [t["addr:street"], t["addr:city"]].filter(Boolean).join(", "),
          };
        })
        .filter((p) => p.lat != null)
        .map((p) => ({ ...p, d: haversineKm(o.lat, o.lon, p.lat, p.lon) }))
        .sort((a, b) => a.d - b.d);
      if (live.length) {
        setSorted(live);
        drawMarkers(live);
        setStatus(`Live: ${live.length} tagged station(s) within 30 km.`);
      } else {
        setStatus("No live OSM-tagged stations within 30 km. Showing the mapped set.");
      }
    } catch (e) {
      setStatus(`Live refresh failed: ${e.message}`);
    }
  }

  const list = sorted;

  return (
    <div>
      {locate && (
        <div className="cta-row">
          <button className="btn primary" type="button" onClick={onLocate}>Use my location</button>
          {showRefresh && (
            <button className="btn ghost" type="button" onClick={onLiveRefresh}>Refresh live from OSM</button>
          )}
        </div>
      )}
      {locate && <p className="status" role="status" aria-live="polite">{status}</p>}
      <div ref={mapEl} className="map" role="application" aria-label="Map of ethanol-free pumps" />
      {list && (
        <ul className="results">
          {list.slice(0, 30).map((p, i) => (
            <li key={i} className="card">
              <div className="name">{p.name}</div>
              <div className="addr">{p.addr || p.city}</div>
              {p.d != null && <div className="dist">▸ {p.d.toFixed(1)} km away</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
