export type ConfidenceLevel = "high" | "low" | "none";

export interface AnnexureBlock {
  label: string;
  content: string;
}

export interface GroundedLessonStructure {
  topic: string;
  concept: string;
  homeworkAssignment: string;
  preContentQuestions: string;
  contentIntroduction: string;
  contentComprehension: string;
  contentFlowChart: string;
  contentCharacterization: string;
  contentWriting: string;
  contentGeneral: string;
  postContent: string;
  learningOutcomes: string;
  teachersActivity: string;
  studentsActivity: string;
  teachingAids: string;
  methodology: string;
  interdisciplinaryLinks: string;
  annexures: AnnexureBlock[];
  sectionOrder: string[];
  sectionLabels: string[];
  keyTerms: string[];
}

export interface MetadataConfidence {
  grade: ConfidenceLevel;
  subject: ConfidenceLevel;
  chapter: ConfidenceLevel;
  concept: ConfidenceLevel;
}

export interface MetadataExtractionResult {
  grade: string;
  subject: string;
  chapter: string;
  concept: string;
  confidence: MetadataConfidence;
  needsManualEntry: boolean;
}

/** @deprecated Legacy shape — migrated on read */
export interface LessonPlanStructure {
  learningOutcomes: string;
  resourcesRequired: string;
  objectives: string;
  warmUp: string;
  conceptBuilding: string;
  extension: string;
  assessment: string;
  modelKeyAnswers: string;
  skillsAndAttitude: string;
  competencies: string;
  noteForFacilitator: string;
  sectionOrder: string[];
}

export interface KnowledgeBaseEntry {
  id: number;
  grade: string;
  subject: string;
  chapter: string;
  filename: string;
  raw_text: string;
  structure_json: GroundedLessonStructure;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseMetadata {
  grade: string;
  subject: string;
  chapter: string;
  concept?: string;
}

export interface CustomizationOptions {
  shortenWarmUp: boolean;
  extraPractice: boolean;
  simplifyLanguage: boolean;
  realWorldExamples: boolean;
  customText: string;
}

export const CUSTOMIZATION_PRESETS: Record<
  keyof Omit<CustomizationOptions, "customText">,
  string
> = {
  shortenWarmUp: "Shorten the Warm-Up activity while keeping it engaging.",
  extraPractice:
    "Add 2–3 EXTRA practice questions clearly labeled 'Additional Practice' — separate from and in addition to the original Annexure questions. Do NOT replace annexure content.",
  simplifyLanguage:
    "Simplify language throughout for students who need additional support.",
  realWorldExamples:
    "Include more real-world examples and connections to everyday life that are faithful to the source chapter's context.",
};

export interface GenerateFromKbInput {
  chapterId: number;
  numberOfDays: string;
  customization: CustomizationOptions;
  source: "knowledge_base";
}

export interface KnowledgeBaseFilters {
  grades: string[];
  subjects: string[];
  chapters: Array<{
    id: number;
    grade: string;
    subject: string;
    chapter: string;
    metadataComplete?: boolean;
  }>;
  /** Total stored chapters (including incomplete metadata) */
  totalEntries: number;
  /** Chapters missing grade, subject, or chapter title */
  incompleteCount: number;
}

export function emptyGroundedStructure(): GroundedLessonStructure {
  return {
    topic: "",
    concept: "",
    homeworkAssignment: "",
    preContentQuestions: "",
    contentIntroduction: "",
    contentComprehension: "",
    contentFlowChart: "",
    contentCharacterization: "",
    contentWriting: "",
    contentGeneral: "",
    postContent: "",
    learningOutcomes: "",
    teachersActivity: "",
    studentsActivity: "",
    teachingAids: "",
    methodology: "",
    interdisciplinaryLinks: "",
    annexures: [],
    sectionOrder: [],
    sectionLabels: [],
    keyTerms: [],
  };
}
