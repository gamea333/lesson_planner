export const DEFAULT_TEMPLATE_SECTIONS = [
  "Grade",
  "Subject",
  "Chapter",
  "Concept",
  "Number of Days",
  "Learning Outcomes",
  "Resources Required",
  "Objectives",
  "Teaching Methodology",
  "Warm Up",
  "Concept-Building",
  "Extension",
  "Assessment",
  "Model Key Answers",
  "Skills and Attitude",
  "Competencies",
  "Note for Facilitator",
  "Annexure",
] as const;

export const ACCEPTED_QUESTION_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "text/csv": [".csv"],
} as const;

export const ACCEPTED_TEMPLATE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
} as const;

export interface LessonMetadata {
  grade: string;
  subject: string;
  chapter: string;
  numberOfDays: string;
}

export interface ParsedQuestionData {
  fileName: string;
  format: string;
  dataType: "text" | "structured";
  text?: string;
  questions?: Array<{
    question: string;
    options?: string;
    correctAnswer?: string;
    explanation?: string;
  }>;
  questionCount?: number | null;
  templateContent?: string | null;
}
