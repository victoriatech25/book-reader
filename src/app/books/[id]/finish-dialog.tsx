"use client";

import { useActionState, useRef } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { finishReadingAction, updateReviewAction } from "@/app/books/actions";

import { ReviewFields } from "./review-fields";

const secondaryButton =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800";
const primaryButton =
  "rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-50 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900";
const dialogClass =
  "w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white p-5 text-zinc-900 backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50";

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
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
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
      <summary className="cursor-pointer text-xs text-zinc-500 dark:text-zinc-400">
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
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
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
