import Link from "next/link";
import { redirect } from "next/navigation";

import { UserBadge } from "@/components/user-badge";
import { progressPercent } from "@/lib/format";
import { STATUS_LABEL, type ReadingStatus } from "@/lib/reading-status";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";

export default async function Home() {
  const user = await getCurrentUser();

  // 프록시가 이미 막지만, 페이지가 스스로도 확인한다.
  // 프록시 matcher를 잘못 고쳐도 데이터가 새지 않도록.
  if (!user) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("books")
    .select(
      "id, title, authors, cover_url, updated_at, readings(attempt_no, status, progress_unit, current_value, target_value)",
    )
    .order("updated_at", { ascending: false })
    .limit(20);

  const books = (data ?? []).map((book) => {
    // 최신 회차가 현재 상태다.
    const latest = [...book.readings].sort((a, b) => b.attempt_no - a.attempt_no)[0];
    return { ...book, latest };
  });

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-12 dark:bg-zinc-950">
      <main className="w-full max-w-xl">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            book-reader
          </h1>
          <UserBadge email={user.email ?? "(이메일 없음)"} />
        </div>

        <div className="mt-6">
          <Link
            href="/books/new"
            className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            책 등록
          </Link>
        </div>

        <h2 className="mt-10 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          최근 기록 ({books.length})
        </h2>

        {books.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            아직 등록한 책이 없습니다. 위에서 첫 책을 담아보세요.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {books.map((book) => {
              const percent = book.latest
                ? progressPercent(book.latest.current_value, book.latest.target_value)
                : 0;

              return (
                <li key={book.id}>
                  <Link
                    href={`/books/${book.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    {book.cover_url ? (
                      // 표지는 외부 도메인이라 next/image 대신 img를 쓴다.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.cover_url}
                        alt=""
                        className="h-14 w-10 shrink-0 rounded-sm object-cover"
                      />
                    ) : (
                      <span className="h-14 w-10 shrink-0 rounded-sm bg-zinc-100 dark:bg-zinc-800" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {book.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {book.authors.join(", ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                        {book.latest ? STATUS_LABEL[book.latest.status as ReadingStatus] : "-"}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {percent}%
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
          필터·정렬이 있는 서재 화면은 W9에서 만듭니다. 지금은 최근 순 20권만 보여줍니다.
        </p>
      </main>
    </div>
  );
}
