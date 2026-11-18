import { apiError, jsonBody, ok } from "@/server/http";
import { requireWorkspaceMutationAccess } from "@/server/auth/session";
import { enforceRateLimit } from "@/server/rate-limit";
import { tokenInput } from "@/server/validation";
import { acceptWorkspaceInvitation } from "@/server/services/accounts";
import { withDatabaseScope } from "@/server/db-context";
async function POSTHandler(request: Request) { try { const access = await requireWorkspaceMutationAccess(request); await enforceRateLimit(`invitation-accept:user:${access.user.id}`, 20, 60 * 60_000); return ok(await acceptWorkspaceInvitation(access, tokenInput.parse(await jsonBody(request)).token)); } catch (error) { return apiError(error); } }

export const POST = withDatabaseScope(POSTHandler);
