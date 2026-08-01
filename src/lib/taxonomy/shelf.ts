/**
 * 서재(shelf) — 사용자가 임의로 묶는 컬렉션 (PRD §2.1 B).
 *
 * 분야·태그와 달리 성격이 없다. "2026 상반기", "회사 스터디"처럼 그때그때
 * 필요한 묶음이라 규칙은 이름 길이뿐이다. 한계값은 DB와 같게 맞춘다.
 */

export const SHELF_NAME_MAX = 50;
export const SHELF_DESCRIPTION_MAX = 300;

export type Check = { ok: true } | { ok: false; message: string };

export function checkShelfName(name: string | null): Check {
  if (name === null || name.length === 0) {
    return { ok: false, message: "서재 이름을 입력하세요." };
  }
  if (name.length > SHELF_NAME_MAX) {
    return {
      ok: false,
      message: `서재 이름은 ${SHELF_NAME_MAX}자까지 쓸 수 있습니다. (현재 ${name.length}자)`,
    };
  }
  return { ok: true };
}

export function checkShelfDescription(description: string | null): Check {
  if (description === null) return { ok: true };
  if (description.length > SHELF_DESCRIPTION_MAX) {
    return {
      ok: false,
      message: `설명은 ${SHELF_DESCRIPTION_MAX}자까지 쓸 수 있습니다. (현재 ${description.length}자)`,
    };
  }
  return { ok: true };
}
