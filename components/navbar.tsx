"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";

import { WhatsAppSettings } from "@/components/whatsapp-settings";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            LessonPlanner
          </span>
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-0.5 sm:gap-1">
          <Link
            href="/"
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground sm:px-3"
          >
            Create
          </Link>
          <Link
            href="/knowledge-base"
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground sm:px-3"
          >
            Knowledge Base
          </Link>
          <Link
            href="/practice-sheet"
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground sm:px-3"
          >
            Practice Sheet
          </Link>
          <Link
            href="/homework"
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground sm:px-3"
          >
            Homework
          </Link>
          <Link
            href="/attendance"
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground sm:px-3"
          >
            Attendance
          </Link>
          <Link
            href="/generate"
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground sm:px-3"
          >
            Lesson Plan
          </Link>
          <WhatsAppSettings />
        </nav>
      </div>
    </header>
  );
}
