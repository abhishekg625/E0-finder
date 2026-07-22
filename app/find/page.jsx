import { getData } from "../../lib/data";
import MapView from "../../components/MapView";

export const metadata = {
  title: "Find ethanol-free petrol near you",
  description:
    "Share your location or browse the map to find the closest ethanol-free (E0) petrol pumps.",
  alternates: { canonical: "/find/" },
};

export default async function FindPage() {
  const { pumps } = await getData();
  const light = pumps.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon, addr: p.addr, city: p.city }));
  return (
    <>
      <section className="page-head">
        <h1>Find ethanol-free petrol near you</h1>
        <p className="lede">
          Share your location to sort the closest pumps first, or just pan the map —
          no location needed to look around.
        </p>
      </section>
      <MapView pumps={light} locate />
    </>
  );
}
