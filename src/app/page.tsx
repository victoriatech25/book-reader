import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LibraryIcon, SettingsIcon } from "@/components/ui/icons";
import { UserBadge } from "@/components/user-badge";
import { buttonPrimary, card, quietLink } from "@/components/ui/styles";
import { formatDate } from "@/lib/format";
import type { ProgressUnit } from "@/lib/reading-status";
import { formatNoteLocation } from "@/lib/reviews";
import {
  achievementFor,
  activeDays,
  averageRating,
  categoryDistribution,
  countFinishedInYear,
  currentStreak,
  formatMinutes,
  goalProgress,
  monthlyFinished,
  seoulDate,
  seoulToday,
  totalMinutes,
  yearPart,
  type FinishedReading,
  type GoalMetric,
  type GoalPeriod,
  type ProgressEntry,
} from "@/lib/stats/aggregate";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";

import { CategoryDonut, MonthlyBars } from "./charts";
import { GoalCard, type GoalCardData } from "./goal-card";
import { QuickProgress } from "./quick-progress";

/*
 * 표지 줄의 최대 칸 수. 가장 넓은 화면(본문 폭 768px)의 열 칸과 같다.
 * 실제로 몇 칸이 보이는지는 CSS가 정한다 — 아래 CoverRow 참고.
 */
const COVER_ROW_MAX = 10;

/**
 * 올해 읽은 책 표지 한 줄.
 *
 * 좁은 화면 5칸 · sm 8칸 · md 10칸. 열 수와 감추는 칸이 같은 눈금을 쓰기 때문에
 * 어느 폭에서도 정확히 한 줄이고, 잘린 표지가 남지 않는다. display:none인 칸은
 * 그리드에서 자리를 차지하지 않으므로 두 번째 줄로 밀려나는 일도 없다.
 *
 * 가로 스크롤을 두지 않는다. 대시보드는 훑어보는 화면이고, 전부 보려면 서재가 있다.
 */
function CoverRow({
  books,
}: {
  books: { readingId: string; bookId: string; title: string; coverUrl: string | null }[];
}) {
  return (
    <ul className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
      {books.map((book, index) => (
        <li
          key={book.readingId}
          className={index >= 8 ? "hidden md:block" : index >= 5 ? "hidden sm:block" : undefined}
        >
          <Link
            href={`/books/${book.bookId}`}
            aria-label={book.title}
            title={book.title}
            className="block rounded-sm transition-transform active:scale-[0.97]"
          >
            {book.coverUrl ? (
              // 표지는 외부 도메인이라 next/image 대신 img를 쓴다 (서재와 같은 이유).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.coverUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-[2/3] w-full rounded-sm object-cover"
              />
            ) : (
              // 표지가 없는 책도 자리는 지킨다. 빠지면 줄이 어긋나 순서를 잃는다.
              <span className="bg-muted block aspect-[2/3] w-full rounded-sm" />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    // 숫자만 떼어놓으면 스크린리더가 "1권"이라고만 읽어 무엇의 1권인지 모른다.
    <div className={card} role="group" aria-label={`${label} ${value}`}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground mt-1 font-mono text-xl">{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}

export default async function Home() {
  const user = await getCurrentUser();

  // 프록시가 이미 막지만, 페이지가 스스로도 확인한다.
  // 프록시 matcher를 잘못 고쳐도 데이터가 새지 않도록.
  if (!user) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const today = seoulToday();
  const thisYear = yearPart(today);

  /*
   * 대시보드는 집계 화면이라 필요한 것을 한 번에 받는다. 집계는 SQL view가
   * 아니라 lib/stats/aggregate.ts의 순수 함수가 한다 — CLAUDE.md의 지침이고,
   * 그래야 단위 테스트로 검증된다.
   */
  const [
    { data: finishedRows },
    { data: logRows },
    { data: readingRows },
    { data: goalRows },
    { data: noteRows },
  ] = await Promise.all([
    supabase
      .from("readings")
      .select(
        "id, finished_at, rating, books(id, title, cover_url, category_id, categories(name, color, sort_order))",
      )
      .eq("status", "finished")
      .not("finished_at", "is", null)
      // 표지 줄이 최신 완독 순이다. 집계는 순서를 타지 않으므로 손해가 없다.
      .order("finished_at", { ascending: false }),
    supabase.from("progress_logs").select("logged_on, minutes"),
    supabase
      .from("readings")
      .select(
        "id, attempt_no, progress_unit, current_value, target_value, books(id, title, authors)",
      )
      .eq("status", "reading")
      .order("updated_at", { ascending: false }),
    supabase.from("goals").select("id, period, period_key, metric, target"),
    supabase
      .from("notes")
      .select("id, body, location, kind, readings(progress_unit, books(id, title))")
      .eq("kind", "quote")
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const finishedRowsSafe = finishedRows ?? [];

  const finished: FinishedReading[] = finishedRowsSafe.map((row) => ({
    finishedAt: row.finished_at,
    categoryId: row.books?.category_id ?? null,
    categoryName: row.books?.categories?.name ?? null,
    categoryColor: row.books?.categories?.color ?? null,
    categorySortOrder: row.books?.categories?.sort_order ?? 0,
    rating: row.rating,
  }));

  const entries: ProgressEntry[] = (logRows ?? []).map((row) => ({
    loggedOn: row.logged_on,
    minutes: row.minutes,
  }));

  const reading = readingRows ?? [];
  const notes = noteRows ?? [];

  // 기간이 지난 목표는 보여주지 않는다. 작년 목표가 0%로 남아 있으면
  // 매일 실패한 것처럼 보인다.
  const goals: GoalCardData[] = (goalRows ?? [])
    .filter((row) =>
      row.period === "year" ? row.period_key === thisYear : row.period_key === today.slice(0, 7),
    )
    .map((row) => {
      const goal = {
        period: row.period as GoalPeriod,
        periodKey: row.period_key,
        metric: row.metric as GoalMetric,
      };
      return {
        id: row.id,
        period: goal.period,
        metric: goal.metric,
        target: row.target,
        progress: goalProgress(achievementFor(goal, finished, entries), row.target),
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period) || a.metric.localeCompare(b.metric));

  const finishedThisYear = countFinishedInYear(finished, thisYear);
  const minutesThisYear = totalMinutes(entries, thisYear);
  const streak = currentStreak(entries, today);
  const average = averageRating(finished, thisYear);
  const shares = categoryDistribution(finished, thisYear);
  const months = monthlyFinished(finished, thisYear);

  /*
   * 올해 완독한 책의 표지 줄. 쿼리가 최신 완독 순으로 주므로 그대로 왼쪽부터 쓴다.
   *
   * 한 줄을 넘기지 않는다 — 넘치는 칸은 CSS가 감춘다(아래 섹션). 화면이 가장
   * 넓어도 열 칸이므로 그 이상은 애초에 만들지 않는다. 서버는 화면 폭을 모르니
   * 개수를 여기서 정하는 대신 상한만 두고 판단은 CSS에 맡긴다.
   */
  const coverRow = finishedRowsSafe
    .filter((row) => {
      const day = seoulDate(row.finished_at);
      return day !== null && yearPart(day) === thisYear && row.books !== null;
    })
    .slice(0, COVER_ROW_MAX)
    .map((row) => ({
      readingId: row.id,
      bookId: row.books!.id,
      title: row.books!.title,
      coverUrl: row.books!.cover_url,
    }));

  return (
    <div className="bg-background flex flex-1 justify-center px-6 py-12">
      <main id="main" className="w-full max-w-3xl">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          {/*
            마크는 인라인으로 둔다. h1을 flex로 만들면 컨테이너의 items-baseline이
            글자가 아니라 svg 아래끝을 기준으로 잡아 UserBadge와 어긋난다.
          */}
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            <BrandMark className="mr-2 inline-block size-[1.05em] align-[-0.16em]" />
            독서대
          </h1>
          <UserBadge email={user.email ?? "(이메일 없음)"} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/books/new" className={buttonPrimary}>
            책 등록
          </Link>
          <Link href="/library" className={quietLink}>
            <LibraryIcon />
            서재
          </Link>
          <Link href="/settings" className={quietLink}>
            <SettingsIcon />
            설정
          </Link>
          <div className="ml-auto">
            <ThemeToggle idPrefix="home-theme" />
          </div>
        </div>

        {/* -- 올해 요약 -------------------------------------------------- */}
        <section className="mt-10">
          <h2 className="text-foreground text-sm font-medium">{thisYear}년</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="완독" value={`${finishedThisYear}권`} />
            <Stat
              label="독서 시간"
              value={formatMinutes(minutesThisYear)}
              hint={`${activeDays(entries, thisYear)}일 기록`}
            />
            <Stat
              label="연속 기록"
              value={`${streak}일`}
              hint={streak === 0 ? "오늘 한 줄 남겨보세요" : undefined}
            />
            <Stat label="평균 별점" value={average === null ? "-" : `★ ${average.toFixed(1)}`} />
          </div>
        </section>

        {/* -- 읽는 중 ---------------------------------------------------- */}
        {reading.length > 0 && (
          <section className="mt-10">
            <h2 className="text-foreground text-sm font-medium">읽는 중 ({reading.length})</h2>
            <ul className="mt-3 space-y-3">
              {reading.map((item) => (
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

        {/* -- 목표 ------------------------------------------------------- */}
        <div className="mt-10">
          <GoalCard goals={goals} />
        </div>

        {/* -- 올해 읽은 책 ----------------------------------------------- */}
        {coverRow.length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-foreground text-sm font-medium">올해 읽은 책</h2>
              <p className="text-muted-foreground text-xs">
                <span className="text-foreground font-mono">{finishedThisYear}</span>권
              </p>
            </div>
            <CoverRow books={coverRow} />
          </section>
        )}

        {/* -- 차트 ------------------------------------------------------- */}
        <section className="mt-10">
          <h2 className="text-foreground text-sm font-medium">월별 완독</h2>
          <div className="mt-3">
            <MonthlyBars months={months} />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-foreground text-sm font-medium">분야 분포</h2>
          <div className="mt-3">
            <CategoryDonut shares={shares} />
          </div>
        </section>

        {/* -- 최근 인용구 ------------------------------------------------ */}
        {notes.length > 0 && (
          <section className="mt-10">
            <h2 className="text-foreground text-sm font-medium">최근 인용구</h2>
            <ul className="mt-3 space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="border-border border-l-2 pl-3">
                  <p className="prose-quote text-sm">{note.body}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {note.readings?.books && (
                      <Link href={`/books/${note.readings.books.id}`} className="hover:underline">
                        {note.readings.books.title}
                      </Link>
                    )}
                    {note.location !== null &&
                      note.readings &&
                      ` · ${formatNoteLocation(
                        note.location,
                        note.readings.progress_unit as ProgressUnit,
                      )}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-muted-foreground mt-12 text-xs">
          오늘은 {formatDate(today)}입니다. 통계는 완독 기록과 진행 기록에서 계산합니다.
        </p>
      </main>
    </div>
  );
}
