export interface TeacherReview {
  id: string;
  reviewerName: string;
  /** 1–5 star rating */
  rating: number;
  strengths: string;
  improvements: string;
  comments: string;
  createdAt: string;
}

export function createTeacherReview(input: {
  reviewerName: string;
  rating: number;
  strengths: string;
  improvements: string;
  comments: string;
}): TeacherReview {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `review-${Date.now()}`,
    reviewerName: input.reviewerName.trim() || "Teacher",
    rating: Math.min(5, Math.max(1, Math.round(input.rating) || 3)),
    strengths: input.strengths.trim(),
    improvements: input.improvements.trim(),
    comments: input.comments.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function averageTeacherRating(reviews: TeacherReview[]): number | null {
  if (!reviews.length) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}
