import { getData } from "../../lib/data";

export const metadata = {
  title: "About",
  description: "What E0 (ethanol-free) petrol is, where this data comes from, and the disclaimer.",
  alternates: { canonical: "/about/" },
};

export default async function AboutPage() {
  const { stats } = await getData();
  return (
    <section className="prose">
      <h1>About E0 Finder</h1>
      <p>
        “E0” means petrol with <strong>zero ethanol</strong>. As India rolls out E20
        (20% ethanol) at most pumps, owners of older or specialised engines often look
        for the ethanol-free premium grades — sold under names like XP100, Power and
        Speed. This site maps the stations we can find that stock them.
      </p>

      <h2>Where the data comes from</h2>
      <p>
        Pump locations are pulled from{" "}
        <a href="https://www.openstreetmap.org/" rel="noopener noreferrer">OpenStreetMap</a>{" "}
        — specifically stations tagged <code>fuel:e0=yes</code> or{" "}
        <code>fuel:ethanol_free=yes</code> — using the Overpass API, and rebuilt on each
        deploy. Coverage depends entirely on what volunteers have tagged, so it is{" "}
        <strong>incomplete</strong>.
      </p>

      <h2>Please read — this is unofficial</h2>
      <p>
        This is a community project, not affiliated with any oil company. A pump appearing
        here is <strong>not a guarantee</strong> that ethanol-free fuel is currently in
        stock. Availability changes. <strong>Always confirm at the pump before filling.</strong>{" "}
        Use of this information is at your own risk.
      </p>

      <h2>Improve the map</h2>
      <p>
        Found a pump that’s missing or wrong? The best fix is to add or correct the tag on
        OpenStreetMap itself — every build here picks up those edits. Currently mapping{" "}
        {stats.total} pumps across {stats.cities} cities.
      </p>
    </section>
  );
}
