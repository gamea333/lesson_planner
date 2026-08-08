"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ChapterOption {
  id: number;
  grade: string;
  subject: string;
  chapter: string;
  metadataComplete?: boolean;
}

/**
 * Chapter picker for Create / Practice / Homework.
 * Chapters from the knowledge base are always listed (even without Grade/Subject).
 * Grade/Subject act as optional filters, not gates.
 */
export function useChapterFilters() {
  const [grades, setGrades] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [allChapters, setAllChapters] = useState<ChapterOption[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [incompleteCount, setIncompleteCount] = useState(0);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(
    null
  );
  const skipCascadeRef = useRef(false);

  const loadCatalog = useCallback(async () => {
    const res = await fetch("/api/knowledge-base?filters=true");
    const data = await res.json();
    setGrades(data.grades ?? []);
    setSubjects(data.subjects ?? []);
    setAllChapters(data.chapters ?? []);
    setTotalEntries(Number(data.totalEntries) || 0);
    setIncompleteCount(Number(data.incompleteCount) || 0);
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  /** Subjects available for the selected grade (or all if no grade). */
  const subjectsForGrade = useMemo(() => {
    const set = new Set<string>();
    for (const c of allChapters) {
      if (!selectedGrade || c.grade === selectedGrade) set.add(c.subject);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allChapters, selectedGrade]);

  /** Chapters visible given optional grade/subject filters. */
  const chapters = useMemo(() => {
    return allChapters.filter((c) => {
      if (selectedGrade && c.grade !== selectedGrade) return false;
      if (selectedSubject && c.subject !== selectedSubject) return false;
      return true;
    });
  }, [allChapters, selectedGrade, selectedSubject]);

  useEffect(() => {
    if (skipCascadeRef.current) return;
    if (selectedSubject && !subjectsForGrade.includes(selectedSubject)) {
      setSelectedSubject("");
    }
  }, [selectedGrade, subjectsForGrade, selectedSubject]);

  useEffect(() => {
    if (skipCascadeRef.current) return;
    if (
      selectedChapterId != null &&
      !chapters.some((c) => c.id === selectedChapterId)
    ) {
      setSelectedChapterId(null);
    }
  }, [chapters, selectedChapterId]);

  const selectChapter = useCallback(
    (id: number | null) => {
      setSelectedChapterId(id);
      if (id == null) return;
      const match = allChapters.find((c) => c.id === id);
      if (!match) return;
      // Fill grade/subject from the chapter so filters stay consistent
      skipCascadeRef.current = true;
      setSelectedGrade(match.grade);
      setSelectedSubject(match.subject);
      setTimeout(() => {
        skipCascadeRef.current = false;
      }, 0);
    },
    [allChapters]
  );

  const hydrateSelection = useCallback(
    async (grade: string, subject: string, chapterId: number) => {
      skipCascadeRef.current = true;
      try {
        if (allChapters.length === 0) await loadCatalog();
        setSelectedGrade(grade || "Unspecified");
        setSelectedSubject(subject || "Unspecified");
        setSelectedChapterId(chapterId);
      } finally {
        setTimeout(() => {
          skipCascadeRef.current = false;
        }, 0);
      }
    },
    [allChapters.length, loadCatalog]
  );

  const selectedChapter =
    allChapters.find((c) => c.id === selectedChapterId) ??
    chapters.find((c) => c.id === selectedChapterId);

  return {
    grades,
    subjects: selectedGrade ? subjectsForGrade : subjects,
    chapters,
    allChapters,
    totalEntries,
    incompleteCount,
    selectedGrade,
    setSelectedGrade: (g: string) => {
      setSelectedGrade(g);
      setSelectedSubject("");
      // Keep chapter if it still matches; clearing subject may widen list
    },
    selectedSubject,
    setSelectedSubject,
    selectedChapterId,
    setSelectedChapterId: selectChapter,
    selectedChapter,
    hydrateSelection,
    reload: loadCatalog,
    isEmpty: totalEntries === 0,
    needsMetadata: incompleteCount > 0,
  };
}
