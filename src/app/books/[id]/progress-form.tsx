"use client";

import { useActionState, useState } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { recordProgressAction } from "@/app/books/actions";
import { buttonPrimary, errorText, input } from "@/components/ui/styles";
import { checkProgress, formatProgress } from "@/lib/progress";
import type { ProgressUnit } from "@/lib/reading-status";

const inputClass = input;

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
    <form action={formAction} className="border-border mt-4 space-y-2 border-t pt-4">
      <input type="hidden" name="reading_id" value={readingId} />

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`value-${readingId}`} className="text-muted-foreground block text-xs">
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
          <label htmlFor={`minutes-${readingId}`} className="text-muted-foreground block text-xs">
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

        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "기록 중..." : "기록"}
        </button>
      </div>

      <input name="memo" placeholder="한 줄 메모 (선택)" className={`w-full ${inputClass}`} />

      {backward && (
        <p className="text-chart-1 text-xs">
          현재 {formatProgress(current, unit, target)}보다 뒤로 갑니다. 고치는 것이 맞다면 그대로
          기록하세요.
        </p>
      )}

      {local?.ok === false && <p className="text-destructive text-xs">{local.message}</p>}

      {state.error && (
        <p role="alert" className={errorText}>
          {state.error}
        </p>
      )}
    </form>
  );
}
