import {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
} from "@napi-rs/canvas";
import pdfParse from "pdf-parse";
import { createWorker } from "tesseract.js";

export type PdfExtractionMethod = "text" | "ocr" | "hybrid";

export interface PdfTextExtractionResult {
  text: string;
  method: PdfExtractionMethod;
  pageCount: number;
  ocrPages: number;
}

const MIN_MEANINGFUL_CHARS = 80;
const MAX_OCR_PAGES = 20;
const OCR_RENDER_SCALE = 1.75;
/** Below this many chars/page, embedded text is treated as too thin (scan with junk text layer). */
const MIN_CHARS_PER_PAGE = 400;

/** True when pdf-parse text is empty, thin, or low-quality (common for scans / bad phone OCR). */
export function isExtractedTextInsufficient(
  text: string,
  pageCount = 1
): boolean {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < MIN_MEANINGFUL_CHARS) return true;

  const alnum = (cleaned.match(/[a-zA-Z0-9]/g) ?? []).length;
  if (alnum < MIN_MEANINGFUL_CHARS) return true;
  if (alnum / cleaned.length < 0.35) return true;

  const pages = Math.max(1, pageCount);
  if (cleaned.length / pages < MIN_CHARS_PER_PAGE) return true;

  // Lots of broken tokens → likely garbage text layer from a scanner app
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 25) {
    const suspicious = words.filter((w) => {
      if (w.length <= 2) return true;
      if (!/[aeiouyAEIOUY]/.test(w) && /[a-zA-Z]{4,}/.test(w)) return true;
      if (/[A-Z]{3,}.*[a-z].*[A-Z]/.test(w)) return true; // CaPiTaL noise
      return false;
    });
    if (suspicious.length / words.length > 0.5) return true;
  }

  return false;
}

function polyfillDomApisForPdfJs(): void {
  const g = globalThis as Record<string, unknown>;
  // pdf.js Path2D must be the same class @napi-rs/canvas expects
  g.Path2D = Path2D;
  g.DOMMatrix = DOMMatrix;
  g.ImageData = ImageData;
}

async function extractEmbeddedText(
  buffer: Buffer
): Promise<{ text: string; pageCount: number }> {
  const parsed = await pdfParse(buffer);
  return {
    text: parsed.text?.trim() ?? "",
    pageCount: parsed.numpages || 0,
  };
}

async function resolvePdfWorkerSrc(): Promise<string> {
  const fs = await import("fs");
  const path = await import("path");
  const { pathToFileURL } = await import("url");

  const candidates = [
    path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs"
    ),
    path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "build",
      "pdf.worker.mjs"
    ),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  throw new Error(
    "pdf.js worker not found under node_modules/pdfjs-dist. Reinstall dependencies."
  );
}

async function renderPdfPagesToPng(
  buffer: Buffer,
  maxPages: number
): Promise<{ images: Buffer[]; pageCount: number }> {
  polyfillDomApisForPdfJs();

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = await resolvePdfWorkerSrc();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const pagesToOcr = Math.min(pageCount, maxPages);
  const images: Buffer[] = [];

  for (let pageNum = 1; pageNum <= pagesToOcr; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    } as never).promise;

    images.push(canvas.toBuffer("image/png"));
  }

  return { images, pageCount };
}

async function ocrPngBuffers(images: Buffer[]): Promise<string> {
  if (!images.length) return "";

  const worker = await createWorker("eng");
  try {
    const parts: string[] = [];
    for (let i = 0; i < images.length; i++) {
      console.log(`[OCR] Recognizing page ${i + 1}/${images.length}…`);
      const {
        data: { text },
      } = await worker.recognize(images[i]);
      const trimmed = text?.trim() ?? "";
      if (trimmed) {
        parts.push(`--- Page ${i + 1} ---\n${trimmed}`);
      }
    }
    return parts.join("\n\n").trim();
  } finally {
    await worker.terminate();
  }
}

/**
 * Extract text from a PDF. Uses embedded text first; falls back to OCR
 * for scanned / image-only PDFs (and hybrid when embedded text is weak).
 */
export async function extractPdfText(
  buffer: Buffer,
  options?: { forceOcr?: boolean; maxOcrPages?: number }
): Promise<PdfTextExtractionResult> {
  const maxOcrPages = options?.maxOcrPages ?? MAX_OCR_PAGES;
  let embedded = "";
  let pageCount = 0;

  try {
    const result = await extractEmbeddedText(buffer);
    embedded = result.text;
    pageCount = result.pageCount;
  } catch (error) {
    console.warn(
      "[OCR] pdf-parse failed; will attempt OCR:",
      error instanceof Error ? error.message : error
    );
  }

  const needsOcr =
    options?.forceOcr || isExtractedTextInsufficient(embedded, pageCount);

  if (!needsOcr) {
    return {
      text: embedded,
      method: "text",
      pageCount,
      ocrPages: 0,
    };
  }

  console.log(
    `[OCR] ${options?.forceOcr ? "Forced OCR" : `Embedded text insufficient (${embedded.length} chars / ${pageCount || "?"} pages)`} — running Tesseract (max ${maxOcrPages} pages)`
  );

  const { images, pageCount: renderedPages } = await renderPdfPagesToPng(
    buffer,
    maxOcrPages
  );
  pageCount = pageCount || renderedPages;

  const ocrText = await ocrPngBuffers(images);

  if (!ocrText && !embedded) {
    throw new Error(
      "PDF contains no extractable text, and OCR could not read any pages. Try a clearer scan or a text-based PDF."
    );
  }

  if (
    ocrText.length > embedded.length * 1.2 ||
    isExtractedTextInsufficient(embedded, pageCount) ||
    options?.forceOcr
  ) {
    const method: PdfExtractionMethod =
      embedded &&
      !options?.forceOcr &&
      !isExtractedTextInsufficient(embedded, pageCount)
        ? "hybrid"
        : "ocr";
    const text =
      method === "hybrid"
        ? `${embedded}\n\n--- OCR supplement ---\n\n${ocrText}`.trim()
        : ocrText || embedded;

    return {
      text,
      method: ocrText ? method : embedded ? "text" : "ocr",
      pageCount,
      ocrPages: images.length,
    };
  }

  return {
    text: embedded || ocrText,
    method: ocrText ? "hybrid" : "text",
    pageCount,
    ocrPages: images.length,
  };
}
