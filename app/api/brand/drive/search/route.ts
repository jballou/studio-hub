import { libraryIndex } from "@/lib/brand/libraryIndex";
import { apiError } from "@/lib/google/http";
import { jiraSession } from "@/lib/jira/session";
import { allTags } from "@/lib/store/tags";
import { AdminError } from "@/lib/store/users";

/** GET /api/brand/drive/search?kind=photos|illustrations&q=...  Matches file names and tags across every folder. */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    const u = new URL(req.url);
    const kind = u.searchParams.get("kind");
    if (kind !== "photos" && kind !== "illustrations") throw new AdminError(400, "Unknown library.");
    const words = (u.searchParams.get("q") ?? "").toLowerCase().split(/[\s,]+/).filter(Boolean).slice(0, 8);
    if (!words.length) return Response.json({ items: [] });
    const [index, tags] = await Promise.all([libraryIndex(kind), allTags(kind)]);
    const scored: [typeof index[number], number][] = [];
    for (const p of index) {
      const name = p.name.toLowerCase().replace(/\.[a-z0-9]+$/, "");
      const t = tags[p.id]?.t ?? [];
      let score = 0;
      let all = true;
      for (const w of words) {
        // A tag that is the word counts most, then a tag containing it, then the file name.
        const s = t.includes(w) ? 3 : t.some((x) => x.includes(w)) ? 2 : name.includes(w) ? 1 : 0;
        if (!s) { all = false; break; }
        score += s;
      }
      if (all) scored.push([p, score]);
    }
    scored.sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name));
    return Response.json({ items: scored.slice(0, 200).map(([p]) => ({ ...p, folder: false })), total: scored.length }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (e) {
    return apiError(e);
  }
}
