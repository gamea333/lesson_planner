import { MOCK_STUDENTS } from "@/lib/mock-students";
import type {
  AssignmentKind,
  AttendanceStatus,
  DayAttendance,
  PerformanceLevel,
  PerformanceUpdate,
  StudentAssignment,
} from "@/lib/types/students";

const STORAGE_KEY = "lessonPlanner.classroom";

export interface ClassroomState {
  attendanceByDate: Record<string, DayAttendance>;
  assignments: StudentAssignment[];
  performanceUpdates: PerformanceUpdate[];
}

function emptyState(): ClassroomState {
  return {
    attendanceByDate: {},
    assignments: [],
    performanceUpdates: [],
  };
}

function readState(): ClassroomState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as ClassroomState;
    return {
      attendanceByDate: parsed.attendanceByDate ?? {},
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
      performanceUpdates: Array.isArray(parsed.performanceUpdates)
        ? parsed.performanceUpdates
        : [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ClassroomState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getAttendanceForDate(date: string): DayAttendance {
  const state = readState();
  const existing = state.attendanceByDate[date];
  if (existing) return existing;

  const statuses: Record<string, AttendanceStatus> = {};
  for (const s of MOCK_STUDENTS) {
    statuses[s.id] = "unmarked";
  }
  return { date, statuses };
}

export function setStudentAttendance(
  date: string,
  studentId: string,
  status: AttendanceStatus
): DayAttendance {
  const state = readState();
  const day = state.attendanceByDate[date] ?? getAttendanceForDate(date);
  const next: DayAttendance = {
    date,
    statuses: { ...day.statuses, [studentId]: status },
  };
  state.attendanceByDate[date] = next;
  writeState(state);
  return next;
}

export function setAllAttendance(
  date: string,
  status: Exclude<AttendanceStatus, "unmarked">
): DayAttendance {
  const state = readState();
  const statuses: Record<string, AttendanceStatus> = {};
  for (const s of MOCK_STUDENTS) {
    statuses[s.id] = status;
  }
  const next: DayAttendance = { date, statuses };
  state.attendanceByDate[date] = next;
  writeState(state);
  return next;
}

export function getAssignmentsForStudent(studentId: string): StudentAssignment[] {
  return readState()
    .assignments.filter((a) => a.studentId === studentId)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
}

export function getAssignmentById(id: string): StudentAssignment | null {
  return readState().assignments.find((a) => a.id === id) ?? null;
}

export function getAllAssignments(): StudentAssignment[] {
  return [...readState().assignments].sort((a, b) =>
    b.assignedAt.localeCompare(a.assignedAt)
  );
}

export interface AssignMaterialInput {
  studentIds: string[];
  kind: AssignmentKind;
  title: string;
  chapter: string;
  grade: string;
  subject: string;
  snapshot: unknown;
}

export function assignMaterialToStudents(
  input: AssignMaterialInput
): StudentAssignment[] {
  const state = readState();
  const created: StudentAssignment[] = [];
  const now = new Date().toISOString();

  for (const studentId of input.studentIds) {
    const assignment: StudentAssignment = {
      id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      studentId,
      kind: input.kind,
      title: input.title,
      chapter: input.chapter,
      grade: input.grade,
      subject: input.subject,
      assignedAt: now,
      snapshot: input.snapshot,
    };
    created.push(assignment);
    state.assignments.push(assignment);
  }

  writeState(state);
  return created;
}

export function removeAssignment(assignmentId: string): void {
  const state = readState();
  state.assignments = state.assignments.filter((a) => a.id !== assignmentId);
  writeState(state);
}

export function countAttendance(
  day: DayAttendance
): Record<Exclude<AttendanceStatus, "unmarked"> | "unmarked", number> {
  const counts = { present: 0, absent: 0, leave: 0, unmarked: 0 };
  for (const s of MOCK_STUDENTS) {
    const st = day.statuses[s.id] ?? "unmarked";
    counts[st] += 1;
  }
  return counts;
}

export function getPerformanceUpdatesForStudent(
  studentId: string
): PerformanceUpdate[] {
  return readState()
    .performanceUpdates.filter((p) => p.studentId === studentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addPerformanceUpdate(input: {
  studentId: string;
  level: PerformanceLevel;
  subject: string;
  note: string;
}): PerformanceUpdate {
  const state = readState();
  const update: PerformanceUpdate = {
    id: `perf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentId: input.studentId,
    level: input.level,
    subject: input.subject.trim() || "General",
    note: input.note.trim(),
    createdAt: new Date().toISOString(),
  };
  state.performanceUpdates.push(update);
  writeState(state);
  return update;
}

export function removePerformanceUpdate(id: string): void {
  const state = readState();
  state.performanceUpdates = state.performanceUpdates.filter((p) => p.id !== id);
  writeState(state);
}

export function markPerformanceSentToParent(
  id: string
): PerformanceUpdate | null {
  const state = readState();
  const idx = state.performanceUpdates.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const updated: PerformanceUpdate = {
    ...state.performanceUpdates[idx],
    sentToParentAt: new Date().toISOString(),
  };
  state.performanceUpdates[idx] = updated;
  writeState(state);
  return updated;
}
