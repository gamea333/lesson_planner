"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileText,
  MessageCircle,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { getStudentById } from "@/lib/mock-students";
import { openAssignmentSnapshot } from "@/lib/open-assignment";
import {
  addPerformanceUpdate,
  getAssignmentsForStudent,
  getAttendanceForDate,
  getPerformanceUpdatesForStudent,
  markPerformanceSentToParent,
  removeAssignment,
  removePerformanceUpdate,
  todayISO,
} from "@/lib/student-store";
import type {
  AttendanceStatus,
  PerformanceLevel,
  PerformanceUpdate,
  StudentAssignment,
} from "@/lib/types/students";
import {
  ASSIGNMENT_KIND_LABELS,
  ATTENDANCE_STATUS_LABELS,
  PERFORMANCE_LEVEL_LABELS,
  PERFORMANCE_LEVELS,
} from "@/lib/types/students";
import { cn } from "@/lib/utils";
import {
  getWhatsAppDisplayNumber,
  hasWhatsAppNumber,
  openWhatsAppMessage,
  requestWhatsAppSettings,
} from "@/lib/whatsapp";

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: "bg-emerald-50 text-emerald-800 border-emerald-200",
  absent: "bg-rose-50 text-rose-800 border-rose-200",
  leave: "bg-amber-50 text-amber-900 border-amber-200",
  unmarked: "bg-slate-50 text-slate-600 border-slate-200",
};

const LEVEL_COLOR: Record<PerformanceLevel, string> = {
  excellent: "bg-emerald-50 text-emerald-800 border-emerald-200",
  good: "bg-sky-50 text-sky-800 border-sky-200",
  average: "bg-amber-50 text-amber-900 border-amber-200",
  needs_improvement: "bg-rose-50 text-rose-800 border-rose-200",
};

const KIND_ICON = {
  lesson_plan: BookOpen,
  practice_sheet: FileText,
  homework: ClipboardList,
} as const;

function buildParentFeedbackMessage(
  studentName: string,
  parentName: string,
  update: PerformanceUpdate
): string {
  const date = new Date(update.createdAt).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
  return [
    `Dear ${parentName},`,
    "",
    `This is a performance update for ${studentName}.`,
    "",
    `Student: ${studentName}`,
    `Subject / focus: ${update.subject}`,
    `Overall: ${PERFORMANCE_LEVEL_LABELS[update.level]}`,
    `Date: ${date}`,
    "",
    "Teacher feedback:",
    update.note,
    "",
    "Please feel free to reply if you have any questions.",
    "",
    "— LessonPlanner (Teacher)",
  ].join("\n");
}

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = String(params.id ?? "");
  const student = getStudentById(studentId);

  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [updates, setUpdates] = useState<PerformanceUpdate[]>([]);
  const [todayStatus, setTodayStatus] = useState<AttendanceStatus>("unmarked");
  const [ready, setReady] = useState(false);

  const [level, setLevel] = useState<PerformanceLevel>("good");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");

  const reload = useCallback(() => {
    if (!studentId) return;
    setAssignments(getAssignmentsForStudent(studentId));
    setUpdates(getPerformanceUpdatesForStudent(studentId));
    const day = getAttendanceForDate(todayISO());
    setTodayStatus(day.statuses[studentId] ?? "unmarked");
  }, [studentId]);

  useEffect(() => {
    reload();
    setReady(true);
  }, [reload]);

  const grouped = useMemo(() => {
    const map = {
      lesson_plan: [] as StudentAssignment[],
      practice_sheet: [] as StudentAssignment[],
      homework: [] as StudentAssignment[],
    };
    for (const a of assignments) {
      map[a.kind].push(a);
    }
    return map;
  }, [assignments]);

  function handleOpen(assignment: StudentAssignment) {
    try {
      const href = openAssignmentSnapshot(assignment.kind, assignment.snapshot);
      toast.success(`Opening ${ASSIGNMENT_KIND_LABELS[assignment.kind]}`);
      router.push(href);
    } catch {
      toast.error("Could not open this assignment");
    }
  }

  function handleRemove(id: string) {
    removeAssignment(id);
    reload();
    toast.success("Assignment removed");
  }

  function handleSaveUpdate() {
    if (!student) return;
    if (!note.trim()) {
      toast.error("Add a short feedback note");
      return;
    }
    addPerformanceUpdate({
      studentId: student.id,
      level,
      subject: subject || "General",
      note: note.trim(),
    });
    setNote("");
    setSubject("");
    setLevel("good");
    reload();
    toast.success("Performance update saved");
  }

  function ensureWhatsAppReady(): boolean {
    if (hasWhatsAppNumber()) return true;
    requestWhatsAppSettings();
    toast.error("Add your WhatsApp number first", {
      description: "Navbar → WhatsApp — then all shares go to your number.",
    });
    return false;
  }

  function handleSendToParent(update: PerformanceUpdate) {
    if (!student) return;
    if (!ensureWhatsAppReady()) return;
    const message = buildParentFeedbackMessage(
      student.name,
      student.parentName,
      update
    );
    try {
      openWhatsAppMessage(message);
      markPerformanceSentToParent(update.id);
      reload();
      toast.success("Feedback opened in WhatsApp", {
        description: `Sending to your number ${getWhatsAppDisplayNumber()}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "WhatsApp failed");
    }
  }

  function handleQuickWhatsApp() {
    if (!student) return;
    if (!ensureWhatsAppReady()) return;
    const latest = updates[0];
    if (latest) {
      handleSendToParent(latest);
      return;
    }
    const message = [
      `Dear ${student.parentName},`,
      "",
      `Hello — this is a message from ${student.name}'s teacher regarding Grade ${student.grade}.`,
      "",
      "I will share a performance update shortly.",
      "",
      "— LessonPlanner (Teacher)",
    ].join("\n");
    try {
      openWhatsAppMessage(message);
      toast.success("WhatsApp opened", {
        description: `Sending to your number ${getWhatsAppDisplayNumber()}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "WhatsApp failed");
    }
  }

  function handleRemoveUpdate(id: string) {
    removePerformanceUpdate(id);
    reload();
    toast.success("Update removed");
  }

  if (!student) {
    return (
      <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-white to-slate-50/80 px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Student not found</CardTitle>
            <CardDescription>
              That student is not in the mock class roster.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/attendance">
                <ArrowLeft />
                Back to attendance
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-gradient-to-b from-white to-slate-50/80">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Button variant="ghost" asChild className="mb-4 w-fit">
          <Link href="/attendance">
            <ArrowLeft />
            Attendance
          </Link>
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                Roll {student.rollNo} · Grade {student.grade}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                {student.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Parent: {student.parentName}
                {hasWhatsAppNumber()
                  ? ` · Feedback shares to your WhatsApp ${getWhatsAppDisplayNumber()}`
                  : " · Set your WhatsApp number in the navbar to share feedback"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  STATUS_COLOR[todayStatus]
                )}
              >
                Today: {ATTENDANCE_STATUS_LABELS[todayStatus]}
              </span>
              <Button type="button" size="sm" onClick={handleQuickWhatsApp}>
                <MessageCircle className="h-3.5 w-3.5" />
                Message parent
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["lesson_plan", "Lesson plans"],
              ["practice_sheet", "Practice sheets"],
              ["homework", "Homework"],
            ] as const
          ).map(([kind, label]) => (
            <Card key={kind}>
              <CardContent className="flex items-center justify-between py-4">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-xl font-semibold tabular-nums">
                  {grouped[kind].length}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Performance update
            </CardTitle>
            <CardDescription>
              Record feedback for this student, then send it to the parent on
              WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="perf-level">Overall level</Label>
                <select
                  id="perf-level"
                  value={level}
                  onChange={(e) =>
                    setLevel(e.target.value as PerformanceLevel)
                  }
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {PERFORMANCE_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {PERFORMANCE_LEVEL_LABELS[l]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="perf-subject">Subject / focus</Label>
                <input
                  id="perf-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Science · Chapter 3"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="perf-note">Teacher feedback</Label>
              <textarea
                id="perf-note"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What is going well, what to improve, and how parents can support at home…"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleSaveUpdate}>
                Save update
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!note.trim()) {
                    toast.error("Add feedback before sending");
                    return;
                  }
                  const saved = addPerformanceUpdate({
                    studentId: student.id,
                    level,
                    subject: subject || "General",
                    note: note.trim(),
                  });
                  setNote("");
                  setSubject("");
                  setLevel("good");
                  reload();
                  handleSendToParent(saved);
                }}
              >
                <MessageCircle className="h-4 w-4" />
                Save &amp; send to parent
              </Button>
            </div>

            {updates.length > 0 && (
              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">Past updates</p>
                <ul className="space-y-3">
                  {updates.map((u) => (
                    <li
                      key={u.id}
                      className="rounded-xl border bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                              LEVEL_COLOR[u.level]
                            )}
                          >
                            {PERFORMANCE_LEVEL_LABELS[u.level]}
                          </span>
                          <p className="mt-1.5 text-sm font-medium">
                            {u.subject}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {new Date(u.createdAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                            {u.sentToParentAt
                              ? ` · Sent to parent ${new Date(
                                  u.sentToParentAt
                                ).toLocaleDateString()}`
                              : " · Not sent yet"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSendToParent(u)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp parent
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveUpdate(u.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                        {u.note}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned materials</CardTitle>
            <CardDescription>
              Open an item to load it into the matching editor page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing assigned yet.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/generate">Lesson Plan</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/practice-sheet">Practice Sheet</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/homework">Homework</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {assignments.map((a) => {
                  const Icon = KIND_ICON[a.kind];
                  return (
                    <li
                      key={a.id}
                      className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {ASSIGNMENT_KIND_LABELS[a.kind]}
                          </p>
                          <p className="font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.grade} · {a.subject} · {a.chapter}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Assigned{" "}
                            {new Date(a.assignedAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOpen(a)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemove(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
