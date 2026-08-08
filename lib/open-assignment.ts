import {
  saveAssessmentSession,
  saveHomeworkSession,
  saveLessonPlanSession,
  type StoredAssessmentSession,
  type StoredHomeworkSession,
  type StoredLessonPlanSession,
} from "@/lib/session";
import type { AssignmentKind } from "@/lib/types/students";

/** Load an assigned snapshot into sessionStorage and return the route to open it. */
export function openAssignmentSnapshot(
  kind: AssignmentKind,
  snapshot: unknown
): string {
  if (kind === "lesson_plan") {
    const session = snapshot as StoredLessonPlanSession;
    saveLessonPlanSession(session);
    return "/generate";
  }
  if (kind === "practice_sheet") {
    const session = snapshot as StoredAssessmentSession;
    saveAssessmentSession(session);
    return "/practice-sheet/result";
  }
  const session = snapshot as StoredHomeworkSession;
  saveHomeworkSession(session);
  return "/homework/result";
}
