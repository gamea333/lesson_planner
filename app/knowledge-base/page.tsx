"use client";

import { Database, Loader2, Search, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readResponseJson } from "@/lib/http";
import { cn } from "@/lib/utils";

interface KbListItem {
  id: number;
  grade: string;
  subject: string;
  chapter: string;
  filename: string;
  updated_at: string;
  metadataComplete?: boolean;
  sectionLabels?: string[];
}

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KbListItem[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [search, setSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [forceOcr, setForceOcr] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ grade: "", subject: "", chapter: "" });
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [previewMeta, setPreviewMeta] = useState("");

  const loadEntries = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterGrade) params.set("grade", filterGrade);
    if (filterSubject) params.set("subject", filterSubject);
    if (search) params.set("search", search);

    const res = await fetch(`/api/knowledge-base?${params}`);
    const data = await readResponseJson<{ entries?: KbListItem[]; error?: string }>(
      res
    );
    if (!res.ok) throw new Error(data.error || "Failed to load entries");
    setEntries(data.entries ?? []);

    const filterRes = await fetch("/api/knowledge-base?filters=true");
    const filterData = await readResponseJson<{ grades?: string[]; error?: string }>(
      filterRes
    );
    setGrades(filterData.grades ?? []);
  }, [filterGrade, filterSubject, search]);

  useEffect(() => {
    loadEntries().catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load knowledge base");
    });
  }, [loadEntries]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setIsUploading(true);

      try {
        const formData = new FormData();
        acceptedFiles.forEach((file) => formData.append("files", file));
        if (forceOcr) formData.append("forceOcr", "true");

        const res = await fetch("/api/knowledge-base", {
          method: "POST",
          body: formData,
        });

        const data = await readResponseJson<{
          results?: Array<{
            success?: boolean;
            error?: string;
            filename?: string;
            needsManualEntry?: boolean;
            extractionMethod?: string;
            ocrPages?: number;
            charCount?: number;
          }>;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error || "Upload failed");

        const successes = (data.results ?? []).filter((r) => r.success);
        const failures = (data.results ?? []).filter((r) => r.error);

        if (successes.length) {
          const needsReview = successes.filter((r) => r.needsManualEntry);
          toast.success(`Uploaded ${successes.length} chapter PDF(s)`);
          for (const r of successes) {
            const method = r.extractionMethod ?? "text";
            toast.message(
              `${r.filename}: extracted via ${method}` +
                (r.ocrPages ? ` (${r.ocrPages} OCR pages)` : "") +
                (r.charCount != null ? ` · ${r.charCount} chars` : "")
            );
          }
          if (needsReview.length) {
            toast.warning(
              `${needsReview.length} file(s) need manual Grade/Subject/Chapter — edit in the list below.`
            );
          }
        }
        failures.forEach((f) => {
          toast.error(`${f.filename}: ${f.error}`);
        });

        await loadEntries();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [loadEntries, forceOcr]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    disabled: isUploading,
  });

  async function handleDelete(id: number) {
    if (!confirm("Delete this chapter from the knowledge base?")) return;

    const res = await fetch(`/api/knowledge-base?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Chapter deleted");
    loadEntries();
  }

  async function handleReupload(id: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    if (forceOcr) formData.append("forceOcr", "true");
    toast.message(
      forceOcr
        ? "Re-uploading with forced OCR (12 pages can take several minutes)…"
        : "Re-uploading… scanned PDFs may use OCR and take longer."
    );

    const res = await fetch(`/api/knowledge-base/${id}`, {
      method: "PUT",
      body: formData,
    });

    try {
      const data = await readResponseJson<{
        error?: string;
        extractionMethod?: string;
        ocrPages?: number;
        charCount?: number;
      }>(res);
      if (!res.ok) {
        toast.error(data.error || "Re-upload failed");
        return;
      }
      toast.success(
        `Re-uploaded via ${data.extractionMethod ?? "text"}` +
          (data.ocrPages ? ` (${data.ocrPages} OCR pages)` : "") +
          (data.charCount != null ? ` · ${data.charCount} chars` : "")
      );
      loadEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-upload failed");
    }
  }

  async function viewExtractedText(id: number) {
    const res = await fetch(`/api/knowledge-base/${id}`);
    try {
      const data = await readResponseJson<{
        error?: string;
        chapter?: string;
        filename?: string;
        charCount?: number;
        textPreview?: string;
      }>(res);
      if (!res.ok) {
        toast.error(data.error || "Could not load extracted text");
        return;
      }
      setPreviewId(id);
      setPreviewMeta(
        `${data.chapter || data.filename} · ${data.charCount ?? 0} characters stored`
      );
      setPreviewText(data.textPreview || "(empty)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load extracted text");
    }
  }

  async function saveMetadata(id: number) {
    const res = await fetch("/api/knowledge-base", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...editForm }),
    });

    if (!res.ok) {
      toast.error("Failed to update metadata");
      return;
    }
    toast.success("Metadata updated");
    setEditingId(null);
    loadEntries();
  }

  const subjects = Array.from(
    new Set(entries.map((e) => e.subject).filter(Boolean))
  ).sort();

  return (
    <main className="flex-1 bg-gradient-to-b from-white to-slate-50/80">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Database className="h-4 w-4" />
            Knowledge Base
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Chapter lesson plan library</h1>
          <p className="mt-2 text-muted-foreground">
            Bulk-upload lesson plan PDFs (one per chapter). Text and scanned PDFs are supported
            — OCR runs automatically when a file has little or no embedded text.
          </p>
        </header>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Bulk upload PDFs</CardTitle>
            <CardDescription>
              Drop multiple chapter lesson plan PDFs (text or scanned). Scanned/image-only
              PDFs are read with OCR automatically. Grade, Subject, and Chapter are inferred
              from filenames and headers — you can edit them in the list below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-2 rounded-xl border border-border bg-slate-50/80 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={forceOcr}
                onChange={(e) => setForceOcr(e.target.checked)}
                disabled={isUploading}
              />
              <span>
                <span className="font-medium">Force OCR on upload</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Use for handwritten / scanned notes. Reads up to 20 pages with Tesseract
                  (slow). Check the terminal for{" "}
                  <code className="rounded bg-muted px-1">via ocr</code> and page logs.
                </span>
              </span>
            </label>
            <div
              {...getRootProps()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors",
                isDragActive
                  ? "border-primary bg-accent/60"
                  : "border-border hover:border-primary/50 hover:bg-accent/30",
                isUploading && "pointer-events-none opacity-60"
              )}
            >
              <input {...getInputProps()} />
              {isUploading ? (
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
              ) : (
                <Upload className="mb-3 h-8 w-8 text-primary" />
              )}
              <p className="text-sm font-medium">
                {isUploading
                  ? "Parsing PDFs (OCR runs automatically for scanned files)…"
                  : isDragActive
                    ? "Drop PDFs here"
                    : "Drag & drop chapter PDFs, or click to browse"}
              </p>
              {!isUploading && (
                <p className="mt-2 max-w-md text-center text-xs text-muted-foreground">
                  Text-based PDFs parse instantly. Scanned PDFs use on-device OCR and may take
                  longer.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stored chapters</CardTitle>
            <CardDescription>
              Search and filter your knowledge base. Delete or re-upload as needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative sm:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search chapters…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">All grades</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No chapters in the knowledge base yet. Upload PDFs above.
              </p>
            ) : (
              <div className="divide-y rounded-xl border">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    {editingId === entry.id ? (
                      <div className="grid flex-1 gap-2 sm:grid-cols-3">
                        <Input
                          value={editForm.grade}
                          onChange={(e) => setEditForm((f) => ({ ...f, grade: e.target.value }))}
                          placeholder="Grade"
                        />
                        <Input
                          value={editForm.subject}
                          onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))}
                          placeholder="Subject"
                        />
                        <Input
                          value={editForm.chapter}
                          onChange={(e) => setEditForm((f) => ({ ...f, chapter: e.target.value }))}
                          placeholder="Chapter"
                        />
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {entry.grade || "—"} · {entry.subject || "—"} · {entry.chapter || "—"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.filename} · updated {new Date(entry.updated_at).toLocaleDateString()}
                        </p>
                        {!entry.metadataComplete && (
                          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Needs metadata — edit Grade, Subject, Chapter
                          </span>
                        )}
                        {entry.sectionLabels && entry.sectionLabels.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sections: {entry.sectionLabels.slice(0, 4).join(", ")}
                            {entry.sectionLabels.length > 4 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {editingId === entry.id ? (
                        <>
                          <Button size="sm" onClick={() => saveMetadata(entry.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewExtractedText(entry.id)}
                          >
                            View text
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(entry.id);
                              setEditForm({
                                grade: entry.grade,
                                subject: entry.subject,
                                chapter: entry.chapter,
                              });
                            }}
                          >
                            Edit
                          </Button>
                          <Label className="cursor-pointer">
                            <Button size="sm" variant="outline" asChild>
                              <span>Re-upload</span>
                            </Button>
                            <input
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleReupload(entry.id, file);
                              }}
                            />
                          </Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(entry.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {previewId != null && (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Extracted text preview</CardTitle>
                <CardDescription>{previewMeta}</CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setPreviewId(null)}>
                Close
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-xs leading-relaxed text-slate-800">
                {previewText}
              </pre>
              <p className="mt-3 text-xs text-muted-foreground">
                If this looks like gibberish or is very short for a multi-page scan, check{" "}
                <strong>Force OCR</strong> and re-upload. Watch the terminal for{" "}
                <code className="rounded bg-muted px-1">via ocr</code> and{" "}
                <code className="rounded bg-muted px-1">[OCR] Recognizing page…</code>.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
