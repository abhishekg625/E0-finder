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
        Pump locations for all of India come from{" "}
        <a href="https://www.openstreetmap.org/" rel="noopener noreferrer">OpenStreetMap</a>,
        via the Overpass API. A station is marked <strong>E0 confirmed</strong> only when it
        carries OSM's <code>fuel:e0=yes</code> or <code>fuel:ethanol_free=yes</code> tag.
      </p>
      <p>
        As of this build, essentially no stations in India have that tag yet —{" "}
        {stats.e0Known} confirmed out of {stats.total} pumps mapped. That is not the same as
        confirmed <em>not</em> ethanol-free: it almost always just means nobody has recorded
        it. Treat every unbadged pump as <strong>unverified</strong>, not ruled out.
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
        Found a pump that's missing, wrong, or actually stocks E0? The best fix is to add or
        correct the tag on OpenStreetMap itself — the dataset here is regenerated from OSM
        periodically (via <code>npm run update-pumps</code>), so edits get picked up on the
        next refresh. Currently mapping {stats.total} pumps across {stats.cities} cities.
      </p>
    </section>
  );
}
