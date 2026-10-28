import { apiError } from "@/lib/google/http";
import { driveFile } from "@/lib/google/client";
import { jiraSession } from "@/lib/jira/session";
import { AdminError } from "@/lib/store/users";

const ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

/** GET ?id=<Drive file id>  What kind of file it is, so a video or audio file can play in the Hub's own player. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!ID_RE.test(id)) throw new AdminError(400, "That isn't a Drive file.");
    const f = await driveFile(s.email, id);
    const kind = f.mimeType.startsWith("video/") ? "video" : f.mimeType.startsWith("audio/") ? "audio" : "other";
    return Response.json({ ...f, kind });
  } catch (e) {
    return apiError(e);
  }
}
