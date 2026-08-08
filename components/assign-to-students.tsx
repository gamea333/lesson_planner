"use client";

import { UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MOCK_STUDENTS } from "@/lib/mock-students";
import { assignMaterialToStudents } from "@/lib/student-store";
import type { AssignmentKind } from "@/lib/types/students";
import { ASSIGNMENT_KIND_LABELS } from "@/lib/types/students";
import { cn } from "@/lib/utils";

interface AssignToStudentsProps {
  kind: AssignmentKind;
  title: string;
  chapter: string;
  grade: string;
  subject: string;
  snapshot: unknown;
  disabled?: boolean;
  className?: string;
}

export function AssignToStudents({
  kind,
  title,
  chapter,
  grade,
  subject,
  snapshot,
  disabled,
  className,
}: AssignToStudentsProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return MOCK_STUDENTS;
    return MOCK_STUDENTS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.rollNo).includes(q)
    );
  }, [filter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(filtered.map((s) => s.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleAssign() {
    if (selected.size === 0) {
      toast.error("Select at least one student");
      return;
    }
    const created = assignMaterialToStudents({
      studentIds: Array.from(selected),
      kind,
      title,
      chapter,
      grade,
      subject,
      snapshot,
    });
    toast.success(
      `Assigned ${ASSIGNMENT_KIND_LABELS[kind]} to ${created.length} student${created.length === 1 ? "" : "s"}`
    );
    setOpen(false);
    setSelected(new Set());
    setFilter("");
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn("w-full sm:w-auto", className)}
        onClick={() => setOpen(true)}
      >
        <UserPlus />
        Assign to students
      </Button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-students-title"
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-background shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
              <div>
                <h2
                  id="assign-students-title"
                  className="text-base font-semibold"
                >
                  Assign {ASSIGNMENT_KIND_LABELS[kind]}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {title} · {chapter}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 border-b px-4 py-3 sm:px-5">
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search by name or roll no."
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium hover:bg-slate-200"
                >
                  Select all shown
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium hover:bg-slate-200"
                >
                  Clear
                </button>
                <span className="ml-auto self-center text-muted-foreground">
                  {selected.size} selected
                </span>
              </div>
            </div>

            <ul className="flex-1 overflow-y-auto px-2 py-2">
              {filtered.map((s) => {
                const checked = selected.has(s.id);
                return (
                  <li key={s.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-slate-50",
                        checked && "bg-primary/5"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">
                        #{s.rollNo}
                      </span>
                      <span className="font-medium">{s.name}</span>
                      <Link
                        href={`/students/${s.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto text-xs text-primary hover:underline"
                      >
                        Profile
                      </Link>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="flex gap-2 border-t px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleAssign}
                disabled={selected.size === 0}
              >
                Assign ({selected.size})
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
