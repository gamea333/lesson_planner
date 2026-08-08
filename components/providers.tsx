"use client";

import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "rounded-xl shadow-soft border border-slate-200",
          },
        }}
      />
    </>
  );
}
