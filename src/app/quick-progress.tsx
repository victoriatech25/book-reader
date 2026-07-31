"use client";

import { useActionState, useOptimistic } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { recordProgressAction } from "@/app/books/actions";
import { buttonSecondary, errorText, input } from "@/components/ui/styles";
import { formatProgress, progressPercent } from "@/lib/progress";
import type { ProgressUnit } from "@/lib/reading-status";

/**
 * 대시보드의 빠른 기록.
 *
 * 페이지 이동 없이 숫자 하나로 진행을 남긴다. 서버 응답을 기다리는 동안
 * 진행률 바를 먼저 옮겨(useOptimistic) 입력이 먹혔다는 걸 즉시 보여준다.
 * 실패하면 값이 원래대로 돌아가고 사유가 뜬다.
 */
export function QuickProgress({
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
  const [optimisticValue, setOptimisticValue] = useOptimistic(current);

  const [state, formAction, pending] = useActionState(
    async (prev: typeof ACTION_IDLE, formData: FormData) => {
      const next = Number(String(formData.get("value") ?? "").trim());
      if (Number.isInteger(next)) setOptimisticValue(next);
      return recordProgressAction(prev, formData);
    },
    ACTION_IDLE,
  );

  const percent = progressPercent(optimisticValue, target);

  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground font-mono text-xs">
          {formatProgress(optimisticValue, unit, target)}
        </span>
        <span className="text-muted-foreground font-mono text-xs">{percent}%</span>
      </div>

      <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <form action={formAction} className="mt-2 flex items-center gap-2">
        <input type="hidden" name="reading_id" value={readingId} />
        <input
          name="value"
          type="number"
          min={0}
          max={target ?? undefined}
          aria-label={unit === "page" ? "현재 쪽" : "진행률 (%)"}
          placeholder={unit === "page" ? "현재 쪽" : "%"}
          className={`w-24 ${input}`}
        />
        <input
          name="minutes"
          type="number"
          min={1}
          max={1440}
          aria-label="읽은 시간 (분)"
          placeholder="분"
          className={`w-20 ${input}`}
        />
        <button type="submit" disabled={pending} className={buttonSecondary}>
          기록
        </button>
      </form>

      {state.error && (
        <p role="alert" className={`mt-1.5 ${errorText}`}>
          {state.error}
        </p>
      )}
    </div>
  );
}
