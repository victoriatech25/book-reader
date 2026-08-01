import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * 도서 폼이 필요로 하는 분류 목록.
 *
 * 등록·수정 두 화면이 같은 것을 읽으므로 한 곳에 둔다. RLS가 본인 행만
 * 돌려주므로 where 절을 따로 걸지 않는다.
 */
export async function loadTaxonomyOptions() {
  const supabase = await createServerSupabaseClient();

  const [{ data: categories }, { data: tags }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("tags").select("name").order("name"),
  ]);

  return {
    categories: categories ?? [],
    tagSuggestions: (tags ?? []).map((tag) => tag.name),
  };
}
