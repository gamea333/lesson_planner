import fs from "fs";
import path from "path";

import type {
  GroundedLessonStructure,
  KnowledgeBaseEntry,
  KnowledgeBaseFilters,
} from "@/lib/types/knowledge-base";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "knowledgebase.json");

interface KnowledgeBaseFile {
  entries: KnowledgeBaseEntry[];
  nextId: number;
}

function ensureDataFile(): KnowledgeBaseFile {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initial: KnowledgeBaseFile = { entries: [], nextId: 1 };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }

  const raw = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(raw) as KnowledgeBaseFile;
}

function writeData(data: KnowledgeBaseFile): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function sortAlpha(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

export function listKnowledgeBaseEntries(filters?: {
  grade?: string;
  subject?: string;
  search?: string;
}): KnowledgeBaseEntry[] {
  const data = ensureDataFile();
  let entries = [...data.entries];

  if (filters?.grade) {
    entries = entries.filter((e) => e.grade === filters.grade);
  }
  if (filters?.subject) {
    entries = entries.filter((e) => e.subject === filters.subject);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.chapter.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.grade.toLowerCase().includes(q) ||
        e.filename.toLowerCase().includes(q)
    );
  }

  return entries.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getKnowledgeBaseEntry(id: number): KnowledgeBaseEntry | null {
  const data = ensureDataFile();
  return data.entries.find((e) => e.id === id) ?? null;
}

export function findKnowledgeBaseEntryByFilename(
  filename: string
): KnowledgeBaseEntry | null {
  const data = ensureDataFile();
  return data.entries.find((e) => e.filename === filename) ?? null;
}

export function createKnowledgeBaseEntry(input: {
  grade: string;
  subject: string;
  chapter: string;
  filename: string;
  raw_text: string;
  structure_json: GroundedLessonStructure;
}): KnowledgeBaseEntry {
  const data = ensureDataFile();
  const now = new Date().toISOString();

  const existingIndex = data.entries.findIndex(
    (e) =>
      e.grade === input.grade &&
      e.subject === input.subject &&
      e.chapter === input.chapter
  );

  if (existingIndex >= 0) {
    const updated: KnowledgeBaseEntry = {
      ...data.entries[existingIndex],
      filename: input.filename,
      raw_text: input.raw_text,
      structure_json: input.structure_json,
      updated_at: now,
    };
    data.entries[existingIndex] = updated;
    writeData(data);
    return updated;
  }

  const entry: KnowledgeBaseEntry = {
    id: data.nextId++,
    ...input,
    created_at: now,
    updated_at: now,
  };

  data.entries.push(entry);
  writeData(data);
  return entry;
}

export function replaceKnowledgeBaseEntry(
  id: number,
  input: {
    grade: string;
    subject: string;
    chapter: string;
    filename: string;
    raw_text: string;
    structure_json: GroundedLessonStructure;
  }
): KnowledgeBaseEntry | null {
  const data = ensureDataFile();
  const index = data.entries.findIndex((e) => e.id === id);
  if (index < 0) return null;

  const now = new Date().toISOString();
  data.entries[index] = {
    ...data.entries[index],
    ...input,
    updated_at: now,
  };
  writeData(data);
  return data.entries[index];
}

export function updateKnowledgeBaseEntry(
  id: number,
  patch: Partial<Pick<KnowledgeBaseEntry, "grade" | "subject" | "chapter">>
): KnowledgeBaseEntry | null {
  const data = ensureDataFile();
  const index = data.entries.findIndex((e) => e.id === id);
  if (index < 0) return null;

  data.entries[index] = {
    ...data.entries[index],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  writeData(data);
  return data.entries[index];
}

export function deleteKnowledgeBaseEntry(id: number): boolean {
  const data = ensureDataFile();
  const before = data.entries.length;
  data.entries = data.entries.filter((e) => e.id !== id);
  if (data.entries.length === before) return false;
  writeData(data);
  return true;
}

export function getKnowledgeBaseFilters(
  grade?: string,
  subject?: string
): KnowledgeBaseFilters {
  const entries = listKnowledgeBaseEntries().filter(
    (e) => e.grade && e.subject && e.chapter
  );
  const grades = sortAlpha(entries.map((e) => e.grade));
  const subjects = sortAlpha(
    entries
      .filter((e) => !grade || e.grade === grade)
      .map((e) => e.subject)
  );
  const chapters = entries
    .filter((e) => (!grade || e.grade === grade) && (!subject || e.subject === subject))
    .map((e) => ({
      id: e.id,
      grade: e.grade,
      subject: e.subject,
      chapter: e.chapter,
    }))
    .sort((a, b) => a.chapter.localeCompare(b.chapter));

  return { grades, subjects, chapters };
}
