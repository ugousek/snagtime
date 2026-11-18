import type { Metadata } from "next";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";

export const metadata: Metadata = { title: "Potvrdit provozovnu" };
export default function OnboardingPage() { return <WorkspaceOnboarding />; }
