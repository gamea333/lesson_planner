import type { GenerateAssessmentInput, GeneratedAssessment } from "@/lib/types/assessment";
import type { GenerateHomeworkInput, GeneratedHomework } from "@/lib/types/homework";
import type { GenerateFromKbInput } from "@/lib/types/knowledge-base";
import type { LessonPlan } from "@/lib/types/lesson-plan";
import type { TeacherReview } from "@/lib/types/teacher-review";

export const SESSION_KEYS = {
  result: "lessonPlanResult",
  assessment: "assessmentResult",
  homework: "homeworkResult",
} as const;

export interface StoredLessonPlanSession {
  lessonPlan: LessonPlan;
  metadata: {
    grade: string;
    subject: string;
    chapter: string;
    numberOfDays: string;
  };
  generateInput: GenerateFromKbInput;
  concept?: string;
  chapterId: number;
  teacherReviews?: TeacherReview[];
}

export interface StoredAssessmentSession {
  assessment: GeneratedAssessment;
  generateInput: GenerateAssessmentInput;
  chapterId: number;
  teacherReviews?: TeacherReview[];
}

export interface StoredHomeworkSession {
  homework: GeneratedHomework;
  generateInput: GenerateHomeworkInput;
  chapterId: number;
  teacherReviews?: TeacherReview[];
}

export function loadLessonPlanSession(): StoredLessonPlanSession | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(SESSION_KEYS.result);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StoredLessonPlanSession;
  } catch {
    return null;
  }
}

export function saveLessonPlanSession(session: StoredLessonPlanSession): void {
  sessionStorage.setItem(SESSION_KEYS.result, JSON.stringify(session));
}

export function loadAssessmentSession(): StoredAssessmentSession | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(SESSION_KEYS.assessment);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StoredAssessmentSession;
  } catch {
    return null;
  }
}

export function saveAssessmentSession(session: StoredAssessmentSession): void {
  sessionStorage.setItem(SESSION_KEYS.assessment, JSON.stringify(session));
}

export function loadHomeworkSession(): StoredHomeworkSession | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(SESSION_KEYS.homework);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StoredHomeworkSession;
  } catch {
    return null;
  }
}

export function saveHomeworkSession(session: StoredHomeworkSession): void {
  sessionStorage.setItem(SESSION_KEYS.homework, JSON.stringify(session));
}

