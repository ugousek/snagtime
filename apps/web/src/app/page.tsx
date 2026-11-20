import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { SESSION_COOKIE } from "@/server/auth/session";
import { PLAN_IDS, PLANS } from "@/server/services/plans";

const title = "Rezervace – online rezervační systém pro provozovny";
const description =
  "Online rezervace pro kadeřnictví, barbershopy, masáže i poradny. Klienti se objednají sami, den předem dostanou připomínku. Tarif Zdarma bez časového omezení.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  openGraph: { title, description, type: "website", locale: "cs_CZ" },
};

export default async function HomePage() {
  // Signed-in people go straight to the app, as before; everyone else sees the sales page.
  if ((await cookies()).has(SESSION_COOKIE)) redirect("/dashboard");

  const plans = PLAN_IDS.map((id) => ({ id, ...PLANS[id] }));
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Rezervace",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "cs",
    description,
    offers: plans.map((plan) => ({ "@type": "Offer", name: plan.name, price: plan.priceCzk, priceCurrency: "CZK" })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <LandingPage plans={plans} />
    </>
  );
}
