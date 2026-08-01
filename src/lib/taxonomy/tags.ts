/**
 * 태그(tag) — 책당 N개, 자유 입력. 검색 축 (PRD §2.1 B).
 *
 * 분야와 달리 다중이고 사용자가 아무 문자열이나 넣는다. 그래서 같은 뜻의
 * 태그가 표기만 다르게 쌓이기 쉽다(`#SF`, `sf`, ` SF `). 정규화 규칙을 여기
 * 한 곳에 두고 입력·자동완성·병합이 모두 같은 규칙을 쓴다.
 */

export const TAG_NAME_MAX = 30;
export const TAG_MAX_PER_BOOK = 20;

export type Check = { ok: true } | { ok: false; message: string };

/**
 * 표시용 이름을 다듬는다. 대소문자는 사용자가 쓴 대로 둔다 — `SF`를 `sf`로
 * 바꿔 보여주면 자기가 쓴 게 아닌 것처럼 보인다.
 *
 *   " #번역서 "  → "번역서"
 *   "재독 예정"   → "재독 예정"   (안쪽 공백은 살린다)
 */
export function normalizeTagName(raw: string): string {
  return raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim();
}

/**
 * 같은 태그인지 판정하는 키. 대소문자만 다른 것은 같은 태그로 본다.
 *
 * DB의 unique(user_id, name)은 대소문자를 구분하므로 `SF`와 `sf`가 둘 다
 * 들어갈 수 있다. 그걸 막는 것은 앱의 몫이다.
 */
export function tagKey(name: string): string {
  return normalizeTagName(name).toLocaleLowerCase("ko-KR");
}

/**
 * 입력 문자열을 태그 목록으로 쪼갠다.
 *
 * 쉼표로 나눈다. 공백으로 나누지 않는 이유는 "재독 예정"처럼 띄어쓰기가 있는
 * 태그를 쓸 수 있어야 하기 때문이다.
 *
 * 빈 항목과 중복(대소문자 무시)은 버린다. 순서는 처음 나온 것을 유지한다.
 */
export function parseTagInput(raw: string | null): string[] {
  if (!raw) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const piece of raw.split(",")) {
    const name = normalizeTagName(piece);
    if (name.length === 0) continue;

    const key = tagKey(name);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(name);
  }

  return result;
}

/** 태그 목록을 입력 칸에 되돌려 넣을 문자열로. */
export function formatTagInput(names: string[]): string {
  return names.join(", ");
}

export function checkTagNames(names: string[]): Check {
  if (names.length > TAG_MAX_PER_BOOK) {
    return { ok: false, message: `태그는 책당 ${TAG_MAX_PER_BOOK}개까지 붙일 수 있습니다.` };
  }

  for (const name of names) {
    if (name.length > TAG_NAME_MAX) {
      return {
        ok: false,
        message: `태그 "${name.slice(0, 10)}…"가 너무 깁니다. ${TAG_NAME_MAX}자까지 쓸 수 있습니다.`,
      };
    }
  }

  return { ok: true };
}

export type TagDiff = { add: string[]; remove: string[] };

/**
 * 책에 붙은 태그를 원하는 목록으로 맞추기 위한 차이.
 *
 * book_tags를 통째로 지우고 다시 넣지 않는 이유는, 안 바뀐 연결까지 건드리면
 * 나중에 붙일 정렬 순서나 생성 시각이 매번 초기화되기 때문이다.
 */
export function diffTags(current: string[], next: string[]): TagDiff {
  const currentKeys = new Map(current.map((name) => [tagKey(name), name]));
  const nextKeys = new Map(next.map((name) => [tagKey(name), name]));

  const add: string[] = [];
  for (const [key, name] of nextKeys) {
    if (!currentKeys.has(key)) add.push(name);
  }

  const remove: string[] = [];
  for (const [key, name] of currentKeys) {
    if (!nextKeys.has(key)) remove.push(name);
  }

  return { add, remove };
}

export type MergePlan = { ok: true; from: string; into: string } | { ok: false; message: string };

/**
 * 태그 병합 판정. `from`에 붙은 책들을 `into`로 옮기고 `from`을 지운다.
 *
 * 실제 이동은 서버 액션이 한다. 여기서는 "합칠 수 있는가"만 본다.
 */
export function planTagMerge(
  from: string | null,
  into: string | null,
  existing: string[],
): MergePlan {
  const source = from === null ? "" : normalizeTagName(from);
  const target = into === null ? "" : normalizeTagName(into);

  if (source.length === 0 || target.length === 0) {
    return { ok: false, message: "합칠 태그와 남길 태그를 모두 고르세요." };
  }

  if (tagKey(source) === tagKey(target)) {
    return { ok: false, message: "같은 태그끼리는 합칠 수 없습니다." };
  }

  const keys = new Set(existing.map(tagKey));
  if (!keys.has(tagKey(source))) {
    return { ok: false, message: `"${source}" 태그를 찾을 수 없습니다.` };
  }
  if (!keys.has(tagKey(target))) {
    return { ok: false, message: `"${target}" 태그를 찾을 수 없습니다.` };
  }

  return { ok: true, from: source, into: target };
}
