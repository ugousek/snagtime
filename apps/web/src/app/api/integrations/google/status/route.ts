import { requireWorkspaceAccess, requireWorkspaceMutationAccess } from "@/server/auth/session";
import { apiError, ok } from "@/server/http";
import { disconnectGoogleCalendar, googleCalendarStatus } from "@/server/services/calendar";
import { withDatabaseScope } from "@/server/db-context";

async function GETHandler(request: Request) {
  try { const access = await requireWorkspaceAccess(request); return ok(await googleCalendarStatus(access.user.id, access.workspaceId)); } catch (error) { return apiError(error); }
}
async function DELETEHandler(request: Request) {
  try { const access = await requireWorkspaceMutationAccess(request, "ADMIN"); return ok(await disconnectGoogleCalendar(access.user.id, undefined, new Date(), access.workspaceId)); } catch (error) { return apiError(error); }
}

export const GET = withDatabaseScope(GETHandler);
export const DELETE = withDatabaseScope(DELETEHandler);
