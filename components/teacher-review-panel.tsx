"use client";

import { MessageSquarePlus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
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
import {
  averageTeacherRating,
  createTeacherReview,
  type TeacherReview,
} from "@/lib/types/teacher-review";
import { cn } from "@/lib/utils";

interface TeacherReviewPanelProps {
  title?: string;
  reviews: TeacherReview[];
  onChange: (reviews: TeacherReview[]) => void;
}

function Stars({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: "sm" | "md";
}) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cn(
            "rounded p-0.5 transition-colors",
            onChange ? "hover:text-amber-500" : "cursor-default",
            n <= value ? "text-amber-500" : "text-slate-300"
          )}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Star className={cn(iconClass, n <= value && "fill-current")} />
        </button>
      ))}
    </div>
  );
}

export function TeacherReviewPanel({
  title = "Teacher review",
  reviews,
  onChange,
}: TeacherReviewPanelProps) {
  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState(4);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comments, setComments] = useState("");
  const [showForm, setShowForm] = useState(reviews.length === 0);

  const avg = averageTeacherRating(reviews);

  function handleAdd() {
    if (!comments.trim() && !strengths.trim() && !improvements.trim()) {
      toast.error("Add at least one comment, strength, or improvement");
      return;
    }

    const review = createTeacherReview({
      reviewerName,
      rating,
      strengths,
      improvements,
      comments,
    });
    onChange([review, ...reviews]);
    setReviewerName("");
    setRating(4);
    setStrengths("");
    setImprovements("");
    setComments("");
    setShowForm(false);
    toast.success("Review saved");
  }

  function handleDelete(id: string) {
    onChange(reviews.filter((r) => r.id !== id));
    toast.success("Review removed");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          <CardDescription className="mt-1">
            Rate this generated material and note what works or needs changes.
            {avg != null && (
              <span className="ml-1 font-medium text-foreground">
                Average {avg}/5 · {reviews.length} review
                {reviews.length === 1 ? "" : "s"}
              </span>
            )}
          </CardDescription>
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            Add review
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="space-y-3 rounded-xl border border-border bg-slate-50/80 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="reviewer-name">Your name</Label>
                <Input
                  id="reviewer-name"
                  placeholder="e.g. Ms. Sharma"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rating</Label>
                <Stars value={rating} onChange={setRating} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-strengths">Strengths</Label>
              <textarea
                id="review-strengths"
                rows={2}
                placeholder="What worked well in this plan/practice sheet?"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-improvements">Improvements</Label>
              <textarea
                id="review-improvements"
                rows={2}
                placeholder="What should be revised next time?"
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-comments">Additional comments</Label>
              <textarea
                id="review-comments"
                rows={3}
                placeholder="Overall notes for this generation…"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleAdd}>Save review</Button>
              {reviews.length > 0 && (
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {reviews.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground">
            No reviews yet. Add feedback after checking the generated content.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-xl border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {review.reviewerName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars value={review.rating} size="sm" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(review.id)}
                      aria-label="Delete review"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                {review.strengths && (
                  <p className="mt-3 text-sm">
                    <span className="font-medium text-emerald-700">Strengths: </span>
                    {review.strengths}
                  </p>
                )}
                {review.improvements && (
                  <p className="mt-1.5 text-sm">
                    <span className="font-medium text-amber-700">Improvements: </span>
                    {review.improvements}
                  </p>
                )}
                {review.comments && (
                  <p className="mt-1.5 text-sm text-slate-700">{review.comments}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
