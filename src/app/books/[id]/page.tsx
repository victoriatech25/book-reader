import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteBookAction, deleteNoteAction, toggleNoteFavoriteAction } from "@/app/books/actions";
import { FORMAT_LABEL, OWNERSHIP_LABEL } from "@/lib/books/schema";
import { formatDate } from "@/lib/format";
import { formatDelta, formatProgress, progressPercent } from "@/lib/progress";
import {
  canTransition,
  isTerminal,
  STATUS_LABEL,
  type ProgressUnit,
  type ReadingStatus,
} from "@/lib/reading-status";
import { formatNoteLocation, formatRating, NOTE_KIND_LABEL, type NoteKind } from "@/lib/reviews";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { card, dangerLink, quietLink } from "@/components/ui/styles";
import { categoryColor } from "@/lib/taxonomy/category";

import { FinishDialog, ReviewEditor } from "./finish-dialog";
import { NoteForm } from "./note-form";
import { ProgressForm } from "./progress-form";
import { NewAttemptButton, ReadingActions } from "./reading-actions";
import { ShelfPicker } from "./shelf-picker";
import { UnitSwitch } from "./unit-switch";

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: book } = await supabase
    .from("books")
    .select(
      "id, title, subtitle, authors, translators, publisher, published_on, isbn13, cover_url, total_pages, format, ownership, memo, source, category_id, categories(id, name, color, sort_order)",
    )
    .eq("id", id)
    .maybeSingle();

  // RLS 때문에 남의 책도 "없음"으로 보인다. 존재 여부를 흘리지 않는다.
  if (!book) notFound();

  const { data: readings } = await supabase
    .from("readings")
    .select(
      "id, attempt_no, status, progress_unit, current_value, target_value, started_at, finished_at, dropped_at, drop_reason, rating, review, spoiler",
    )
    .eq("book_id", id)
    .order("attempt_no", { ascending: false });

  // 분류(분야·태그·서재). 상세는 읽는 화면이라 한 번에 받아 온다.
  const [{ data: bookTags }, { data: shelves }, { data: shelfBooks }] = await Promise.all([
    supabase.from("book_tags").select("tags(id, name)").eq("book_id", id),
    supabase.from("shelves").select("id, name").order("sort_order"),
    supabase.from("shelf_books").select("shelf_id").eq("book_id", id),
  ]);

  const tags = (bookTags ?? [])
    .map((row) => row.tags)
    .filter((tag): tag is { id: string; name: string } => tag !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));

  const shelfMembership = new Set((shelfBooks ?? []).map((row) => row.shelf_id));

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

  const { data: notes } = await supabase
    .from("notes")
    .select("id, reading_id, kind, location, body, is_favorite, created_at")
    .in(
      "reading_id",
      attempts.map((attempt) => attempt.id),
    )
    // 즐겨찾기를 위로 올린다. 다시 꺼내 보려고 표시한 문장들이다.
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  const notesByReading = new Map<string, NonNullable<typeof notes>>();
  for (const note of notes ?? []) {
    const list = notesByReading.get(note.reading_id) ?? [];
    list.push(note);
    notesByReading.set(note.reading_id, list);
  }

  const meta = [
    book.authors.length > 0 ? book.authors.join(", ") : null,
    book.publisher,
    book.published_on ? formatDate(book.published_on) : null,
  ].filter(Boolean);

  return (
    <div className="bg-background flex flex-1 justify-center px-6 py-12">
      <main id="main" className="w-full max-w-xl">
        <Link href="/" className={quietLink}>
          ← 홈
        </Link>

        <div className="mt-6 flex gap-5">
          {book.cover_url && (
            // 표지는 외부 도메인이라 next/image 대신 img를 쓴다.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="bg-muted h-36 w-24 shrink-0 rounded-sm object-cover"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">{book.title}</h1>
            {book.subtitle && <p className="text-muted-foreground mt-1 text-sm">{book.subtitle}</p>}
            <p className="text-muted-foreground mt-2 text-sm">{meta.join(" · ")}</p>
            <p className="text-muted-foreground mt-2 font-mono text-xs">
              {FORMAT_LABEL[book.format as keyof typeof FORMAT_LABEL]} ·{" "}
              {OWNERSHIP_LABEL[book.ownership as keyof typeof OWNERSHIP_LABEL]}
              {book.total_pages ? ` · ${book.total_pages}쪽` : ""}
              {book.isbn13 ? ` · ${book.isbn13}` : ""}
            </p>
          </div>
        </div>

        {(book.categories || tags.length > 0) && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {book.categories && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
                style={{
                  // 색을 안 고른 분야는 앱이 팔레트에서 배정한다 (PRD §2.3).
                  backgroundColor: `${categoryColor(book.categories.color, book.categories.sort_order)}1f`,
                  color: categoryColor(book.categories.color, book.categories.sort_order),
                }}
              >
                {book.categories.name}
              </span>
            )}
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="border-border text-muted-foreground rounded-full border px-3 py-1 text-xs"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        {book.memo && (
          <p className="border-border bg-card text-muted-foreground mt-6 rounded-md border px-3 py-2 text-sm whitespace-pre-wrap">
            {book.memo}
          </p>
        )}

        <section className="mt-6">
          <h2 className="text-muted-foreground text-xs font-medium">서재</h2>
          <div className="mt-2">
            <ShelfPicker bookId={book.id} shelves={shelves ?? []} memberOf={shelfMembership} />
          </div>
        </section>

        <div className="mt-6 flex items-center gap-4">
          <Link href={`/books/${book.id}/edit`} className={quietLink}>
            수정
          </Link>
          <form action={deleteBookAction}>
            <input type="hidden" name="book_id" value={book.id} />
            <ConfirmSubmit
              label="삭제"
              triggerClassName={dangerLink}
              title="이 책을 삭제할까요?"
              description="진행 기록·인용구·소감을 포함해 이 책의 모든 회차가 함께 지워집니다. 되돌릴 수 없습니다."
              confirmLabel="삭제"
            />
          </form>
        </div>

        <h2 className="text-foreground mt-10 text-sm font-medium">독서 기록</h2>

        <ul className="mt-3 space-y-4">
          {attempts.map((reading) => {
            const unit = reading.progress_unit as ProgressUnit;
            const percent = progressPercent(reading.current_value, reading.target_value);
            const unitLabel = formatProgress(reading.current_value, unit, reading.target_value);
            const timeline = logsByReading.get(reading.id) ?? [];
            const readingNotes = notesByReading.get(reading.id) ?? [];

            return (
              <li key={reading.id} className={card}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-foreground text-sm font-medium">
                    {reading.attempt_no}회독 · {STATUS_LABEL[reading.status as ReadingStatus]}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">{unitLabel}</span>
                </div>

                <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-[width]"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <dl className="text-muted-foreground mt-3 grid grid-cols-3 gap-2 text-xs">
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
                  <p className="text-muted-foreground mt-2 text-sm">
                    중단 사유: {reading.drop_reason}
                  </p>
                )}

                {(reading.rating !== null || reading.review) && (
                  <div className="border-border bg-muted/50 mt-3 rounded-md border-l-2 px-3 py-2">
                    <p className="text-foreground font-mono text-sm">
                      {formatRating(reading.rating)}
                    </p>
                    {reading.review && (
                      <p className="prose-quote mt-1 text-sm whitespace-pre-wrap">
                        {reading.review}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {canTransition(reading.status as ReadingStatus, "finished") && (
                    <FinishDialog readingId={reading.id} />
                  )}
                </div>

                <ReadingActions readingId={reading.id} status={reading.status as ReadingStatus} />

                {reading.status === "finished" && (
                  <ReviewEditor
                    readingId={reading.id}
                    bookId={book.id}
                    rating={reading.rating}
                    review={reading.review}
                    spoiler={reading.spoiler}
                  />
                )}

                {!isTerminal(reading.status as ReadingStatus) && (
                  <>
                    <ProgressForm
                      readingId={reading.id}
                      unit={unit}
                      current={reading.current_value}
                      target={reading.target_value}
                    />
                    <UnitSwitch readingId={reading.id} unit={unit} />
                  </>
                )}

                {timeline.length > 0 && (
                  <details className="border-border mt-4 border-t pt-3">
                    <summary className="text-muted-foreground cursor-pointer text-xs">
                      진행 기록 {timeline.length}건
                    </summary>
                    <ol className="mt-2 space-y-1.5">
                      {timeline.map((log) => (
                        <li key={log.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                          <span className="text-muted-foreground font-mono">
                            {formatDate(log.logged_on)}
                          </span>
                          <span className="text-foreground font-mono">
                            {formatDelta(log.value_from, log.value_to, unit)}
                          </span>
                          {log.minutes !== null && (
                            <span className="text-muted-foreground">{log.minutes}분</span>
                          )}
                          {log.memo && <span className="text-muted-foreground">{log.memo}</span>}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}

                <div className="border-border mt-4 border-t pt-3">
                  <h3 className="text-foreground text-xs font-medium">
                    인용구 · 메모 {readingNotes.length > 0 && `(${readingNotes.length})`}
                  </h3>

                  {readingNotes.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {readingNotes.map((note) => (
                        <li
                          key={note.id}
                          className="border-border bg-muted/40 rounded-md border-l-2 px-3 py-2"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-muted-foreground font-mono text-xs">
                              {NOTE_KIND_LABEL[note.kind as NoteKind]}
                              {note.location !== null &&
                                ` · ${formatNoteLocation(note.location, unit)}`}
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <form action={toggleNoteFavoriteAction}>
                                <input type="hidden" name="note_id" value={note.id} />
                                <input type="hidden" name="book_id" value={book.id} />
                                <button
                                  type="submit"
                                  aria-label={
                                    note.is_favorite ? "즐겨찾기 해제" : "즐겨찾기에 추가"
                                  }
                                  className="text-muted-foreground hover:text-chart-4 text-sm transition-colors"
                                >
                                  {note.is_favorite ? "★" : "☆"}
                                </button>
                              </form>
                              <form action={deleteNoteAction}>
                                <input type="hidden" name="note_id" value={note.id} />
                                <input type="hidden" name="book_id" value={book.id} />
                                <ConfirmSubmit
                                  label="삭제"
                                  triggerAriaLabel="인용구 삭제"
                                  triggerClassName="text-xs text-muted-foreground transition-colors hover:text-destructive"
                                  title="이 기록을 삭제할까요?"
                                  description="되돌릴 수 없습니다."
                                  confirmLabel="삭제"
                                />
                              </form>
                            </span>
                          </div>
                          <p className="prose-quote mt-1 text-sm whitespace-pre-wrap">
                            {note.body}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}

                  <NoteForm readingId={reading.id} unit={unit} target={reading.target_value} />
                </div>
              </li>
            );
          })}
        </ul>

        {canStartNewAttempt && <NewAttemptButton bookId={book.id} />}
      </main>
    </div>
  );
}
