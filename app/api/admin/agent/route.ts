import { runAgent, type AgentMessage } from "@/lib/agent/run";
import { errorResponse, adminSession } from "@/lib/jira/session";

/** POST { messages: [{role, content}] }  Admin-only test bench for the Brand Creative bot: same brain Slack will use, no Slack needed. */
export async function POST(req: Request) {
  try {
    await adminSession(req);
    const b = await req.json().catch(() => ({}));
    const messages: AgentMessage[] = (Array.isArray(b.messages) ? b.messages : []).slice(-12)
      .filter((m: { role?: string; content?: unknown }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") return Response.json({ error: "Say something first." }, { status: 400 });
    try {
      return Response.json(await runAgent(messages, { base: new URL(req.url).origin }));
    } catch (e) {
      console.error("[agent] run failed", e instanceof Error ? e.message : e);
      return Response.json({ error: "The bot couldn't answer. The AI model may not be reachable from here (no AI Gateway access), or it timed out." }, { status: 502 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
