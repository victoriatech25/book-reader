"use client";

import { useActionState } from "react";

import { nextStatuses, transitionLabel, type ReadingStatus } from "@/lib/reading-status";

import { ACTION_IDLE } from "@/app/books/action-state";
import { changeStatusAction, startNewAttemptAction } from "@/app/books/actions";

const buttonClass =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800";

export function ReadingActions({
  readingId,
  status,
}: {
  readingId: string;
  status: ReadingStatus;
}) {
  const [state, formAction, pending] = useActionState(changeStatusAction, ACTION_IDLE);
  const targets = nextStatuses(status);

  if (targets.length === 0) return null;

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="reading_id" value={readingId} />

      {targets.includes("dropped") && (
        <input
          name="drop_reason"
          placeholder="중단 사유 (선택)"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
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
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
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
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
