"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// groups: [{ slug, city, state, count }] — lightweight, no per-pump data.
export default function CityBrowser({ groups }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");

  const states = useMemo(() => {
    const set = new Set(groups.map((g) => g.state).filter(Boolean));
    return [...set].sort();
  }, [groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => {
      if (state !== "all" && g.state !== state) return false;
      if (q && !g.city.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [groups, query, state]);

  return (
    <>
      <div className="filter-row">
        <input
          className="search"
          type="search"
          placeholder="Search cities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search cities"
        />
        <select value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by state">
          <option value="all">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <section className="city-grid">
        {filtered.map((g) => (
          <Link key={g.slug} className="city-card" href={`/city/${g.slug}/`}>
            <span className="c-name">{g.city}</span>
            <span className="c-meta">{g.state || "—"} · {g.count}</span>
          </Link>
        ))}
        {filtered.length === 0 && <p className="fineprint">No cities match these filters.</p>}
      </section>
    </>
  );
}
