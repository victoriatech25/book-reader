import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteBookAction } from "@/app/books/actions";
import { FORMAT_LABEL, OWNERSHIP_LABEL } from "@/lib/books/schema";
import { formatDate } from "@/lib/format";
import { formatDelta, formatProgress, progressPercent } from "@/lib/progress";
import {
  isTerminal,
  STATUS_LABEL,
  type ProgressUnit,
  type ReadingStatus,
} from "@/lib/reading-status";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { ProgressForm } from "./progress-form";
import { NewAttemptButton, ReadingActions } from "./reading-actions";

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: book } = await supabase
    .from("books")
    .select(
      "id, title, subtitle, authors, translators, publisher, published_on, isbn13, cover_url, total_pages, format, ownership, memo, source",
    )
    .eq("id", id)
    .maybeSingle();

  // RLS 때문에 남의 책도 "없음"으로 보인다. 존재 여부를 흘리지 않는다.
  if (!book) notFound();

  const { data: readings } = await supabase
    .from("readings")
    .select(
      "id, attempt_no, status, progress_unit, current_value, target_value, started_at, finished_at, dropped_at, drop_reason, rating, review",
    )
    .eq("book_id", id)
    .order("attempt_no", { ascending: false });

  const attempts = readings ?? [];
  const latest = attempts[0];
  const canStartNewAttempt = latest ? isTerminal(latest.status as ReadingStatus) : true;

  const { data: logs } = await supabase
    .from("progress_logs")
    .select("id, reading_id, logged_on, value_from, value_to, minutes, memo, created_at")
    .in(
      "reading_id",
      attempts.map((attempt) => attempt.id),
    )
    .order("logged_on", { ascending: false })
    .order("created_at", { ascending: false });

  const logsByReading = new Map<string, NonNullable<typeof logs>>();
  for (const log of logs ?? []) {
    const list = logsByReading.get(log.reading_id) ?? [];
    list.push(log);
    logsByReading.set(log.reading_id, list);
  }

  const meta = [
    book.authors.length > 0 ? book.authors.join(", ") : null,
    book.publisher,
    book.published_on ? formatDate(book.published_on) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-12 dark:bg-zinc-950">
      <main className="w-full max-w-xl">
        <Link
          href="/"
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← 홈
        </Link>

        <div className="mt-6 flex gap-5">
          {book.cover_url && (
            // 표지는 외부 도메인이라 next/image 대신 img를 쓴다.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_url}
              alt=""
              className="h-36 w-24 shrink-0 rounded-sm bg-zinc-100 object-cover dark:bg-zinc-800"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {book.title}
            </h1>
            {book.subtitle && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{book.subtitle}</p>
            )}
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{meta.join(" · ")}</p>
            <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {FORMAT_LABEL[book.format as keyof typeof FORMAT_LABEL]} ·{" "}
              {OWNERSHIP_LABEL[book.ownership as keyof typeof OWNERSHIP_LABEL]}
              {book.total_pages ? ` · ${book.total_pages}쪽` : ""}
              {book.isbn13 ? ` · ${book.isbn13}` : ""}
            </p>
          </div>
        </div>

        {book.memo && (
          <p className="mt-6 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm whitespace-pre-wrap text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {book.memo}
          </p>
        )}

        <div className="mt-6 flex items-center gap-4">
          <Link
            href={`/books/${book.id}/edit`}
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            수정
          </Link>
          <form action={deleteBookAction}>
            <input type="hidden" name="book_id" value={book.id} />
            <button
              type="submit"
              className="text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400"
            >
              삭제
            </button>
          </form>
        </div>

        <h2 className="mt-10 text-sm font-medium text-zinc-900 dark:text-zinc-100">독서 기록</h2>

        <ul className="mt-3 space-y-4">
          {attempts.map((reading) => {
            const unit = reading.progress_unit as ProgressUnit;
            const percent = progressPercent(reading.current_value, reading.target_value);
            const unitLabel = formatProgress(reading.current_value, unit, reading.target_value);
            const timeline = logsByReading.get(reading.id) ?? [];

            return (
              <li
                key={reading.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {reading.attempt_no}회독 · {STATUS_LABEL[reading.status as ReadingStatus]}
                  </span>
                  <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {unitLabel}
                  </span>
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <div>
                    <dt className="inline">시작 </dt>
                    <dd className="inline font-mono">{formatDate(reading.started_at)}</dd>
                  </div>
                  <div>
                    <dt className="inline">완독 </dt>
                    <dd className="inline font-mono">{formatDate(reading.finished_at)}</dd>
                  </div>
                  <div>
                    <dt className="inline">중단 </dt>
                    <dd className="inline font-mono">{formatDate(reading.dropped_at)}</dd>
                  </div>
                </dl>

                {reading.drop_reason && (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    중단 사유: {reading.drop_reason}
                  </p>
                )}

                <ReadingActions readingId={reading.id} status={reading.status as ReadingStatus} />

                {!isTerminal(reading.status as ReadingStatus) && (
                  <ProgressForm
                    readingId={reading.id}
                    unit={unit}
                    current={reading.current_value}
                    target={reading.target_value}
                  />
                )}

                {timeline.length > 0 && (
                  <details className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <summary className="cursor-pointer text-xs text-zinc-500 dark:text-zinc-400">
                      진행 기록 {timeline.length}건
                    </summary>
                    <ol className="mt-2 space-y-1.5">
                      {timeline.map((log) => (
                        <li key={log.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                          <span className="font-mono text-zinc-500 dark:text-zinc-400">
                            {formatDate(log.logged_on)}
                          </span>
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">
                            {formatDelta(log.value_from, log.value_to, unit)}
                          </span>
                          {log.minutes !== null && (
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {log.minutes}분
                            </span>
                          )}
                          {log.memo && (
                            <span className="text-zinc-600 dark:text-zinc-400">{log.memo}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </li>
            );
          })}
        </ul>

        {canStartNewAttempt && <NewAttemptButton bookId={book.id} />}
      </main>
    </div>
  );
}
