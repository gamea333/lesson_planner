import type { BloomLevel } from "@/lib/types/blooms-taxonomy";
import { BLOOM_LEVELS } from "@/lib/types/blooms-taxonomy";

export type QuestionType =
  | "mcq"
  | "short_answer"
  | "long_answer"
  | "fill_blank"
  | "true_false";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "MCQ",
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  fill_blank: "Fill in the Blanks",
  true_false: "True/False",
};

export interface DifficultyMix {
  easy: number;
  medium: number;
  hard: number;
}

export interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  difficulty: "easy" | "medium" | "hard";
  /** Bloom's taxonomy cognitive level */
  bloomLevel: BloomLevel;
  questionText: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface GeneratedAssessment {
  grade: string;
  subject: string;
  chapter: string;
  instructions: string;
  questions: AssessmentQuestion[];
}

export interface GenerateAssessmentInput {
  chapterId: number;
  questionCount: 5 | 10 | 15 | 20;
  questionTypes: QuestionType[];
  difficultyMix: DifficultyMix;
  /** Bloom levels to cover; default all six */
  bloomLevels?: BloomLevel[];
  focusAreas: string;
  source: "knowledge_base";
}

export const DEFAULT_DIFFICULTY_MIX: DifficultyMix = {
  easy: 40,
  medium: 40,
  hard: 20,
};

export const DEFAULT_BLOOM_LEVELS: BloomLevel[] = [...BLOOM_LEVELS];

