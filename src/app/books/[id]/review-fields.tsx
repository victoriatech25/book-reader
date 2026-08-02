"use client";

import { useState } from "react";

import { Select } from "@/components/ui/select";
import { checkbox, input, label as labelClass } from "@/components/ui/styles";
import { RATING_OPTIONS, REVIEW_MAX_LENGTH } from "@/lib/reviews";

const inputClass = `w-full ${input}`;

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
        <label htmlFor={`${idPrefix}-rating`} className={labelClass}>
          별점
        </label>
        <Select
          id={`${idPrefix}-rating`}
          name="rating"
          defaultValue={defaultRating === null ? "" : String(defaultRating)}
          className="mt-1.5 w-full"
        >
          <option value="">매기지 않음</option>
          {RATING_OPTIONS.map((value) => (
            <option key={value} value={value}>
              ★ {value.toFixed(1)}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-review`} className={labelClass}>
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
          className={`mt-1.5 ${inputClass} font-serif`}
        />
        <p className="text-muted-foreground mt-1 text-right font-mono text-xs">
          {review.length} / {REVIEW_MAX_LENGTH}
        </p>
      </div>

      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="spoiler"
          defaultChecked={defaultSpoiler}
          className={checkbox}
        />
        스포일러 포함
      </label>
    </div>
  );
}
