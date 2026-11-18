import { requireWorkspaceAccess } from "@/server/auth/session";
import { apiError, ok } from "@/server/http";
import { listBookings } from "@/server/services/bookings";
import { withDatabaseScope } from "@/server/db-context";

async function GETHandler(request: Request) {
  try { const access = await requireWorkspaceAccess(request); return ok(await listBookings(access.workspaceId)); } catch (error) { return apiError(error); }
}

export const GET = withDatabaseScope(GETHandler);
