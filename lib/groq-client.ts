import Groq from "groq-sdk";

import {
  estimateTokenCount,
  isRateLimitError,
  parseRetryAfterMs,
  sleep,
} from "@/lib/groq-utils";

const MODEL = "llama-3.3-70b-versatile";
const TEMPERATURE = 0.2;
const MAX_TOKENS = 4096;
const MAX_RETRIES = 3;

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured. Add it to your .env.local file."
    );
  }
  return new Groq({ apiKey });
}

export function logFullGroqPayload(
  label: string,
  systemPrompt: string,
  userPrompt: string
): void {
  const sysTokens = estimateTokenCount(systemPrompt);
  const userTokens = estimateTokenCount(userPrompt);
  console.log(`\n========== [Groq PAYLOAD DEBUG] ${label} ==========`);
  console.log(
    `[Groq] Token estimate — system: ${sysTokens}, user: ${userTokens}, total: ${sysTokens + userTokens}`
  );
  console.log(`----- SYSTEM PROMPT (${systemPrompt.length} chars) -----`);
  console.log(systemPrompt);
  console.log(`----- USER PROMPT (${userPrompt.length} chars) -----`);
  console.log(userPrompt);
  console.log(`========== [END Groq PAYLOAD] ${label} ==========\n`);
}

export async function callGroqJson<T>(
  systemPrompt: string,
  userPrompt: string,
  label: string,
  options?: { logPayload?: boolean }
): Promise<T> {
  const groq = getGroqClient();

  // Do NOT re-truncate here — callers are responsible for priority packing.
  if (options?.logPayload !== false) {
    logFullGroqPayload(label, systemPrompt, userPrompt);
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("No response from AI model");

      try {
        return JSON.parse(raw) as T;
      } catch {
        throw new Error("AI returned invalid JSON. Please try again.");
      }
    } catch (error) {
      if (isRateLimitError(error) && attempt < MAX_RETRIES) {
        const waitMs = parseRetryAfterMs(error);
        console.log(
          `[Groq] Rate limited on "${label}", retry ${attempt + 1}/${MAX_RETRIES} after ${waitMs}ms`
        );
        await sleep(waitMs);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Groq request failed for "${label}" after ${MAX_RETRIES} retries`);
}
