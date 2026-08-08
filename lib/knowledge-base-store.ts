import fs from "fs";
import os from "os";
import path from "path";

import type {
  GroundedLessonStructure,
  KnowledgeBaseEntry,
  KnowledgeBaseFilters,
} from "@/lib/types/knowledge-base";

const BLOB_STORE_NAME = "lessonplanner-kb";
const BLOB_KEY = "knowledgebase";

interface KnowledgeBaseFile {
  entries: KnowledgeBaseEntry[];
  nextId: number;
}

function emptyDb(): KnowledgeBaseFile {
  return { entries: [], nextId: 1 };
}

/** Netlify / Lambda / Vercel cannot write under process.cwd() — only /tmp. */
function isServerless(): boolean {
  return Boolean(
    process.env.NETLIFY ||
      process.env.NETLIFY_BLOBS_CONTEXT ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.VERCEL
  );
}

function preferNetlifyBlobs(): boolean {
  return Boolean(
    process.env.NETLIFY ||
      process.env.NETLIFY_BLOBS_CONTEXT ||
      process.env.BLOBS_CONTEXT
  );
}

function getFsDataDir(): string {
  if (isServerless()) {
    return path.join(os.tmpdir(), "lessonplanner-data");
  }
  return path.join(process.cwd(), "data");
}

function getFsDbFile(): string {
  return path.join(getFsDataDir(), "knowledgebase.json");
}

function readFsDb(): KnowledgeBaseFile {
  const dir = getFsDataDir();
  const file = getFsDbFile();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(file)) {
    const initial = emptyDb();
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw) as KnowledgeBaseFile;
}

function writeFsDb(data: KnowledgeBaseFile): void {
  const dir = getFsDataDir();
  const file = getFsDbFile();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

async function readBlobsDb(): Promise<KnowledgeBaseFile | null> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore(BLOB_STORE_NAME);
    const data = await store.get(BLOB_KEY, { type: "json" });
    if (!data) return emptyDb();
    return data as KnowledgeBaseFile;
  } catch (err) {
    console.warn(
      "[KnowledgeBase] Netlify Blobs unavailable, falling back to filesystem:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function writeBlobsDb(data: KnowledgeBaseFile): Promise<boolean> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore(BLOB_STORE_NAME);
    await store.setJSON(BLOB_KEY, data);
    return true;
  } catch (err) {
    console.warn(
      "[KnowledgeBase] Netlify Blobs write failed, falling back to filesystem:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

async function readDb(): Promise<KnowledgeBaseFile> {
  if (preferNetlifyBlobs()) {
    const fromBlobs = await readBlobsDb();
    if (fromBlobs) return fromBlobs;
  }
  return readFsDb();
}

async function writeDb(data: KnowledgeBaseFile): Promise<void> {
  if (preferNetlifyBlobs()) {
    const ok = await writeBlobsDb(data);
    if (ok) return;
  }
  writeFsDb(data);
}

function sortAlpha(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

export async function listKnowledgeBaseEntries(filters?: {
  grade?: string;
  subject?: string;
  search?: string;
}): Promise<KnowledgeBaseEntry[]> {
  const data = await readDb();
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

export async function getKnowledgeBaseEntry(
  id: number
): Promise<KnowledgeBaseEntry | null> {
  const data = await readDb();
  return data.entries.find((e) => e.id === id) ?? null;
}

export async function findKnowledgeBaseEntryByFilename(
  filename: string
): Promise<KnowledgeBaseEntry | null> {
  const data = await readDb();
  return data.entries.find((e) => e.filename === filename) ?? null;
}

export async function createKnowledgeBaseEntry(input: {
  grade: string;
  subject: string;
  chapter: string;
  filename: string;
  raw_text: string;
  structure_json: GroundedLessonStructure;
}): Promise<KnowledgeBaseEntry> {
  const data = await readDb();
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
    await writeDb(data);
    return updated;
  }

  const entry: KnowledgeBaseEntry = {
    id: data.nextId++,
    ...input,
    created_at: now,
    updated_at: now,
  };

  data.entries.push(entry);
  await writeDb(data);
  return entry;
}

export async function replaceKnowledgeBaseEntry(
  id: number,
  input: {
    grade: string;
    subject: string;
    chapter: string;
    filename: string;
    raw_text: string;
    structure_json: GroundedLessonStructure;
  }
): Promise<KnowledgeBaseEntry | null> {
  const data = await readDb();
  const index = data.entries.findIndex((e) => e.id === id);
  if (index < 0) return null;

  const now = new Date().toISOString();
  data.entries[index] = {
    ...data.entries[index],
    ...input,
    updated_at: now,
  };
  await writeDb(data);
  return data.entries[index];
}

export async function updateKnowledgeBaseEntry(
  id: number,
  patch: Partial<Pick<KnowledgeBaseEntry, "grade" | "subject" | "chapter">>
): Promise<KnowledgeBaseEntry | null> {
  const data = await readDb();
  const index = data.entries.findIndex((e) => e.id === id);
  if (index < 0) return null;

  data.entries[index] = {
    ...data.entries[index],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await writeDb(data);
  return data.entries[index];
}

export async function deleteKnowledgeBaseEntry(id: number): Promise<boolean> {
  const data = await readDb();
  const before = data.entries.length;
  data.entries = data.entries.filter((e) => e.id !== id);
  if (data.entries.length === before) return false;
  await writeDb(data);
  return true;
}

export async function getKnowledgeBaseFilters(
  grade?: string,
  subject?: string
): Promise<KnowledgeBaseFilters> {
  const entries = (await listKnowledgeBaseEntries()).filter(
    (e) => e.grade && e.subject && e.chapter
  );
  const grades = sortAlpha(entries.map((e) => e.grade));
  const subjects = sortAlpha(
    entries
      .filter((e) => !grade || e.grade === grade)
      .map((e) => e.subject)
  );
  const chapters = entries
    .filter(
      (e) => (!grade || e.grade === grade) && (!subject || e.subject === subject)
    )
    .map((e) => ({
      id: e.id,
      grade: e.grade,
      subject: e.subject,
      chapter: e.chapter,
    }))
    .sort((a, b) => a.chapter.localeCompare(b.chapter));

  return { grades, subjects, chapters };
}
