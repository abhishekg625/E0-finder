import MapView from "../../components/MapView";

export const metadata = {
  title: "Find petrol pumps near you",
  description:
    "Search or browse petrol pumps across India, filter by brand, and see which are confirmed ethanol-free (E0).",
  alternates: { canonical: "/find/" },
};

export default function FindPage() {
  return (
    <>
      <section className="page-head">
        <h1>Find a pump near you</h1>
        <p className="lede">
          Share your location to sort the closest pumps first, filter by brand, or
          search by name — no location needed to look around. Pumps confirmed
          ethanol-free are marked <strong>E0 confirmed</strong>; everything else is
          unverified, not ruled out.
        </p>
      </section>
      <MapView dataUrl="/data/pumps.json" locate filters />
    </>
  );
}
