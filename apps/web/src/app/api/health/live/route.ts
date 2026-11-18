import { NextResponse } from "next/server";
import { withDatabaseScope } from "@/server/db-context";
export const dynamic = "force-dynamic";
async function GETHandler() { return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } }); }

export const GET = withDatabaseScope(GETHandler);
