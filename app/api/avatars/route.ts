import sharp from "sharp";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { avatarIndex, removeAvatar, setAvatar } from "@/lib/store/avatars";
import { AdminError, audit } from "@/lib/store/users";

const MAX_BYTES = 4 * 1024 * 1024;

/** GET: who has a profile picture (accountId → version). One small read; the browser keeps it for the page's life. */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    return Response.json({ avatars: await avatarIndex() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST: the raw image bytes of your new picture. Cropped to a centered square and saved as a 256 px WebP, with metadata dropped. */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    const input = Buffer.from(await req.arrayBuffer());
    if (!input.length) throw new AdminError(400, "Choose a picture first.");
    if (input.length > MAX_BYTES) throw new AdminError(413, "That picture is over 4 MB. Choose a smaller one.");
    let webp: Buffer;
    try {
      webp = await sharp(input, { limitInputPixels: 50_000_000 }).rotate().resize(256, 256, { fit: "cover", position: "attention" }).webp({ quality: 85 }).toBuffer();
    } catch {
      throw new AdminError(400, "That file isn't a picture we can read. Use a JPG, PNG or WebP.");
    }
    const version = await setAvatar(s.accountId, webp);
    await audit({ actor: s.email, action: "profile.avatar.set", target: s.email }).catch(() => {});
    return Response.json({ version });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE: back to initials. */
export async function DELETE(req: Request) {
  try {
    const s = await jiraSession(req);
    await removeAvatar(s.accountId);
    await audit({ actor: s.email, action: "profile.avatar.remove", target: s.email }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
