export interface ModelKeyAnswer {
  question: string;
  answer: string;
  explanation: string;
}

export interface PhaseObjectives {
  warmUp: string;
  conceptBuilding: string;
  extension: string;
  assessment: string;
}

export interface TeachingMethodology {
  warmUp: string;
  conceptBuilding: string;
  extension: string[];
  assessment: string[];
  modelKeyAnswers: ModelKeyAnswer[];
  /** Required citation of a source proper noun/term for this methodology block */
  sourceCitation?: string;
  warmUpCitation?: string;
  conceptBuildingCitation?: string;
  extensionCitation?: string;
  assessmentCitation?: string;
}

/** Per-day plan used when numberOfDays > 1 */
export interface DayPlan {
  day: number;
  title: string;
  focus: string;
  objectives: PhaseObjectives;
  teachingMethodology: TeachingMethodology;
  skillsAndAttitude?: string[];
  competencies?: string[];
  noteForFacilitator?: string;
}

export interface LessonPlan {
  grade: string;
  subject: string;
  chapter: string;
  numberOfDays: string;
  learningOutcomes: string[];
  resourcesRequired: string[];
  /** Flat structure for single-day (backward compatible) */
  objectives: PhaseObjectives;
  teachingMethodology: TeachingMethodology;
  skillsAndAttitude: string[];
  competencies: string[];
  noteForFacilitator: string;
  /** Multi-day breakdown — present when days > 1 */
  days?: DayPlan[];
}

export function isMultiDayPlan(plan: LessonPlan): boolean {
  return Array.isArray(plan.days) && plan.days.length > 1;
}

export function getDayCount(plan: LessonPlan): number {
  if (plan.days?.length) return plan.days.length;
  const n = parseInt(plan.numberOfDays, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
