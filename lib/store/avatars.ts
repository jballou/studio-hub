// Profile pictures. One small WebP per person (256 px square, about 10 to 25 KB), kept as its own document so the
// shared index stays tiny: the browser reads the index once and only asks for pictures that exist.
import { createHash } from "node:crypto";
import { deleteDoc, readDoc, updateDoc } from "./doc";

type Index = { v: Record<string, number> };
type Pic = { b64: string };

const emptyIndex = (): Index => ({ v: {} });
const picName = (id: string) => `avatar-${createHash("sha1").update(id).digest("hex")}`;

/** accountId → version (a timestamp, used to refresh the browser's copy when someone changes theirs). */
export async function avatarIndex(): Promise<Record<string, number>> {
  return (await readDoc("avatars", emptyIndex)).data.v;
}

export async function getAvatar(id: string): Promise<Buffer | null> {
  if (!(id in (await avatarIndex()))) return null;
  const { data } = await readDoc<Pic | null>(picName(id), () => null);
  return data?.b64 ? Buffer.from(data.b64, "base64") : null;
}

export async function setAvatar(id: string, webp: Buffer): Promise<number> {
  await updateDoc<Pic | null>(picName(id), () => null, () => ({ data: { b64: webp.toString("base64") }, result: undefined }));
  const v = Date.now();
  await updateDoc("avatars", emptyIndex, (d) => ({ data: { v: { ...d.v, [id]: v } }, result: undefined }));
  return v;
}

export async function removeAvatar(id: string): Promise<void> {
  await updateDoc("avatars", emptyIndex, (d) => {
    const v = { ...d.v };
    delete v[id];
    return { data: { v }, result: undefined };
  });
  await deleteDoc(picName(id)).catch(() => {});
}
