import { requireWorkspaceAccess } from "@/server/auth/session";
import { apiError, ok } from "@/server/http";
import { getAccountSummary } from "@/server/services/accounts";
import { withDatabaseScope } from "@/server/db-context";

async function GETHandler(request: Request) {
  try { return ok(await getAccountSummary(await requireWorkspaceAccess(request))); } catch (error) { return apiError(error); }
}

export const GET = withDatabaseScope(GETHandler);
