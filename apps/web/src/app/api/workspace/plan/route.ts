import { requireWorkspaceAccess } from "@/server/auth/session";
import { apiError, ok } from "@/server/http";
import { isPlatformAdmin } from "@/server/platform";
import { getWorkspacePlanSummary } from "@/server/services/plans";
import { withDatabaseScope } from "@/server/db-context";

async function GETHandler(request: Request) {
  try { const access = await requireWorkspaceAccess(request); return ok({ ...await getWorkspacePlanSummary(access.workspaceId), platformAdmin: isPlatformAdmin(access.user) }); } catch (error) { return apiError(error); }
}

export const GET = withDatabaseScope(GETHandler);
