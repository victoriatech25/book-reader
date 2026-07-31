"use client";

import { useActionState, useRef } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { finishReadingAction, updateReviewAction } from "@/app/books/actions";
import { buttonPrimary, buttonSecondary, errorText } from "@/components/ui/styles";

import { ReviewFields } from "./review-fields";

const secondaryButton = buttonSecondary;
const primaryButton = buttonPrimary;
const dialogClass =
  "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-5 text-card-foreground backdrop:bg-black/40";

/**
 * 완독 처리와 소감 작성을 한 화면에서 끝낸다 (PRD §3.1 F5).
 * 두 단계로 나누면 소감을 건너뛰게 된다.
 */
export function FinishDialog({ readingId }: { readingId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(finishReadingAction, ACTION_IDLE);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={secondaryButton}
      >
        완독
      </button>

      <dialog ref={dialogRef} className={dialogClass} aria-label="완독 기록">
        <form action={formAction} className="space-y-4">
          <h3 className="text-base font-semibold">완독 기록</h3>
          <input type="hidden" name="reading_id" value={readingId} />

          <ReviewFields idPrefix={`finish-${readingId}`} />

          {state.error && (
            <p role="alert" className={errorText}>
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className={primaryButton}>
              {pending ? "저장 중..." : "완독으로 저장"}
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={secondaryButton}
            >
              취소
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** 완독한 뒤 별점·소감만 고친다. 상태는 건드리지 않는다. */
export function ReviewEditor({
  readingId,
  bookId,
  rating,
  review,
  spoiler,
}: {
  readingId: string;
  bookId: string;
  rating: number | null;
  review: string | null;
  spoiler: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateReviewAction, ACTION_IDLE);

  return (
    <details className="mt-3">
      <summary className="text-muted-foreground cursor-pointer text-xs">
        별점·소감 {review || rating !== null ? "고치기" : "남기기"}
      </summary>

      <form action={formAction} className="mt-3 space-y-4">
        <input type="hidden" name="reading_id" value={readingId} />
        <input type="hidden" name="book_id" value={bookId} />

        <ReviewFields
          idPrefix={`review-${readingId}`}
          defaultRating={rating}
          defaultReview={review ?? ""}
          defaultSpoiler={spoiler}
        />

        {state.error && (
          <p role="alert" className={errorText}>
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "저장 중..." : "소감 저장"}
        </button>
      </form>
    </details>
  );
}
