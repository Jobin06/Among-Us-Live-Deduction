import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { getServerAuthSession } from "@/lib/auth";
import { FinalsService } from "@/services/finals.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    const url = new URL(req.url);
    const previewRequested = url.searchParams.get("preview") === "true";

    // Only ADMIN role can view unpublished preview
    const isPreview = previewRequested && session?.user?.role === UserRole.ADMIN;

    const data = await FinalsService.getFinalResults(isPreview);
    return jsonSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
