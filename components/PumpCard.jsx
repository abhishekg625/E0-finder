"use client";

const BRAND_SHORT = {
  "Indian Oil (IOCL)": "IOCL",
  "HP (HPCL)": "HPCL",
  "Bharat Petroleum (BPCL)": "BPCL",
  "Nayara Energy": "Nayara",
  "bp / Jio-bp": "bp",
  "Shell": "Shell",
  "Reliance": "Reliance",
  "Indraprastha Gas (IGL)": "IGL",
  "GAIL": "GAIL",
};

function osmUrl(id) {
  const m = /^osm-(node|way|relation)-(\d+)$/.exec(id || "");
  return m ? `https://www.openstreetmap.org/${m[1]}/${m[2]}` : null;
}

function directionsUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

function E0Circle({ status }) {
  const cls = status === true ? "e0-circle e0-circle-yes" : status === false ? "e0-circle e0-circle-no" : "e0-circle e0-circle-unknown";
  return <div className={cls}>E0</div>;
}

export default function PumpCard({ pump }) {
  const brandShort = BRAND_SHORT[pump.brand] || pump.brand || "";
  const editUrl = osmUrl(pump.id);

  return (
    <li className="pcard">
      <E0Circle status={pump.e0} />
      <div className="pcard-body">
        <div className="pcard-name">{pump.name}</div>
        <div className="pcard-meta">
          {brandShort && <span className="brand-badge">{brandShort}</span>}
          <span>{[pump.addr, pump.city].filter(Boolean).join(", ")}</span>
        </div>
        <div className="pcard-status">
          {pump.e0 === true && "E0 confirmed on OpenStreetMap."}
          {pump.e0 === false && "Marked not ethanol-free on OpenStreetMap."}
          {pump.e0 === "unknown" && "Not yet verified — unknown, not ruled out."}
          {pump.d != null && ` ▸ ${pump.d.toFixed(1)} km away`}
        </div>
        <div className="pcard-actions">
          {pump.phone && <a className="pcard-link" href={`tel:${pump.phone.replace(/\s+/g, "")}`}>📞 {pump.phone}</a>}
          {editUrl && (
            <a className="pcard-link" href={editUrl} target="_blank" rel="noopener noreferrer">
              Verify / edit on OSM ↗
            </a>
          )}
        </div>
      </div>
      <a className="btn ghost pcard-dir" href={directionsUrl(pump.lat, pump.lon)} target="_blank" rel="noopener noreferrer">
        Directions
      </a>
    </li>
  );
}
