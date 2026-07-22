import Link from "next/link";
import { getData } from "../lib/data";

export default async function Home() {
  const { stats } = await getData();
  return (
    <>
      <section className="hero">
        <p className="eyebrow">
          {stats.total} ethanol-free pumps · {stats.cities} cities · from OpenStreetMap
        </p>
        <h1>Ethanol-free petrol,<br />mapped for the engines that need it.</h1>
        <p className="lede">
          India is moving to E20 at the pump. If your engine runs best on ethanol-free
          (E0) premium fuel, this map helps you find the nearest station stocking it.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/find/">Find near me</Link>
          <Link className="btn ghost" href="/cities/">Browse by city</Link>
        </div>
        <p className="fineprint">No login. No signup. Open data, open source.</p>
      </section>

      <section className="rail">
        <div className="stat"><span className="num">{stats.total}</span><span className="lab">pumps mapped</span></div>
        <div className="stat"><span className="num">{stats.cities}</span><span className="lab">cities</span></div>
        <div className="stat"><span className="num">{stats.states}</span><span className="lab">states</span></div>
      </section>
    </>
  );
}
