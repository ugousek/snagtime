import { PublicBookingFlow } from "@/components/public-booking-flow";
export const metadata = { title: "Rezervace termínu" };
export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PublicBookingFlow slug={slug} />; }
