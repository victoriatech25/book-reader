"use client";

import { useActionState } from "react";

import { buttonSecondary, errorText, input } from "@/components/ui/styles";
import { nextStatuses, transitionLabel, type ReadingStatus } from "@/lib/reading-status";

import { ACTION_IDLE } from "@/app/books/action-state";
import { changeStatusAction, startNewAttemptAction } from "@/app/books/actions";

const buttonClass = buttonSecondary;

export function ReadingActions({
  readingId,
  status,
}: {
  readingId: string;
  status: ReadingStatus;
}) {
  const [state, formAction, pending] = useActionState(changeStatusAction, ACTION_IDLE);

  // 완독은 별점·소감을 함께 받아야 해서 별도 모달(FinishDialog)이 처리한다.
  const targets = nextStatuses(status).filter((to) => to !== "finished");

  if (targets.length === 0) return null;

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="reading_id" value={readingId} />

      {targets.includes("dropped") && (
        <input name="drop_reason" placeholder="중단 사유 (선택)" className={`w-full ${input}`} />
      )}

      <div className="flex flex-wrap gap-2">
        {targets.map((to) => (
          <button
            key={to}
            type="submit"
            name="to"
            value={to}
            disabled={pending}
            className={buttonClass}
          >
            {transitionLabel(status, to)}
          </button>
        ))}
      </div>

      {state.error && (
        <p role="alert" className={errorText}>
          {state.error}
        </p>
      )}
    </form>
  );
}

/** 완독·중단된 책을 다시 읽기 시작한다. 기존 기록은 그대로 두고 회차를 늘린다. */
export function NewAttemptButton({ bookId }: { bookId: string }) {
  const [state, formAction, pending] = useActionState(startNewAttemptAction, ACTION_IDLE);

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="book_id" value={bookId} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "추가 중..." : "다시 읽기 (새 회차)"}
      </button>
      {state.error && (
        <p role="alert" className={`mt-2 ${errorText}`}>
          {state.error}
        </p>
      )}
    </form>
  );
}
