import { purge } from "@/lib/store/review";

/** Daily job (see vercel.json): removes designs that have been in Trash for 30 days. Needs CRON_SECRET; Vercel sends it as a bearer token. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed." }, { status: 401 });
  const removed = await purge({ expiredOnly: true });
  return Response.json({ removed });
}
