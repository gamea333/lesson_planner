/** Parse JSON from a fetch Response without throwing on empty bodies. */
export async function readResponseJson<T = unknown>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Server returned an empty response."
        : `Request failed (${res.status} ${res.statusText || "Error"})`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Invalid server response (${res.status}): ${text.slice(0, 180)}`
    );
  }
}
