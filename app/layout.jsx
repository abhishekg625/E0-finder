import "./globals.css";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";

const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

const SITE_URL = process.env.SITE_URL || "https://example.pages.dev";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "E0 Finder — find ethanol-free (E0) petrol near you",
    template: "%s · E0 Finder",
  },
  description:
    "Find ethanol-free (E0) premium petrol near you in India. Open data from OpenStreetMap. Unofficial — always confirm at the pump.",
  openGraph: {
    type: "website",
    siteName: "E0 Finder",
    locale: "en_IN",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site-head">
          <Link className="wordmark" href="/">E0<span>·</span>Finder</Link>
          <nav>
            <Link href="/find/">Find</Link>
            <Link href="/cities/">Cities</Link>
            <Link href="/about/">About</Link>
            <ThemeToggle />
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer className="site-foot">
          <p>
            Unofficial, community data from OpenStreetMap.{" "}
            <strong>Always confirm ethanol-free stock at the pump before filling.</strong>
          </p>
          <p><Link href="/about/">About &amp; disclaimer</Link></p>
        </footer>
      </body>
    </html>
  );
}
