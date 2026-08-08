import mammoth from "mammoth";
import * as XLSX from "xlsx";

export interface StructuredQuestion {
  question: string;
  options?: string;
  correctAnswer?: string;
  explanation?: string;
}

export type ParsedQuestionResult =
  | { format: "pdf" | "docx" | "csv"; dataType: "text"; text: string }
  | {
      format: "xlsx";
      dataType: "structured";
      questions: StructuredQuestion[];
      sheetNames: string[];
    };

export class ParseFileError extends Error {
  constructor(
    message: string,
    public readonly code: "UNSUPPORTED" | "CORRUPTED" | "EMPTY" | "INVALID"
  ) {
    super(message);
    this.name = "ParseFileError";
  }
}

const COLUMN_ALIASES: Record<string, keyof StructuredQuestion> = {
  question: "question",
  questions: "question",
  q: "question",
  "question text": "question",
  options: "options",
  option: "options",
  choices: "options",
  "answer choices": "options",
  "correct answer": "correctAnswer",
  correct_answer: "correctAnswer",
  correct: "correctAnswer",
  answer: "correctAnswer",
  "correct option": "correctAnswer",
  explanation: "explanation",
  explain: "explanation",
  rationale: "explanation",
  "solution explanation": "explanation",
};

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapHeaderToField(header: string): keyof StructuredQuestion | null {
  const normalized = normalizeHeader(header);
  return COLUMN_ALIASES[normalized] ?? null;
}

async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const { extractPdfText } = await import("@/lib/pdf-text");
    const extraction = await extractPdfText(buffer);
    const text = extraction.text?.trim() ?? "";
    if (!text) {
      throw new ParseFileError(
        "The PDF appears to be empty, and OCR could not read any text from its pages.",
        "EMPTY"
      );
    }
    return text;
  } catch (error) {
    if (error instanceof ParseFileError) throw error;
    // Fall through — keep legacy message for unexpected failures
    throw new ParseFileError(
      error instanceof Error
        ? error.message
        : "Could not read this PDF. The file may be corrupted or password-protected.",
      "CORRUPTED"
    );
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value?.trim() ?? "";
    if (!text) {
      throw new ParseFileError(
        "The Word document appears to be empty.",
        "EMPTY"
      );
    }
    return text;
  } catch (error) {
    if (error instanceof ParseFileError) throw error;
    throw new ParseFileError(
      "Could not read this Word document. The file may be corrupted.",
      "CORRUPTED"
    );
  }
}

function parseCsv(buffer: Buffer): string {
  try {
    const text = buffer.toString("utf-8").trim();
    if (!text) {
      throw new ParseFileError("The CSV file is empty.", "EMPTY");
    }
    return text;
  } catch (error) {
    if (error instanceof ParseFileError) throw error;
    throw new ParseFileError(
      "Could not read this CSV file. The file may be corrupted.",
      "CORRUPTED"
    );
  }
}

function rowToQuestion(
  row: Record<string, string>,
  headerMap: Map<number, keyof StructuredQuestion>
): StructuredQuestion | null {
  const question: StructuredQuestion = { question: "" };

  for (const [colIndex, field] of Array.from(headerMap.entries())) {
    const value = row[`__col_${colIndex}`]?.trim();
    if (!value) continue;

    if (field === "question") question.question = value;
    else if (field === "options") question.options = value;
    else if (field === "correctAnswer") question.correctAnswer = value;
    else if (field === "explanation") question.explanation = value;
  }

  if (!question.question) return null;
  return question;
}

function parseXlsxSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): StructuredQuestion[] {
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
    sheet,
    { header: 1, defval: "" }
  );

  if (rows.length === 0) return [];

  const headerRow = rows[0].map((cell) => String(cell ?? ""));
  const headerMap = new Map<number, keyof StructuredQuestion>();

  headerRow.forEach((header, index) => {
    const field = mapHeaderToField(header);
    if (field) headerMap.set(index, field);
  });

  if (headerMap.size === 0) {
    throw new ParseFileError(
      `Sheet "${sheetName}" has no recognizable columns. Expected headers like Question, Options, Correct Answer, or Explanation.`,
      "INVALID"
    );
  }

  const questions: StructuredQuestion[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const record: Record<string, string> = {};

    row.forEach((cell, colIndex) => {
      record[`__col_${colIndex}`] = String(cell ?? "").trim();
    });

    const hasContent = Object.values(record).some((v) => v.length > 0);
    if (!hasContent) continue;

    const question = rowToQuestion(record, headerMap);
    if (question) questions.push(question);
  }

  return questions;
}

function parseXlsx(buffer: Buffer): {
  questions: StructuredQuestion[];
  sheetNames: string[];
} {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });

    if (workbook.SheetNames.length === 0) {
      throw new ParseFileError("The Excel file contains no sheets.", "EMPTY");
    }

    const allQuestions: StructuredQuestion[] = [];
    const parsedSheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const questions = parseXlsxSheet(sheet, sheetName);
      if (questions.length > 0) {
        allQuestions.push(...questions);
        parsedSheets.push(sheetName);
      }
    }

    if (allQuestions.length === 0) {
      throw new ParseFileError(
        "No questions found in the Excel file. Ensure rows include a Question column with content.",
        "EMPTY"
      );
    }

    return { questions: allQuestions, sheetNames: parsedSheets };
  } catch (error) {
    if (error instanceof ParseFileError) throw error;
    throw new ParseFileError(
      "Could not read this Excel file. The file may be corrupted or in an unsupported format.",
      "CORRUPTED"
    );
  }
}

export async function parseQuestionFile(
  buffer: Buffer,
  fileName: string
): Promise<ParsedQuestionResult> {
  if (!buffer.length) {
    throw new ParseFileError("The uploaded file is empty.", "EMPTY");
  }

  const ext = getExtension(fileName);

  switch (ext) {
    case "pdf":
      return { format: "pdf", dataType: "text", text: await parsePdf(buffer) };
    case "docx":
      return { format: "docx", dataType: "text", text: await parseDocx(buffer) };
    case "csv":
      return { format: "csv", dataType: "text", text: parseCsv(buffer) };
    case "xlsx":
    case "xls": {
      const { questions, sheetNames } = parseXlsx(buffer);
      return {
        format: "xlsx",
        dataType: "structured",
        questions,
        sheetNames,
      };
    }
    default:
      throw new ParseFileError(
        `Unsupported file format ".${ext || "unknown"}". Please upload a .pdf, .xlsx, .docx, or .csv file.`,
        "UNSUPPORTED"
      );
  }
}

/** Extract plain text from template files (pdf/docx only). */
export async function parseTemplateFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = getExtension(fileName);

  switch (ext) {
    case "pdf":
      return parsePdf(buffer);
    case "docx":
      return parseDocx(buffer);
    default:
      throw new ParseFileError(
        `Unsupported template format ".${ext}". Use .docx or .pdf.`,
        "UNSUPPORTED"
      );
  }
}
