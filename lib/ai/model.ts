import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Picks the model for one job. Order:
 *  1. An explicit override such as `TAG_MODEL=google/gemini-flash-latest` (a `google/` prefix calls Google directly).
 *  2. Google directly, when `GOOGLE_GENERATIVE_AI_API_KEY` is set. This skips the Vercel AI Gateway, so no card is needed.
 *  3. The AI Gateway string (`anthropic/...`), which needs `AI_GATEWAY_API_KEY` and a card on the Vercel account.
 */
export function pickModel(override: string | undefined, gatewayDefault: string): LanguageModel {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const spec = override?.trim();
  if (spec?.startsWith("google/")) return google(key)(spec.slice(7));
  if (spec) return spec;
  if (key) return google(key)(process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest");
  return gatewayDefault;
}

const google = (apiKey: string | undefined) => createGoogleGenerativeAI({ apiKey });
