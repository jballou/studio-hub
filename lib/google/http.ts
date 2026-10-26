import { errorResponse } from "@/lib/jira/session";
import { GoogleError } from "./client";

/** Like errorResponse, plus a `code` the UI uses to offer "Connect Google" or "Reconnect". */
export function apiError(e: unknown): Response {
  if (e instanceof GoogleError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
  return errorResponse(e);
}
