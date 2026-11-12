import { z } from "zod";
import { requireWorkspaceMutationAccess } from "@/server/auth/session";
import { apiError, jsonBody, ok } from "@/server/http";
import { assertPlatformAdmin } from "@/server/platform";
import { setWorkspacePlan } from "@/server/services/platform-admin";
import { withDatabaseScope } from "@/server/db-context";

const planInput = z.object({ plan: z.enum(["FREE", "START", "PROFI"]), validUntil: z.string().datetime().nullable(), note: z.string().max(500).nullable().optional() });

async function PUTHandler(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireWorkspaceMutationAccess(request, "MEMBER"); assertPlatformAdmin(access);
    const { id } = await context.params; return ok(await setWorkspacePlan(id, planInput.parse(await jsonBody(request, 4_000))));
  } catch (error) { return apiError(error); }
}

export const PUT = withDatabaseScope(PUTHandler);
