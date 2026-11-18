import { requireWorkspaceMutationAccess } from "@/server/auth/session";
import { apiError, jsonBody, ok } from "@/server/http";
import { completeWorkspaceOnboarding, getAccountSummary } from "@/server/services/accounts";
import { workspaceUpdateInput } from "@/server/validation";
import { withDatabaseScope } from "@/server/db-context";

async function PATCHHandler(request: Request) {
  try { const access = await requireWorkspaceMutationAccess(request, "ADMIN"); workspaceUpdateInput.parse(await jsonBody(request)); await completeWorkspaceOnboarding(access); return ok(await getAccountSummary({ ...access, workspace: { ...access.workspace, onboardingCompletedAt: new Date() } })); } catch (error) { return apiError(error); }
}

export const PATCH = withDatabaseScope(PATCHHandler);
