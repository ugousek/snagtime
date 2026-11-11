import type { Metadata } from "next";
import { AccountSignup } from "@/components/account-signup";

export const metadata: Metadata = { title: "Vytvořit provozovnu" };
export default function SignupPage() { return <AccountSignup />; }
