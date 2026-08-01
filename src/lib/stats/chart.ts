/**
 * 차트 기하 계산.
 *
 * 차트 라이브러리를 넣지 않는다. 필요한 것이 도넛과 막대 둘뿐이라 SVG로
 * 직접 그리는 편이 새 런타임 의존성보다 싸고, 서버 컴포넌트에서 그대로
 * 렌더된다(클라이언트 JS가 0이다).
 *
 * 각도·좌표 계산은 눈으로 검증하기 어려우므로 여기 순수 함수로 모은다.
 */

export type DonutSlice = {
  /** SVG path의 d 속성. */
  path: string;
  /** 0~1 비율. */
  ratio: number;
  /** 0~100 반올림. 라벨용. */
  percent: number;
};

const TAU = Math.PI * 2;

/** 12시 방향을 0도로 두고 시계방향으로 도는 좌표. */
function pointOn(cx: number, cy: number, radius: number, turn: number): [number, number] {
  const angle = turn * TAU - Math.PI / 2;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * 도넛 조각들의 path를 만든다.
 *
 * 값이 하나뿐이거나 나머지가 전부 0이면 조각 하나가 원 전체가 되는데,
 * SVG의 호(A)는 시작점과 끝점이 같으면 아무것도 그리지 않는다. 그 경우는
 * 반원 두 개를 이어 붙인 고리로 따로 그린다.
 */
export function donutSlices(
  values: number[],
  options: { size?: number; thickness?: number } = {},
): DonutSlice[] {
  const size = options.size ?? 160;
  const thickness = options.thickness ?? 28;

  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2;
  const inner = outer - thickness;

  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return [];

  const slices: DonutSlice[] = [];
  let cursor = 0;

  for (const raw of values) {
    const value = Math.max(0, raw);
    if (value === 0) {
      slices.push({ path: "", ratio: 0, percent: 0 });
      continue;
    }

    const ratio = value / total;
    const start = cursor;
    const end = cursor + ratio;
    cursor = end;

    slices.push({
      path: ratio >= 1 ? fullRing(cx, cy, outer, inner) : arcPath(cx, cy, outer, inner, start, end),
      ratio,
      percent: Math.round(ratio * 100),
    });
  }

  return slices;
}

function arcPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number,
): string {
  const largeArc = end - start > 0.5 ? 1 : 0;

  const [x0o, y0o] = pointOn(cx, cy, outer, start);
  const [x1o, y1o] = pointOn(cx, cy, outer, end);
  const [x1i, y1i] = pointOn(cx, cy, inner, end);
  const [x0i, y0i] = pointOn(cx, cy, inner, start);

  return [
    `M ${round(x0o)} ${round(y0o)}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${round(x1o)} ${round(y1o)}`,
    `L ${round(x1i)} ${round(y1i)}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${round(x0i)} ${round(y0i)}`,
    "Z",
  ].join(" ");
}

/** 100%짜리 고리. 반원 두 개를 이어 붙인다. */
function fullRing(cx: number, cy: number, outer: number, inner: number): string {
  return [
    `M ${round(cx)} ${round(cy - outer)}`,
    `A ${outer} ${outer} 0 1 1 ${round(cx)} ${round(cy + outer)}`,
    `A ${outer} ${outer} 0 1 1 ${round(cx)} ${round(cy - outer)}`,
    `M ${round(cx)} ${round(cy - inner)}`,
    `A ${inner} ${inner} 0 1 0 ${round(cx)} ${round(cy + inner)}`,
    `A ${inner} ${inner} 0 1 0 ${round(cx)} ${round(cy - inner)}`,
    "Z",
  ].join(" ");
}

/**
 * 막대 높이를 0~1 비율로. 가장 큰 값이 1이 된다.
 *
 * 최댓값이 0이면(그 해에 완독이 하나도 없으면) 전부 0을 준다 — 0으로 나누지
 * 않으려고 1을 주면 빈 해에 막대가 꽉 차 보인다.
 */
export function barRatios(values: number[]): number[] {
  const max = Math.max(0, ...values);
  if (max <= 0) return values.map(() => 0);
  return values.map((value) => Math.max(0, value) / max);
}
