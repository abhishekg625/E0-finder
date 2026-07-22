import Link from "next/link";
import { getData } from "../../lib/data";

export const metadata = {
  title: "Ethanol-free petrol by city",
  description: "Browse cities with ethanol-free (E0) premium petrol pumps.",
  alternates: { canonical: "/cities/" },
};

export default async function CitiesPage() {
  const { groups } = await getData();
  return (
    <>
      <section className="page-head">
        <h1>Petrol pumps, city by city</h1>
        <p className="lede">
          {groups.length} cities in the data so far. Pick one to see its pumps and which
          are confirmed ethanol-free.
        </p>
      </section>
      <section className="city-grid">
        {groups.map((g) => (
          <Link key={g.slug} className="city-card" href={`/city/${g.slug}/`}>
            <span className="c-name">{g.city}</span>
            <span className="c-meta">{g.state || "—"} · {g.pumps.length}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
