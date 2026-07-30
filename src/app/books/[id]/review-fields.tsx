"use client";

import { useState } from "react";

import { RATING_OPTIONS, REVIEW_MAX_LENGTH } from "@/lib/reviews";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100";

/** 별점 + 한 줄 소감. 완독 모달과 소감 수정 폼이 같은 필드를 쓴다. */
export function ReviewFields({
  idPrefix,
  defaultRating = null,
  defaultReview = "",
  defaultSpoiler = false,
}: {
  idPrefix: string;
  defaultRating?: number | null;
  defaultReview?: string;
  defaultSpoiler?: boolean;
}) {
  const [review, setReview] = useState(defaultReview);

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`${idPrefix}-rating`}
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          별점
        </label>
        <select
          id={`${idPrefix}-rating`}
          name="rating"
          defaultValue={defaultRating === null ? "" : String(defaultRating)}
          className={`mt-1.5 ${inputClass}`}
        >
          <option value="">매기지 않음</option>
          {RATING_OPTIONS.map((value) => (
            <option key={value} value={value}>
              ★ {value.toFixed(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-review`}
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          한 줄 소감
        </label>
        <textarea
          id={`${idPrefix}-review`}
          name="review"
          rows={3}
          maxLength={REVIEW_MAX_LENGTH}
          value={review}
          onChange={(event) => setReview(event.target.value)}
          placeholder="기억하고 싶은 한 문장이면 충분합니다."
          className={`mt-1.5 ${inputClass}`}
        />
        <p className="mt-1 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {review.length} / {REVIEW_MAX_LENGTH}
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" name="spoiler" defaultChecked={defaultSpoiler} />
        스포일러 포함
      </label>
    </div>
  );
}
