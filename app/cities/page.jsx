import { getData } from "../../lib/data";
import CityBrowser from "../../components/CityBrowser";

export const metadata = {
  title: "Ethanol-free petrol by city",
  description: "Browse cities with ethanol-free (E0) premium petrol pumps.",
  alternates: { canonical: "/cities/" },
};

export default async function CitiesPage() {
  const { groups } = await getData();
  const light = groups.map((g) => ({ slug: g.slug, city: g.city, state: g.state, count: g.pumps.length }));
  return (
    <>
      <section className="page-head">
        <h1>Petrol pumps, city by city</h1>
        <p className="lede">
          {groups.length} cities in the data so far. Search, filter by state, or pick one
          to see its pumps and which are confirmed ethanol-free.
        </p>
      </section>
      <CityBrowser groups={light} />
    </>
  );
}
