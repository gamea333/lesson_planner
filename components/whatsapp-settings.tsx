"use client";

import { MessageCircle, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  clearWhatsAppNumber,
  formatWhatsAppDisplay,
  getSavedWhatsAppNumber,
  saveWhatsAppNumber,
} from "@/lib/whatsapp";

export function WhatsAppSettings() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");

  function refresh() {
    const current = getSavedWhatsAppNumber();
    setSaved(current);
    setDraft(current);
  }

  useEffect(() => {
    refresh();
    const onOpen = () => {
      refresh();
      setOpen(true);
    };
    const onUpdated = () => refresh();
    window.addEventListener("lessonplanner:open-whatsapp-settings", onOpen);
    window.addEventListener("lessonplanner:whatsapp-updated", onUpdated);
    return () => {
      window.removeEventListener(
        "lessonplanner:open-whatsapp-settings",
        onOpen
      );
      window.removeEventListener("lessonplanner:whatsapp-updated", onUpdated);
    };
  }, []);

  function handleSave() {
    const digits = saveWhatsAppNumber(draft);
    if (!digits || digits.length < 8) {
      toast.error("Enter a valid WhatsApp number with country code", {
        description: "Example: 919876543210",
      });
      return;
    }
    setSaved(digits);
    setDraft(digits);
    setOpen(false);
    toast.success("WhatsApp number saved", {
      description: `All shares will go to ${formatWhatsAppDisplay(digits)}`,
    });
  }

  function handleClear() {
    clearWhatsAppNumber();
    setSaved("");
    setDraft("");
    toast.message("WhatsApp number cleared");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          refresh();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
        title="WhatsApp settings"
      >
        <Settings2 className="h-4 w-4" />
        <span className="hidden lg:inline">WhatsApp</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wa-settings-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-xl"
          >
            <div className="border-b px-5 py-4">
              <h2
                id="wa-settings-title"
                className="flex items-center gap-2 text-base font-semibold"
              >
                <MessageCircle className="h-4 w-4 text-primary" />
                Your WhatsApp number
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your number once. Lesson plans, practice sheets, homework
                PDFs, and student feedback will all open WhatsApp to this
                number.
              </p>
            </div>

            <div className="space-y-3 px-5 py-4">
              <label className="block text-sm font-medium" htmlFor="wa-number">
                Number (with country code)
              </label>
              <input
                id="wa-number"
                type="tel"
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. 919876543210"
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Digits only or with + / spaces. Saved in this browser only — not
                uploaded to GitHub.
              </p>
              {saved ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  Currently sharing to {formatWhatsAppDisplay(saved)}
                </p>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  No number saved yet — WhatsApp share is disabled until you
                  save one.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t px-5 py-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              {saved && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                >
                  Clear
                </Button>
              )}
              <Button type="button" className="flex-1" onClick={handleSave}>
                Save number
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
