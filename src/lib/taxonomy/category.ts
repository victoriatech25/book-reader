/**
 * 분야(category) — 책당 1개, 통계의 분류 축 (PRD §2.1 B).
 *
 * 가입 트리거가 프리셋 12종을 사용자 소유 행으로 복사해둔다. 여기서는 이름·색
 * 검증과 팔레트 배정만 다룬다. 한계값은 DB(0001_init.sql)와 같게 맞춘다.
 */

export const CATEGORY_NAME_MAX = 30;

/**
 * 색을 지정하지 않은 분야에 앱이 배정하는 팔레트.
 *
 * DB 시드에 hex를 박지 않은 이유가 이것이다 — 팔레트를 바꾸는 일이 데이터
 * 마이그레이션이 되면 안 된다(PRD §2.3). color가 null이면 여기서 정렬 순서로
 * 배정하고, 사용자가 고른 경우에만 DB에 값이 들어간다.
 *
 * "서재" 컨셉에 맞춰 채도를 낮춘 12색. 도넛 차트에서 서로 구분되어야 한다.
 */
export const CATEGORY_PALETTE = [
  "#b4654a", // 테라코타
  "#5c7a5e", // 이끼
  "#8a6d3b", // 황토
  "#4a6d8c", // 청
  "#6b5b95", // 보라
  "#a85751", // 벽돌
  "#7a8b5a", // 올리브
  "#8c5a6d", // 자주
  "#4f7a7a", // 청록
  "#7d6b54", // 갈색
  "#6e7b8b", // 회청
  "#8a8a7a", // 회녹
] as const;

export type Check = { ok: true } | { ok: false; message: string };

/** 색이 지정돼 있으면 그대로, 없으면 순서로 팔레트에서 배정한다. */
export function categoryColor(color: string | null, index: number): string {
  if (color) return color;
  // 분야가 팔레트보다 많아지면 처음부터 돌린다. 12종을 넘게 만드는 사용자는
  // 어차피 색을 직접 고르게 된다.
  return CATEGORY_PALETTE[
    ((index % CATEGORY_PALETTE.length) + CATEGORY_PALETTE.length) % CATEGORY_PALETTE.length
  ];
}

export function checkCategoryName(name: string | null): Check {
  if (name === null || name.length === 0) {
    return { ok: false, message: "분야 이름을 입력하세요." };
  }
  if (name.length > CATEGORY_NAME_MAX) {
    return {
      ok: false,
      message: `분야 이름은 ${CATEGORY_NAME_MAX}자까지 쓸 수 있습니다. (현재 ${name.length}자)`,
    };
  }
  return { ok: true };
}

/** DB 제약(categories_color_hex)과 같은 규칙: #rrggbb 만 받는다. */
export function checkCategoryColor(color: string | null): Check {
  if (color === null) return { ok: true };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { ok: false, message: "색은 #rrggbb 형식이어야 합니다." };
  }
  return { ok: true };
}
