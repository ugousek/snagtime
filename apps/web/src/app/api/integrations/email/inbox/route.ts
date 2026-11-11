import { apiError, ok } from "@/server/http";
import { requireWorkspaceAccess, requireWorkspaceMutationAccess } from "@/server/auth/session";
import { listLocalInbox, processEmailOutbox } from "@/server/services/notifications";
import { withDatabaseScope } from "@/server/db-context";
async function GETHandler(request: Request) { try { const access = await requireWorkspaceAccess(request, "ADMIN"); return ok(await listLocalInbox(access.workspaceId)); } catch (error) { return apiError(error); } }
async function POSTHandler(request: Request) { try { const access = await requireWorkspaceMutationAccess(request, "ADMIN"); return ok(await processEmailOutbox(access.workspaceId)); } catch (error) { return apiError(error); } }

export const GET = withDatabaseScope(GETHandler);
export const POST = withDatabaseScope(POSTHandler);
