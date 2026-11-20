import localFont from "next/font/local";

/** Geist (SIL Open Font License, see fonts/OFL.txt). Served from our own origin, no third-party requests. */
export const landingSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-landing",
  weight: "100 900",
  display: "swap",
});
export const landingMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-landing-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
});
