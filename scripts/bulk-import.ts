import fs from "fs";
import path from "path";

import {
  insertProcessedPdf,
  processPdfForKnowledgeBase,
} from "@/lib/knowledge-base-import";
import { findKnowledgeBaseEntryByFilename } from "@/lib/knowledge-base-store";

const SOURCE_DIR = path.join(process.cwd(), "knowledge-base-source");

interface ImportRow {
  filename: string;
  grade: string;
  subject: string;
  chapter: string;
  needsManual: boolean;
  status: "imported" | "skipped" | "error";
  message?: string;
}

function collectPdfFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectPdfFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function pad(value: string, width: number): string {
  return value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width);
}

function printSummaryTable(rows: ImportRow[]): void {
  const header = [
    pad("filename", 36),
    pad("grade", 14),
    pad("subject", 18),
    pad("chapter", 32),
    pad("needsManual", 12),
    pad("status", 10),
  ].join(" | ");

  console.log("\n" + header);
  console.log("-".repeat(header.length));

  for (const row of rows) {
    console.log(
      [
        pad(row.filename, 36),
        pad(row.grade || "—", 14),
        pad(row.subject || "—", 18),
        pad(row.chapter || "—", 32),
        pad(String(row.needsManual), 12),
        pad(row.status, 10),
      ].join(" | ")
    );
    if (row.message) {
      console.log(`  ↳ ${row.message}`);
    }
  }

  const imported = rows.filter((r) => r.status === "imported").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;
  const errors = rows.filter((r) => r.status === "error").length;
  const needsManual = rows.filter((r) => r.needsManual && r.status === "imported").length;

  console.log("\nSummary:");
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (duplicate filename): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Needs manual metadata: ${needsManual}`);
}

async function main(): Promise<void> {
  console.log(`[bulk-import] Reading PDFs from ${SOURCE_DIR}`);

  if (!fs.existsSync(SOURCE_DIR)) {
    fs.mkdirSync(SOURCE_DIR, { recursive: true });
    console.log(
      `[bulk-import] Created empty folder. Add PDFs to knowledge-base-source/ and run again.`
    );
    return;
  }

  const pdfFiles = collectPdfFiles(SOURCE_DIR);

  if (!pdfFiles.length) {
    console.log("[bulk-import] No PDF files found in knowledge-base-source/");
    return;
  }

  console.log(`[bulk-import] Found ${pdfFiles.length} PDF(s)\n`);

  const rows: ImportRow[] = [];

  for (const filePath of pdfFiles) {
    const filename = path.basename(filePath);

    const existing = await findKnowledgeBaseEntryByFilename(filename);
    if (existing) {
      rows.push({
        filename,
        grade: existing.grade,
        subject: existing.subject,
        chapter: existing.chapter,
        needsManual: !(existing.grade && existing.subject && existing.chapter),
        status: "skipped",
        message: "duplicate filename — already in knowledge base",
      });
      continue;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const processed = await processPdfForKnowledgeBase(buffer, filename);
      await insertProcessedPdf(processed);

      rows.push({
        filename: processed.filename,
        grade: processed.grade,
        subject: processed.subject,
        chapter: processed.chapter,
        needsManual: processed.needsManualEntry,
        status: "imported",
      });
    } catch (error) {
      rows.push({
        filename,
        grade: "",
        subject: "",
        chapter: "",
        needsManual: true,
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  printSummaryTable(rows);
}

main().catch((error) => {
  console.error("[bulk-import] Fatal error:", error);
  process.exit(1);
});
