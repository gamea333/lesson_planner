export type AttendanceStatus = "present" | "absent" | "leave" | "unmarked";

export type AssignmentKind = "lesson_plan" | "practice_sheet" | "homework";

export type PerformanceLevel =
  | "excellent"
  | "good"
  | "average"
  | "needs_improvement";

export interface Student {
  id: string;
  rollNo: number;
  name: string;
  grade: string;
  /** Parent / guardian display name (mock) */
  parentName: string;
}

export interface DayAttendance {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** studentId → status */
  statuses: Record<string, AttendanceStatus>;
}

export interface StudentAssignmentMeta {
  id: string;
  studentId: string;
  kind: AssignmentKind;
  title: string;
  chapter: string;
  grade: string;
  subject: string;
  assignedAt: string;
}

/** Full assignment including a content snapshot for later viewing. */
export interface StudentAssignment extends StudentAssignmentMeta {
  /** JSON-serializable snapshot of the assigned material */
  snapshot: unknown;
}

export interface PerformanceUpdate {
  id: string;
  studentId: string;
  level: PerformanceLevel;
  subject: string;
  note: string;
  createdAt: string;
  /** ISO date when last sent to parent via WhatsApp, if any */
  sentToParentAt?: string;
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  leave: "Leave",
  unmarked: "—",
};

export const ASSIGNMENT_KIND_LABELS: Record<AssignmentKind, string> = {
  lesson_plan: "Lesson Plan",
  practice_sheet: "Practice Sheet",
  homework: "Homework",
};

export const PERFORMANCE_LEVEL_LABELS: Record<PerformanceLevel, string> = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  needs_improvement: "Needs improvement",
};

export const PERFORMANCE_LEVELS: PerformanceLevel[] = [
  "excellent",
  "good",
  "average",
  "needs_improvement",
];
