"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ChapterOption {
  id: number;
  grade: string;
  subject: string;
  chapter: string;
}

export function useChapterFilters() {
  const [grades, setGrades] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const skipCascadeRef = useRef(false);

  const loadFilters = useCallback(async (grade?: string, subject?: string) => {
    const params = new URLSearchParams({ filters: "true" });
    if (grade) params.set("grade", grade);
    if (subject) params.set("subject", subject);

    const res = await fetch(`/api/knowledge-base?${params}`);
    const data = await res.json();
    setGrades(data.grades ?? []);
    setSubjects(data.subjects ?? []);
    setChapters(data.chapters ?? []);
  }, []);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    if (!selectedGrade) return;
    if (skipCascadeRef.current) return;
    loadFilters(selectedGrade);
    setSelectedSubject("");
    setSelectedChapterId(null);
  }, [selectedGrade, loadFilters]);

  useEffect(() => {
    if (!selectedGrade || !selectedSubject) return;
    if (skipCascadeRef.current) return;
    loadFilters(selectedGrade, selectedSubject);
    setSelectedChapterId(null);
  }, [selectedGrade, selectedSubject, loadFilters]);

  /** Set grade/subject/chapter together without cascade clears (e.g. from lesson plan). */
  const hydrateSelection = useCallback(
    async (grade: string, subject: string, chapterId: number) => {
      skipCascadeRef.current = true;
      try {
        await loadFilters(grade || undefined, subject || undefined);
        setSelectedGrade(grade);
        setSelectedSubject(subject);
        setSelectedChapterId(chapterId);
      } finally {
        // Keep cascade suppressed until after React applies state + effects
        setTimeout(() => {
          skipCascadeRef.current = false;
        }, 0);
      }
    },
    [loadFilters]
  );

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);

  return {
    grades,
    subjects,
    chapters,
    selectedGrade,
    setSelectedGrade,
    selectedSubject,
    setSelectedSubject,
    selectedChapterId,
    setSelectedChapterId,
    selectedChapter,
    hydrateSelection,
    isEmpty: grades.length === 0,
  };
}
