"use client";

import { useActionState, useState } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { recordProgressAction } from "@/app/books/actions";
import { checkProgress, formatProgress } from "@/lib/progress";
import type { ProgressUnit } from "@/lib/reading-status";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100";

export function ProgressForm({
  readingId,
  unit,
  current,
  target,
}: {
  readingId: string;
  unit: ProgressUnit;
  current: number;
  target: number | null;
}) {
  const [state, formAction, pending] = useActionState(recordProgressAction, ACTION_IDLE);
  const [value, setValue] = useState("");

  // 서버가 최종 판정하지만, 되돌아가는 입력은 누르기 전에 알려준다.
  const local =
    value === "" ? null : checkProgress({ value: Number(value), current, target, unit });
  const backward = local?.ok === true && local.backward;

  return (
    <form
      action={formAction}
      className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
    >
      <input type="hidden" name="reading_id" value={readingId} />

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label
            htmlFor={`value-${readingId}`}
            className="block text-xs text-zinc-500 dark:text-zinc-400"
          >
            {unit === "page" ? "현재 쪽" : "진행률 (%)"}
          </label>
          <input
            id={`value-${readingId}`}
            name="value"
            type="number"
            min={0}
            max={target ?? undefined}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={String(current)}
            className={`mt-1 w-28 ${inputClass}`}
          />
        </div>

        <div>
          <label
            htmlFor={`minutes-${readingId}`}
            className="block text-xs text-zinc-500 dark:text-zinc-400"
          >
            읽은 시간 (분)
          </label>
          <input
            id={`minutes-${readingId}`}
            name="minutes"
            type="number"
            min={1}
            max={1440}
            className={`mt-1 w-28 ${inputClass}`}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-50 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {pending ? "기록 중..." : "기록"}
        </button>
      </div>

      <input name="memo" placeholder="한 줄 메모 (선택)" className={`w-full ${inputClass}`} />

      {backward && (
        <p className="text-xs text-amber-700 dark:text-amber-500">
          현재 {formatProgress(current, unit, target)}보다 뒤로 갑니다. 고치는 것이 맞다면 그대로
          기록하세요.
        </p>
      )}

      {local?.ok === false && (
        <p className="text-xs text-red-600 dark:text-red-400">{local.message}</p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
