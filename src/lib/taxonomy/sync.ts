import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { diffTags, tagKey } from "./tags";

type Client = SupabaseClient<Database>;

/**
 * 책에 붙은 태그를 원하는 목록으로 맞춘다.
 *
 * 태그는 두 테이블에 걸쳐 있다 — `tags`(사용자의 태그 사전)와
 * `book_tags`(책과의 연결). 자유 입력이라 없는 태그는 만들어야 하는데,
 * `SF`가 이미 있는데 `sf`를 넣었다고 새로 만들면 사전이 금세 지저분해진다.
 * 그래서 대소문자를 무시한 키로 먼저 찾아보고, 없을 때만 만든다.
 *
 * book_tags를 통째로 지우고 다시 넣지 않는다(diffTags 참고).
 */
export async function syncBookTags(
  supabase: Client,
  userId: string,
  bookId: string,
  nextNames: string[],
): Promise<{ error: string | null }> {
  const { data: linked, error: loadError } = await supabase
    .from("book_tags")
    .select("tag_id, tags(id, name)")
    .eq("book_id", bookId);

  if (loadError) return { error: "태그를 불러오지 못했습니다." };

  const current = (linked ?? [])
    .map((row) => row.tags?.name)
    .filter((name): name is string => typeof name === "string");

  const { add, remove } = diffTags(current, nextNames);
  if (add.length === 0 && remove.length === 0) return { error: null };

  // 사용자의 태그 사전 전체. 수십~수백 개 규모라 한 번에 받아 메모리에서 맞춘다.
  const { data: owned, error: ownedError } = await supabase.from("tags").select("id, name");
  if (ownedError) return { error: "태그를 불러오지 못했습니다." };

  const byKey = new Map((owned ?? []).map((tag) => [tagKey(tag.name), tag]));

  // -- 뗄 것 ---------------------------------------------------------------
  if (remove.length > 0) {
    const ids = remove
      .map((name) => byKey.get(tagKey(name))?.id)
      .filter((id): id is string => typeof id === "string");

    if (ids.length > 0) {
      const { error } = await supabase
        .from("book_tags")
        .delete()
        .eq("book_id", bookId)
        .in("tag_id", ids);
      if (error) return { error: "태그를 떼지 못했습니다." };
    }
  }

  // -- 붙일 것 -------------------------------------------------------------
  if (add.length > 0) {
    const missing = add.filter((name) => !byKey.has(tagKey(name)));

    if (missing.length > 0) {
      const { data: created, error } = await supabase
        .from("tags")
        .insert(missing.map((name) => ({ user_id: userId, name })))
        .select("id, name");

      if (error) return { error: "태그를 만들지 못했습니다." };
      for (const tag of created ?? []) byKey.set(tagKey(tag.name), tag);
    }

    const ids = add
      .map((name) => byKey.get(tagKey(name))?.id)
      .filter((id): id is string => typeof id === "string");

    if (ids.length > 0) {
      const { error } = await supabase
        .from("book_tags")
        .insert(ids.map((tagId) => ({ book_id: bookId, tag_id: tagId })));
      if (error) return { error: "태그를 붙이지 못했습니다." };
    }
  }

  return { error: null };
}

/** 책에 붙은 태그 이름. 상세·수정 화면이 같은 방식으로 읽는다. */
export async function loadBookTagNames(supabase: Client, bookId: string): Promise<string[]> {
  const { data } = await supabase.from("book_tags").select("tags(name)").eq("book_id", bookId);

  return (data ?? [])
    .map((row) => row.tags?.name)
    .filter((name): name is string => typeof name === "string")
    .sort((a, b) => a.localeCompare(b, "ko-KR"));
}
