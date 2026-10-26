import { toCsvExportUrl } from "@/lib/calendar/gsheet";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Fetches a Google Sheet as CSV on the server (browsers hit CORS on Google's export URL).
 * Only docs.google.com sheet links are accepted, so this can't be pointed at other hosts.
 * Works for sheets shared as "anyone with the link"; private sheets need Google sign-in (not built yet).
 */
export async function GET(req: Request) {
  const target = toCsvExportUrl(new URL(req.url).searchParams.get("url") ?? "");
  if (!target) return Response.json({ error: "That isn't a Google Sheets link." }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(target, { redirect: "follow", headers: { Accept: "text/csv" }, cache: "no-store" });
  } catch {
    return Response.json({ error: "Couldn't reach Google Sheets." }, { status: 502 });
  }
  const finalHost = new URL(res.url).hostname;
  if (!/(^|\.)(google\.com|googleusercontent\.com)$/.test(finalHost)) {
    return Response.json({ error: "Unexpected redirect." }, { status: 502 });
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || /text\/html/.test(type)) {
    return Response.json(
      { error: "The sheet isn't readable. Set sharing to “Anyone with the link can view”, or paste the CSV instead." },
      { status: 403 },
    );
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return Response.json({ error: "That sheet is too large (5 MB limit)." }, { status: 413 });
  return new Response(buf, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" } });
}
