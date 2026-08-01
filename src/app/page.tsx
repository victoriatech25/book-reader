import Link from "next/link";
import { redirect } from "next/navigation";

import { UserBadge } from "@/components/user-badge";
import { buttonPrimary, card, quietLink } from "@/components/ui/styles";
import { progressPercent } from "@/lib/progress";
import { STATUS_LABEL, type ProgressUnit, type ReadingStatus } from "@/lib/reading-status";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";

import { QuickProgress } from "./quick-progress";

export default async function Home() {
  const user = await getCurrentUser();

  // 프록시가 이미 막지만, 페이지가 스스로도 확인한다.
  // 프록시 matcher를 잘못 고쳐도 데이터가 새지 않도록.
  if (!user) redirect("/login");

  const supabase = await createServerSupabaseClient();

  // 읽는 중인 책은 매일 만지는 화면이라 맨 위에 둔다.
  const { data: reading } = await supabase
    .from("readings")
    .select("id, attempt_no, progress_unit, current_value, target_value, books(id, title, authors)")
    .eq("status", "reading")
    .order("updated_at", { ascending: false });

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
    <div className="bg-background flex flex-1 justify-center px-6 py-12">
      <main className="w-full max-w-xl">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">book-reader</h1>
          <UserBadge email={user.email ?? "(이메일 없음)"} />
        </div>

        <div className="mt-6 flex items-center gap-4">
          <Link href="/books/new" className={`inline-block ${buttonPrimary}`}>
            책 등록
          </Link>
          <Link href="/settings" className={quietLink}>
            설정
          </Link>
        </div>

        {(reading ?? []).length > 0 && (
          <section className="mt-10">
            <h2 className="text-foreground text-sm font-medium">읽는 중 ({reading?.length})</h2>
            <ul className="mt-3 space-y-3">
              {(reading ?? []).map((item) => (
                <li key={item.id} className={card}>
                  <Link
                    href={`/books/${item.books.id}`}
                    className="text-foreground font-serif text-base font-medium hover:underline"
                  >
                    {item.books.title}
                  </Link>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {item.books.authors.join(", ")}
                    {item.attempt_no > 1 ? ` · ${item.attempt_no}회독` : ""}
                  </span>

                  <QuickProgress
                    readingId={item.id}
                    unit={item.progress_unit as ProgressUnit}
                    current={item.current_value}
                    target={item.target_value}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="text-foreground mt-10 text-sm font-medium">최근 기록 ({books.length})</h2>

        {books.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            아직 등록한 책이 없습니다. 위에서 첫 책을 담아보세요.
          </p>
        ) : (
          <ul className="divide-border border-border mt-3 divide-y border-y">
            {books.map((book) => {
              const percent = book.latest
                ? progressPercent(book.latest.current_value, book.latest.target_value)
                : 0;

              return (
                <li key={book.id}>
                  <Link
                    href={`/books/${book.id}`}
                    className="hover:bg-accent flex items-center gap-3 rounded-md px-2 py-3 transition-colors"
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
                      <span className="bg-muted h-14 w-10 shrink-0 rounded-sm" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block truncate font-serif text-base font-medium">
                        {book.title}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                        {book.authors.join(", ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="text-muted-foreground block text-xs">
                        {book.latest ? STATUS_LABEL[book.latest.status as ReadingStatus] : "-"}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block font-mono text-xs">
                        {percent}%
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-muted-foreground mt-6 text-xs">
          필터·정렬이 있는 서재 화면은 W9에서 만듭니다. 지금은 최근 순 20권만 보여줍니다.
        </p>
      </main>
    </div>
  );
}
