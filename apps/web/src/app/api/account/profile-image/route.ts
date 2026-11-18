import { requireWorkspaceMutationAccess } from "@/server/auth/session";
import { apiError, jsonBody, ok } from "@/server/http";
import { IMAGE_JSON_BODY_MAX_BYTES } from "@/server/image-ingestion";
import { profileImageInput } from "@/server/validation";
import { updateProfileImage } from "@/server/services/accounts";
import { withDatabaseScope } from "@/server/db-context";

async function PATCHHandler(request: Request) {
  try {
    const access = await requireWorkspaceMutationAccess(request);
    const input = profileImageInput.parse(await jsonBody(request, IMAGE_JSON_BODY_MAX_BYTES));
    return ok(await updateProfileImage(access, input.imageUrl));
  } catch (error) { return apiError(error); }
}

export const PATCH = withDatabaseScope(PATCHHandler);
