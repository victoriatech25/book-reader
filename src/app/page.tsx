import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
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
      .select("finished_at, rating, books(category_id, categories(name, color, sort_order))")
      .eq("status", "finished")
      .not("finished_at", "is", null),
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

  const finished: FinishedReading[] = (finishedRows ?? []).map((row) => ({
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

  return (
    <div className="bg-background flex flex-1 justify-center px-6 py-12">
      <main id="main" className="w-full max-w-3xl">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">독서대</h1>
          <UserBadge email={user.email ?? "(이메일 없음)"} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/books/new" className={`inline-block ${buttonPrimary}`}>
            책 등록
          </Link>
          <Link href="/library" className={quietLink}>
            서재
          </Link>
          <Link href="/settings" className={quietLink}>
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
