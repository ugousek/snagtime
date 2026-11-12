import { requireWorkspaceAccess } from "@/server/auth/session";
import { apiError, ok } from "@/server/http";
import { assertPlatformAdmin } from "@/server/platform";
import { listPlatformWorkspaces } from "@/server/services/platform-admin";
import { withDatabaseScope } from "@/server/db-context";

async function GETHandler(request: Request) {
  try { const access = await requireWorkspaceAccess(request); assertPlatformAdmin(access); return ok(await listPlatformWorkspaces()); } catch (error) { return apiError(error); }
}

export const GET = withDatabaseScope(GETHandler);
