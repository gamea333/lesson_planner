import type { BloomLevel } from "@/lib/types/blooms-taxonomy";
import { BLOOM_LEVELS } from "@/lib/types/blooms-taxonomy";

export type HomeworkTaskType =
  | "short_answer"
  | "long_answer"
  | "practice"
  | "research";

export const HOMEWORK_TASK_LABELS: Record<HomeworkTaskType, string> = {
  short_answer: "Short Answer",
  long_answer: "Long Answer / Writing",
  practice: "Practice / Application",
  research: "Research Topic",
};

export interface HomeworkDayFocusHint {
  day: number;
  title: string;
  focus: string;
}

export interface HomeworkQuestion {
  id: string;
  type: Exclude<HomeworkTaskType, "research">;
  bloomLevel: BloomLevel;
  prompt: string;
  hint?: string;
  suggestedAnswer?: string;
}

export interface HomeworkResearchTopic {
  id: string;
  topic: string;
  guidance: string;
  suggestedSources: string[];
  /** Research tasks typically map to Analyze / Evaluate / Create */
  bloomLevel: BloomLevel;
}

export interface DayHomework {
  day: number;
  title: string;
  focus: string;
  overview: string;
  questions: HomeworkQuestion[];
  researchTopics: HomeworkResearchTopic[];
}

export interface GeneratedHomework {
  grade: string;
  subject: string;
  chapter: string;
  numberOfDays: number;
  instructions: string;
  days: DayHomework[];
}

export interface GenerateHomeworkInput {
  chapterId: number;
  numberOfDays: number;
  questionsPerDay: number;
  researchTopicsPerDay: number;
  includeAnswerHints: boolean;
  customNotes: string;
  /** Bloom levels to cover across the pack; default all six */
  bloomLevels?: BloomLevel[];
  /** Optional focus from an existing lesson plan's days */
  dayFocusHints?: HomeworkDayFocusHint[];
  source: "knowledge_base";
}

export const DEFAULT_HOMEWORK_INPUT = {
  numberOfDays: 1,
  questionsPerDay: 4,
  researchTopicsPerDay: 1,
  includeAnswerHints: true,
  customNotes: "",
} as const;

export const DEFAULT_HOMEWORK_BLOOM_LEVELS: BloomLevel[] = [...BLOOM_LEVELS];

