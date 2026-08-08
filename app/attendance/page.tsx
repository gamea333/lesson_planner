"use client";

import { motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ClipboardList,
  Minus,
  User,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MOCK_STUDENTS } from "@/lib/mock-students";
import {
  countAttendance,
  getAttendanceForDate,
  setAllAttendance,
  setStudentAttendance,
  todayISO,
} from "@/lib/student-store";
import type { AttendanceStatus, DayAttendance } from "@/lib/types/students";
import { cn } from "@/lib/utils";

const STATUS_ORDER: Exclude<AttendanceStatus, "unmarked">[] = [
  "present",
  "absent",
  "leave",
];

const STATUS_STYLES: Record<
  Exclude<AttendanceStatus, "unmarked">,
  { active: string; idle: string; label: string }
> = {
  present: {
    label: "Present",
    active: "bg-emerald-600 text-white border-emerald-600",
    idle: "border-emerald-200 text-emerald-800 hover:bg-emerald-50",
  },
  absent: {
    label: "Absent",
    active: "bg-rose-600 text-white border-rose-600",
    idle: "border-rose-200 text-rose-800 hover:bg-rose-50",
  },
  leave: {
    label: "Leave",
    active: "bg-amber-500 text-white border-amber-500",
    idle: "border-amber-200 text-amber-900 hover:bg-amber-50",
  },
};

export default function AttendancePage() {
  const [date, setDate] = useState(todayISO);
  const [day, setDay] = useState<DayAttendance | null>(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback((d: string) => {
    setDay(getAttendanceForDate(d));
  }, []);

  useEffect(() => {
    reload(date);
    setReady(true);
  }, [date, reload]);

  const counts = useMemo(
    () => (day ? countAttendance(day) : null),
    [day]
  );

  function mark(studentId: string, status: AttendanceStatus) {
    const next = setStudentAttendance(date, studentId, status);
    setDay(next);
  }

  function markAll(status: Exclude<AttendanceStatus, "unmarked">) {
    const next = setAllAttendance(date, status);
    setDay(next);
    toast.success(`Marked all students ${status}`);
  }

  if (!ready || !day) {
    return (
      <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-white to-slate-50/80">
        <p className="text-sm text-muted-foreground">Loading attendance…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-gradient-to-b from-white to-slate-50/80">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 text-primary">
            <ClipboardList className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Classroom
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Attendance
          </h1>
          <p className="mt-2 text-muted-foreground">
            Mark present, absent, or leave for the mock class of 20 students.
            Open a student to see and manage assigned lesson plans, practice
            sheets, and homework.
          </p>
        </motion.div>

        <Card className="mb-5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Date & summary
            </CardTitle>
            <CardDescription>
              Attendance is saved in this browser for the selected date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <label htmlFor="att-date" className="text-sm font-medium">
                  Date
                </label>
                <input
                  id="att-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || todayISO())}
                  className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => markAll("present")}
                >
                  <Check className="h-3.5 w-3.5" />
                  All present
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => markAll("absent")}
                >
                  All absent
                </Button>
              </div>
            </div>

            {counts && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["present", "Present", "text-emerald-700 bg-emerald-50"],
                    ["absent", "Absent", "text-rose-700 bg-rose-50"],
                    ["leave", "Leave", "text-amber-800 bg-amber-50"],
                    ["unmarked", "Unmarked", "text-slate-600 bg-slate-100"],
                  ] as const
                ).map(([key, label, style]) => (
                  <div
                    key={key}
                    className={cn("rounded-xl px-3 py-2 text-center", style)}
                  >
                    <p className="text-lg font-semibold tabular-nums">
                      {counts[key]}
                    </p>
                    <p className="text-xs font-medium">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Student list</CardTitle>
            <CardDescription>
              Grade 8 · Mock roster · Click a name for profile & assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {MOCK_STUDENTS.map((student, index) => {
                const status = day.statuses[student.id] ?? "unmarked";
                return (
                  <li
                    key={student.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {student.rollNo}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/students/${student.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {student.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Roll {student.rollNo} · Grade {student.grade}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                      {STATUS_ORDER.map((s) => {
                        const styles = STATUS_STYLES[s];
                        const active = status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() =>
                              mark(student.id, active ? "unmarked" : s)
                            }
                            className={cn(
                              "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                              active ? styles.active : styles.idle
                            )}
                          >
                            {styles.label}
                          </button>
                        );
                      })}
                      {status === "unmarked" && (
                        <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Minus className="h-3 w-3" />
                          Not marked
                        </span>
                      )}
                      <Link
                        href={`/students/${student.id}`}
                        className="ml-1 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                        aria-label={`Open ${student.name}`}
                      >
                        <User className="h-3 w-3" />
                        Profile
                      </Link>
                    </div>
                    {index === MOCK_STUDENTS.length - 1 ? null : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
