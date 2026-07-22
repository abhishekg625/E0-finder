import Link from "next/link";
import { getData } from "../lib/data";

export default async function Home() {
  const { stats, groups } = await getData();
  const popularCities = groups.filter((g) => g.slug !== "unlisted").slice(0, 12);
  return (
    <>
      <section className="hero">
        <p className="eyebrow">
          {stats.total} pumps mapped · {stats.e0Known} confirmed E0 · {stats.cities} cities · from OpenStreetMap
        </p>
        <h1>Petrol pumps mapped,<br />ethanol-free ones flagged as we confirm them.</h1>
        <p className="lede">
          India is moving to E20 at the pump. If your engine runs best on ethanol-free
          (E0) premium fuel, this map helps you find nearby stations — and shows which
          ones are confirmed to stock it, versus not yet verified.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/find/">Find near me</Link>
          <Link className="btn ghost" href="/cities/">Browse by city</Link>
        </div>
        <p className="fineprint">No login. No signup. Open data, open source.</p>

        <p className="fineprint" style={{ marginTop: 22 }}>Popular cities</p>
        <div className="popular-cities">
          {popularCities.map((g) => (
            <Link key={g.slug} href={`/city/${g.slug}/`}>
              {g.city} <span style={{ opacity: 0.6 }}>({g.pumps.length})</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rail">
        <div className="stat"><span className="num">{stats.total}</span><span className="lab">pumps mapped</span></div>
        <div className="stat"><span className="num">{stats.e0Known}</span><span className="lab">confirmed E0</span></div>
        <div className="stat"><span className="num">{stats.cities}</span><span className="lab">cities</span></div>
        <div className="stat"><span className="num">{stats.states}</span><span className="lab">states</span></div>
      </section>
    </>
  );
}
