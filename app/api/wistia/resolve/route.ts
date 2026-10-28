import { errorResponse, jiraSession } from "@/lib/jira/session";
import { allowedWistiaHost, idFromSharePage, idFromUrl, isShareLink, toResolved, type WistiaMedia } from "@/lib/wistia";
import { AdminError } from "@/lib/store/users";

const UA = "Mozilla/5.0 (compatible; BrandCreativeHub/1.0)";

async function getText(url: string, max = 1_000_000): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!allowedWistiaHost(new URL(res.url).hostname)) throw new AdminError(400, "That link doesn't lead to Wistia.");
  if (!res.ok) throw new AdminError(404, "Wistia didn't show that video. Check that it's shared.");
  return (await res.text()).slice(0, max);
}

/**
 * GET ?url=<a Wistia video or share link>  Finds the video's MP4 so the Hub can play it in its own player.
 * Answers { resolved: null } (not an error) when the video can't be played that way, so the page falls back to Wistia's player.
 */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    let u: URL;
    try { u = new URL(new URL(req.url).searchParams.get("url") ?? ""); } catch { throw new AdminError(400, "That doesn't look like a link."); }
    if (u.protocol !== "https:" || !allowedWistiaHost(u.hostname)) throw new AdminError(400, "That isn't a Wistia link.");
    let id = idFromUrl(u);
    if (!id && isShareLink(u)) id = idFromSharePage(await getText(u.toString()));
    if (!id) throw new AdminError(400, "Paste a link to one Wistia video (…/medias/… or a share link).");
    let media: WistiaMedia | null = null;
    try { media = (JSON.parse(await getText(`https://fast.wistia.net/embed/medias/${id}.json`, 2_000_000)) as { media?: WistiaMedia }).media ?? null; } catch (e) { if (e instanceof AdminError && e.status === 400) throw e; }
    return Response.json({ id, resolved: media ? toResolved(media) : null, name: media?.name ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
