import type { ProgressUnit } from "./reading-status";

/**
 * 진행률 계산과 입력 검증.
 *
 * DB의 record_progress()도 범위를 막지만, 사용자는 Postgres 에러가 아니라
 * 한국어 문장을 봐야 한다. 순수 함수로 두어 폼과 서버 액션이 함께 쓴다.
 */

/** 진행률(%). target이 없거나 0이면 0으로 본다. */
export function progressPercent(current: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

/** 화면에 보여줄 진행 표기. 단위에 따라 다르다. */
export function formatProgress(value: number, unit: ProgressUnit, target: number | null): string {
  return unit === "page" ? `${value} / ${target ?? "?"}쪽` : `${value}%`;
}

export const PROGRESS_UNIT_LABEL: Record<ProgressUnit, string> = {
  percent: "퍼센트",
  page: "페이지",
};

export type ProgressCheck = { ok: true; backward: boolean } | { ok: false; message: string };

/**
 * 진행 값 검증.
 *
 * 되돌아가는 입력(backward)은 막지 않는다 — 잘못 기록한 값을 고치는 정당한
 * 경우가 있다. 대신 사고인지 확인할 수 있도록 표시만 남긴다.
 */
export function checkProgress(input: {
  value: number;
  current: number;
  target: number | null;
  unit: ProgressUnit;
}): ProgressCheck {
  const { value, current, target, unit } = input;

  if (!Number.isFinite(value)) {
    return { ok: false, message: "진행 값을 숫자로 입력하세요." };
  }

  if (!Number.isInteger(value)) {
    return { ok: false, message: "진행 값은 정수로 입력하세요." };
  }

  if (value < 0) {
    return { ok: false, message: "진행 값은 0 이상이어야 합니다." };
  }

  if (target !== null && value > target) {
    return {
      ok: false,
      message:
        unit === "percent"
          ? "진행률은 100%를 넘을 수 없습니다."
          : `전체 ${target}쪽을 넘을 수 없습니다.`,
    };
  }

  return { ok: true, backward: value < current };
}

export type MinutesCheck = { ok: true } | { ok: false; message: string };

/** 읽은 시간(분). DB 제약(1~1440)과 같은 범위를 쓴다. */
export function checkMinutes(minutes: number | null): MinutesCheck {
  if (minutes === null) return { ok: true };

  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
    return { ok: false, message: "읽은 시간은 분 단위 정수로 입력하세요." };
  }

  if (minutes < 1) {
    return { ok: false, message: "읽은 시간은 1분 이상이어야 합니다." };
  }

  if (minutes > 1440) {
    return { ok: false, message: "읽은 시간은 하루(1440분)를 넘을 수 없습니다." };
  }

  return { ok: true };
}

/** 진행 기록 한 줄의 증가분. 되돌린 기록은 음수가 된다. */
export function progressDelta(valueFrom: number | null, valueTo: number): number {
  return valueTo - (valueFrom ?? 0);
}

/** 타임라인 한 줄 표기: "30% → 45%" / "120 → 180쪽" */
export function formatDelta(valueFrom: number | null, valueTo: number, unit: ProgressUnit): string {
  const from = valueFrom ?? 0;
  return unit === "page" ? `${from} → ${valueTo}쪽` : `${from}% → ${valueTo}%`;
}
