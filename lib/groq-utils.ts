/** ~4 chars per token — conservative budget for Groq prompts */
const CHARS_PER_TOKEN = 4;

export const MAX_PROMPT_TOKENS = 5000;

export function truncateToTokenBudget(
  text: string,
  maxTokens = MAX_PROMPT_TOKENS
): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[...truncated to ${maxTokens} token budget]`;
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const err = error as {
    status?: number;
    statusCode?: number;
    message?: string;
    error?: { message?: string; type?: string };
  };

  const status = err.status ?? err.statusCode;
  if (status === 429) return true;

  const message = `${err.message ?? ""} ${err.error?.message ?? ""} ${err.error?.type ?? ""}`.toLowerCase();
  return (
    message.includes("rate_limit") ||
    message.includes("rate limit") ||
    message.includes("tokens per minute") ||
    message.includes("429")
  );
}

export function parseRetryAfterMs(error: unknown, defaultMs = 2000): number {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  const secondsMatch = message.match(
    /try again in (\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?/i
  );
  if (secondsMatch) {
    return Math.ceil(parseFloat(secondsMatch[1]) * 1000);
  }

  const msMatch = message.match(/retry.?after[:\s]+(\d+)/i);
  if (msMatch) {
    const value = parseInt(msMatch[1], 10);
    return value > 1000 ? value : value * 1000;
  }

  return defaultMs;
}
