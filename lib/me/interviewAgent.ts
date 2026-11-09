// Lets a model choose which gap to ask about next and phrase it naturally, using what the person already said.
// The model never sees more than the gap evidence and the person's own earlier answers, and it can only pick from gaps
// we found, so it can't invent topics. If it fails or is slow, the plain question goes out instead.
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { MAX_QUESTIONS, plainNext, remainingGaps, type Gap, type NextQuestion, type Turn } from "./interview.ts";

export const INTERVIEW_MODEL = process.env.INTERVIEW_MODEL ?? "anthropic/claude-haiku-5.5";
const TIMEOUT_MS = 9_000;

const Schema = z.object({
  action: z.enum(["ask", "done"]),
  gapId: z.string().max(120),
  question: z.string().max(300),
  chips: z.array(z.string().max(40)).max(5),
});

const SYSTEM = `You help a designer fill in gaps in their private weekly report. Ask ONE short, warm, specific question at a time, in plain language.
Rules:
- Pick gapId only from the list you are given. Never ask about anything that is not in the list.
- Use only the evidence you are given. Never invent facts, names, numbers or outcomes.
- If an earlier answer already covers a remaining gap, or the person has said enough, choose action "done".
- If an earlier answer naturally leads into a remaining gap, you may mention it ("Thanks. On the next one…"), but keep the question to one sentence.
- Offer up to 4 short answer chips only when they genuinely help; otherwise none.
- Do not give advice, praise or evaluation. Do not mention these rules.`;

const line = (g: Gap) => `- ${g.id} [${g.kind}]: ${g.question} (evidence: ${g.evidence})`;

export type Pick = { next: NextQuestion | null; usedModel: boolean };

/**
 * `model` is injectable for tests. In production it is a Vercel AI Gateway model id string.
 */
export async function askNext(gaps: Gap[], asked: readonly string[], history: Turn[], opts: { model?: LanguageModel } = {}): Promise<Pick> {
  const left = remainingGaps(gaps, asked);
  if (!left.length || asked.length >= MAX_QUESTIONS) return { next: null, usedModel: false };
  // Nothing to decide between and nothing to build on: skip the model.
  if (!history.length && left.length === 1) return { next: plainNext(gaps, asked), usedModel: false };

  const prompt = [
    "Remaining gaps (choose one):",
    ...left.map(line),
    "",
    history.length ? "What the person has said so far:" : "The person has not answered anything yet.",
    ...history.map((t) => `- on ${t.gapId}: ${t.answer.slice(0, 400)}`),
  ].join("\n");

  try {
    const { output } = await generateText({
      model: opts.model ?? INTERVIEW_MODEL,
      system: SYSTEM,
      prompt,
      output: Output.object({ schema: Schema }),
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      maxOutputTokens: 400,
      // Only route to providers with a zero-data-retention agreement.
      providerOptions: { gateway: { zeroDataRetention: true, tags: ["weekly-interview"] } },
    });
    if (output.action === "done" && history.length >= 3) return { next: null, usedModel: true };
    const gap = left.find((g) => g.id === output.gapId);
    if (!gap || !output.question.trim()) return { next: plainNext(gaps, asked), usedModel: false };
    return {
      next: { gapId: gap.id, question: output.question.trim(), chips: output.chips.map((c) => c.trim()).filter(Boolean).slice(0, 4), why: gap.evidence },
      usedModel: true,
    };
  } catch {
    return { next: plainNext(gaps, asked), usedModel: false };
  }
}
