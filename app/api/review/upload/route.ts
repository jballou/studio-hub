import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { errorResponse, jiraSession } from "@/lib/jira/session";

const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const PATH_RE = /^review-files\/[A-Za-z0-9-]{8,64}\/[A-Za-z0-9._ ()+-]{1,160}$/;

/** Hands the browser a short-lived token to upload one file straight to our private store (big videos can't pass through a function). */
export async function POST(req: Request) {
  try {
    await jiraSession(req);
    const body = (await req.json()) as HandleUploadBody;
    const out = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!PATH_RE.test(pathname) || pathname.includes("..")) throw new Error("That file name isn't allowed.");
        return {
          allowedContentTypes: ["image/*", "video/*", "audio/*", "application/pdf"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return Response.json(out);
  } catch (e) {
    if (e instanceof Error && !(e as { status?: number }).status && /allowed|Not signed|access/i.test(e.message)) return Response.json({ error: e.message }, { status: 400 });
    return errorResponse(e);
  }
}
