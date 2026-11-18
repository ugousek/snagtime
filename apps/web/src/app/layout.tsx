import type { Metadata } from "next";
import { AccessibilityFocusManager } from "@/components/accessibility-focus";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Rezervace", template: "%s · Rezervace" },
  description: "Rezervujte si termín online.",
  applicationName: "Rezervace",
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
  openGraph: { title: "Rezervace", description: "Rezervujte si termín online.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="cs" data-scroll-behavior="smooth"><body><AccessibilityFocusManager />{children}</body></html>;
}
