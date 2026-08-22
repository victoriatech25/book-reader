"use client";

import { useActionState, useOptimistic, useState } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { recordProgressAction } from "@/app/books/actions";
import { buttonSecondary, errorText, input } from "@/components/ui/styles";
import { formatProgress, formatRemaining, progressPercent } from "@/lib/progress";
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
  const [valInput, setValInput] = useState<string>("");
  const [minInput, setMinInput] = useState<string>("");

  const [state, formAction, pending] = useActionState(
    async (prev: typeof ACTION_IDLE, formData: FormData) => {
      const next = Number(String(formData.get("value") ?? "").trim());
      if (Number.isInteger(next)) setOptimisticValue(next);
      const res = await recordProgressAction(prev, formData);
      if (!res.error) {
        setValInput("");
        setMinInput("");
      }
      return res;
    },
    ACTION_IDLE,
  );

  const percent = progressPercent(optimisticValue, target);
  const remaining = formatRemaining(optimisticValue, unit, target);

  // 단위에 따른 빠른 증감 옵션
  const quickSteps = unit === "percent" ? [5, 10] : [10, 20, 50];

  function applyQuickStep(step: number) {
    const maxLimit = target ?? (unit === "percent" ? 100 : Infinity);
    const base = Number(valInput) || optimisticValue;
    const next = Math.min(maxLimit, base + step);
    setValInput(String(next));
  }

  return (
    <div className="mt-2">
      {/*
        왼쪽은 지금 어디인지, 오른쪽은 얼마나 남았는지. 비율은 아래 막대가 이미
        보여주므로 숫자로 되풀이하지 않는다 — percent 단위에서는 왼쪽 값이 곧
        진행률이라 같은 숫자가 두 번 나왔다.
      */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground font-mono text-xs">
          {formatProgress(optimisticValue, unit, target)}
        </span>
        {remaining && <span className="text-muted-foreground font-mono text-xs">{remaining}</span>}
      </div>

      <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <form action={formAction} className="mt-2.5 space-y-2">
        <input type="hidden" name="reading_id" value={readingId} />

        <div className="flex flex-wrap items-center gap-2">
          <input
            name="value"
            type="number"
            value={valInput}
            onChange={(e) => setValInput(e.target.value)}
            min={0}
            max={target ?? undefined}
            aria-label={unit === "page" ? "현재 쪽" : "진행률 (%)"}
            placeholder={unit === "page" ? "현재 쪽" : "%"}
            className={`w-24 ${input}`}
          />
          <input
            name="minutes"
            type="number"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            min={1}
            max={1440}
            aria-label="읽은 시간 (분)"
            placeholder="분"
            className={`w-20 ${input}`}
          />
          <button type="submit" disabled={pending} className={buttonSecondary}>
            기록
          </button>

          {/* 1탭 빠른 진행 증감 버튼 */}
          <div className="flex items-center gap-1">
            {quickSteps.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => applyQuickStep(step)}
                title={`현재 진행에 +${step}${unit === "percent" ? "%" : "쪽"} 더하기`}
                className="bg-secondary text-secondary-foreground hover:bg-accent active:scale-95 inline-flex min-h-8 items-center rounded-lg px-2 text-xs font-mono transition-transform"
              >
                +{step}
                {unit === "percent" ? "%" : "p"}
              </button>
            ))}
          </div>
        </div>
      </form>

      {state.error && (
        <p role="alert" className={`mt-1.5 ${errorText}`}>
          {state.error}
        </p>
      )}
    </div>
  );
}

