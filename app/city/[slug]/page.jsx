import Link from "next/link";
import { notFound } from "next/navigation";
import { getData } from "../../../lib/data";
import MapView from "../../../components/MapView";
import PumpCard from "../../../components/PumpCard";

export async function generateStaticParams() {
  const { groups } = await getData();
  return groups.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }) {
  const { groups } = await getData();
  const g = groups.find((x) => x.slug === params.slug);
  if (!g) return {};
  return {
    title: `Petrol pumps in ${g.city}`,
    description: `Petrol pumps in ${g.city}, with ethanol-free (E0) status where confirmed. Unofficial — confirm at the pump.`,
    alternates: { canonical: `/city/${g.slug}/` },
  };
}

export default async function CityPage({ params }) {
  const { groups } = await getData();
  const g = groups.find((x) => x.slug === params.slug);
  if (!g) notFound();

  const light = g.pumps.map((p) => ({
    id: p.id, name: p.name, lat: p.lat, lon: p.lon, addr: p.addr, city: p.city, brand: p.brand, e0: p.e0,
  }));
  const center = light.length ? [light[0].lat, light[0].lon] : [22.35, 78.66];
  const e0Count = g.pumps.filter((p) => p.e0 === true).length;

  return (
    <>
      <section className="page-head">
        <Link className="back" href="/cities/">← All cities</Link>
        <h1>Petrol pumps in {g.city}</h1>
        <p className="lede">
          {g.pumps.length} pump{g.pumps.length === 1 ? "" : "s"} on record in {g.city}
          {g.state ? `, ${g.state}` : ""}.{" "}
          {e0Count > 0
            ? `${e0Count} confirmed ethanol-free.`
            : "None confirmed ethanol-free yet — verification is in progress."}
        </p>
      </section>

      <MapView pumps={light} initial={center} zoom={12} showList={false} />

      <ul className="results">
        {g.pumps.map((p) => <PumpCard key={p.id} pump={p} />)}
      </ul>
    </>
  );
}
