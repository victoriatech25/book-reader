import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { quietLink } from "@/components/ui/styles";
import type { LibraryBook } from "@/lib/library/filter";
import type { ProgressUnit, ReadingStatus } from "@/lib/reading-status";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";

import { LibraryView } from "./library-view";

export const metadata: Metadata = { title: "서재 · book-reader" };

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createServerSupabaseClient();

  /*
   * 전량을 한 번에 받는다 (PRD §5).
   *
   * 카드에 쓸 필드만 고른다 — 메모·인용구·진행 기록까지 끌고 오면 수백 권에서
   * 응답이 커진다. 페이지네이션은 없다. 1,000권을 넘어가면 그때 서버 필터링으로
   * 옮긴다.
   */
  const [{ data: rows }, { data: categories }] = await Promise.all([
    supabase
      .from("books")
      .select(
        `id, title, subtitle, authors, publisher, cover_url, updated_at, category_id,
         categories(name, color, sort_order),
         book_tags(tags(name)),
         readings(attempt_no, status, progress_unit, current_value, target_value,
                  started_at, finished_at, rating, review)`,
      )
      .order("updated_at", { ascending: false }),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);

  const books: LibraryBook[] = (rows ?? []).map((row) => {
    // 최신 회차가 현재 상태다 (홈과 같은 규칙).
    const latest = [...row.readings].sort((a, b) => b.attempt_no - a.attempt_no)[0];

    return {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      authors: row.authors,
      publisher: row.publisher,
      coverUrl: row.cover_url,
      updatedAt: row.updated_at,
      categoryId: row.category_id,
      categoryName: row.categories?.name ?? null,
      categoryColor: row.categories?.color ?? null,
      categorySortOrder: row.categories?.sort_order ?? 0,
      tags: row.book_tags
        .map((link) => link.tags?.name)
        .filter((name): name is string => typeof name === "string"),

      status: (latest?.status as ReadingStatus | undefined) ?? null,
      attemptNo: latest?.attempt_no ?? 1,
      progressUnit: (latest?.progress_unit as ProgressUnit | undefined) ?? "percent",
      currentValue: latest?.current_value ?? 0,
      targetValue: latest?.target_value ?? null,
      startedAt: latest?.started_at ?? null,
      finishedAt: latest?.finished_at ?? null,
      rating: latest?.rating ?? null,
      review: latest?.review ?? null,
    };
  });

  return (
    <div className="bg-background flex flex-1 justify-center px-6 py-12">
      <main className="w-full max-w-5xl">
        <div className="flex items-baseline justify-between gap-4">
          <Link href="/" className={quietLink}>
            ← 홈
          </Link>
          <Link href="/settings" className={quietLink}>
            설정
          </Link>
        </div>

        <h1 className="text-foreground mt-4 mb-8 text-2xl font-semibold tracking-tight">서재</h1>

        <LibraryView books={books} categories={categories ?? []} />
      </main>
    </div>
  );
}
