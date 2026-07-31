"use client";

import { useActionState } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { changeProgressUnitAction } from "@/app/books/actions";
import { errorText, quietLink } from "@/components/ui/styles";
import { PROGRESS_UNIT_LABEL } from "@/lib/progress";
import type { ProgressUnit } from "@/lib/reading-status";

/**
 * 진행률 단위를 바꾼다 (PRD §3.1 F3).
 *
 * 종이책을 페이지수 없이 담으면 %로 시작한다. 나중에 페이지수를 채웠을 때
 * 쪽 단위로 옮겨탈 길이 여기 말고는 없다(재독 제외).
 *
 * 허용 여부는 서버가 판정한다 — 진행 기록이 이미 있으면 거절하고 이유를
 * 문장으로 돌려준다.
 */
export function UnitSwitch({ readingId, unit }: { readingId: string; unit: ProgressUnit }) {
  const [state, formAction, pending] = useActionState(changeProgressUnitAction, ACTION_IDLE);
  const to: ProgressUnit = unit === "percent" ? "page" : "percent";

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="reading_id" value={readingId} />
      <input type="hidden" name="to" value={to} />
      <button type="submit" disabled={pending} className={`${quietLink} text-xs`}>
        {pending ? "바꾸는 중..." : `${PROGRESS_UNIT_LABEL[to]} 단위로 바꾸기`}
      </button>

      {state.error && (
        <p role="alert" className={`mt-1 ${errorText} text-xs`}>
          {state.error}
        </p>
      )}
    </form>
  );
}
