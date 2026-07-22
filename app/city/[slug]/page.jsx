import Link from "next/link";
import { notFound } from "next/navigation";
import { getData } from "../../../lib/data";
import MapView from "../../../components/MapView";

export async function generateStaticParams() {
  const { groups } = await getData();
  return groups.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }) {
  const { groups } = await getData();
  const g = groups.find((x) => x.slug === params.slug);
  if (!g) return {};
  return {
    title: `Ethanol-free petrol in ${g.city}`,
    description: `Ethanol-free (E0) petrol pumps in ${g.city}. Unofficial — confirm at the pump.`,
    alternates: { canonical: `/city/${g.slug}/` },
  };
}

export default async function CityPage({ params }) {
  const { groups } = await getData();
  const g = groups.find((x) => x.slug === params.slug);
  if (!g) notFound();

  const light = g.pumps.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon, addr: p.addr, city: p.city }));
  const center = light.length ? [light[0].lat, light[0].lon] : [22.35, 78.66];

  return (
    <>
      <section className="page-head">
        <Link className="back" href="/cities/">← All cities</Link>
        <h1>Ethanol-free petrol in {g.city}</h1>
        <p className="lede">
          {g.pumps.length} pump{g.pumps.length === 1 ? "" : "s"} on record in {g.city}
          {g.state ? `, ${g.state}` : ""}.
        </p>
      </section>

      <MapView pumps={light} initial={center} zoom={12} />

      <ul className="pump-list">
        {g.pumps.map((p) => (
          <li key={p.id} className="pump">
            <div className="p-name">{p.name}</div>
            <div className="p-meta">{[p.addr, p.city].filter(Boolean).join(", ")}</div>
            <a
              className="p-dir"
              href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in map ↗
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
