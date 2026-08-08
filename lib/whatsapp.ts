import { saveAs } from "file-saver";

const STORAGE_KEY = "lessonPlanner.whatsappNumber";

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function formatWhatsAppDisplay(digits: string): string {
  const d = normalizePhoneDigits(digits);
  if (!d) return "";
  if (d.length === 12 && d.startsWith("91")) {
    return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `+${d.slice(0, 5)} ${d.slice(5)}`;
  }
  return `+${d}`;
}

/** Saved number from Settings (browser localStorage). Empty if not set. */
export function getSavedWhatsAppNumber(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizePhoneDigits(localStorage.getItem(STORAGE_KEY) ?? "");
  } catch {
    return "";
  }
}

/**
 * Active WhatsApp recipient: your saved number, or optional env override.
 * No hardcoded fallback — returns "" until you enter a number in Settings.
 */
export function getWhatsAppNumber(): string {
  const saved = getSavedWhatsAppNumber();
  if (saved) return saved;

  const fromEnv = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim();
  if (fromEnv) return normalizePhoneDigits(fromEnv);

  return "";
}

export function hasWhatsAppNumber(): boolean {
  return getWhatsAppNumber().length >= 8;
}

export function getWhatsAppDisplayNumber(): string {
  return formatWhatsAppDisplay(getWhatsAppNumber());
}

export function saveWhatsAppNumber(raw: string): string {
  const digits = normalizePhoneDigits(raw);
  if (typeof window !== "undefined") {
    if (digits) localStorage.setItem(STORAGE_KEY, digits);
    else localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("lessonplanner:whatsapp-updated"));
  }
  return digits;
}

export function clearWhatsAppNumber(): void {
  saveWhatsAppNumber("");
}

/** Ask the UI to open WhatsApp Settings (navbar dialog). */
export function requestWhatsAppSettings(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lessonplanner:open-whatsapp-settings"));
  }
}

export function buildWhatsAppChatUrl(message: string, phone?: string): string {
  const digits = phone
    ? normalizePhoneDigits(phone)
    : getWhatsAppNumber();
  if (!digits) {
    throw new Error(
      "No WhatsApp number saved. Open Settings and enter your number."
    );
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Open WhatsApp chat to your saved number (or an explicit override). */
export function openWhatsAppMessage(message: string, phone?: string): void {
  const target = phone ? normalizePhoneDigits(phone) : getWhatsAppNumber();
  if (!target) {
    requestWhatsAppSettings();
    throw new Error(
      "No WhatsApp number saved. Enter your number in Settings first."
    );
  }
  window.open(
    buildWhatsAppChatUrl(message, target),
    "_blank",
    "noopener,noreferrer"
  );
}

export type WhatsAppShareResult =
  | { method: "native-share" }
  | { method: "download-and-chat" }
  | { method: "cancelled" }
  | { method: "missing-number" };

/**
 * Share a PDF to WhatsApp.
 * Uses your saved number for the chat link when native file share is unavailable.
 */
export async function sendPdfToWhatsApp(options: {
  blob: Blob;
  fileName: string;
  caption: string;
}): Promise<WhatsAppShareResult> {
  const { blob, fileName, caption } = options;
  const file = new File([blob], fileName, { type: "application/pdf" });

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: fileName,
        text: caption,
      });
      return { method: "native-share" };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { method: "cancelled" };
      }
    }
  }

  if (!hasWhatsAppNumber()) {
    requestWhatsAppSettings();
    return { method: "missing-number" };
  }

  saveAs(blob, fileName);
  const chatUrl = buildWhatsAppChatUrl(
    `${caption}\n\n(PDF "${fileName}" was downloaded — please attach it to this chat.)`
  );
  window.open(chatUrl, "_blank", "noopener,noreferrer");
  return { method: "download-and-chat" };
}
