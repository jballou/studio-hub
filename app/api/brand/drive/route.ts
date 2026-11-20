import { driveList } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { jiraSession } from "@/lib/jira/session";
import { brandTrail, getBrandConfig, inBrandTree, markInTree, type BrandKind } from "@/lib/store/brand";
import { AdminError } from "@/lib/store/users";

const ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

/** GET /api/brand/drive?kind=photos|illustrations&folder=<id>  One folder of the brand library, for signed-in staff. */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    const u = new URL(req.url);
    const kind = u.searchParams.get("kind");
    if (kind !== "photos" && kind !== "illustrations") throw new AdminError(400, "Unknown library.");
    const cfg = await getBrandConfig();
    const root = cfg[kind as BrandKind];
    if (!root || !cfg.owner) return Response.json({ configured: false });
    const folder = u.searchParams.get("folder") || root;
    if (!ID_RE.test(folder) || !(await inBrandTree(cfg, kind, folder))) throw new AdminError(404, "Not found.");
    const [items, trail] = await Promise.all([driveList(cfg.owner, folder), brandTrail(cfg, kind, folder)]);
    markInTree(kind, items.map((i) => i.id));
    const keep = items.filter((i) => i.folder || i.mimeType.startsWith("image/") || i.mimeType === "application/pdf");
    return Response.json({ configured: true, folder, trail, items: keep }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (e) {
    return apiError(e);
  }
}
