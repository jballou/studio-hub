import { errorResponse, jiraSession } from "@/lib/jira/session";
import { CHUNK_BYTES, MAX_FILE_BYTES, startUpload } from "@/lib/store/files";

/** POST { name, type, size }  Opens an upload. The browser then sends the file in chunks. */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    const meta = await startUpload(s.accountId, await req.json().catch(() => ({})));
    return Response.json({ id: meta.id, name: meta.name, chunkBytes: CHUNK_BYTES, chunks: meta.chunks, maxBytes: MAX_FILE_BYTES }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
