import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import type { FinishedRow } from "./csv";
import { BACKUP_VERSION, type Backup } from "./schema";

type Client = SupabaseClient<Database>;

/**
 * 내보낼 데이터를 모은다.
 *
 * RLS가 본인 행만 돌려주므로 where를 따로 걸지 않는다. 관계는 id가 아니라
 * 이름으로 옮긴다(schema.ts 참고).
 */
export async function collectBackup(supabase: Client): Promise<Backup> {
  const [
    { data: categories },
    { data: shelves },
    { data: goals },
    { data: books },
    { data: readings },
    { data: logs },
    { data: notes },
    { data: bookTags },
    { data: shelfBooks },
  ] = await Promise.all([
    supabase.from("categories").select("name, color, sort_order").order("sort_order"),
    supabase.from("shelves").select("id, name, description, sort_order").order("sort_order"),
    supabase.from("goals").select("period, period_key, metric, target"),
    supabase
      .from("books")
      .select(
        "id, title, subtitle, authors, translators, publisher, published_on, isbn13, cover_url, total_pages, format, ownership, memo, source, source_ref, categories(name)",
      )
      .order("created_at"),
    supabase
      .from("readings")
      .select(
        "id, book_id, attempt_no, status, progress_unit, current_value, target_value, started_at, finished_at, dropped_at, drop_reason, rating, review, review_is_private, spoiler, due_on",
      )
      .order("attempt_no"),
    supabase
      .from("progress_logs")
      .select("reading_id, logged_on, value_from, value_to, minutes, memo")
      .order("logged_on"),
    supabase
      .from("notes")
      .select("reading_id, kind, location, body, is_favorite")
      .order("created_at"),
    supabase.from("book_tags").select("book_id, tags(name)"),
    supabase.from("shelf_books").select("book_id, shelf_id"),
  ]);

  const shelfNameById = new Map((shelves ?? []).map((shelf) => [shelf.id, shelf.name]));

  const tagsByBook = new Map<string, string[]>();
  for (const row of bookTags ?? []) {
    if (!row.tags?.name) continue;
    tagsByBook.set(row.book_id, [...(tagsByBook.get(row.book_id) ?? []), row.tags.name]);
  }

  const shelvesByBook = new Map<string, string[]>();
  for (const row of shelfBooks ?? []) {
    const name = shelfNameById.get(row.shelf_id);
    if (!name) continue;
    shelvesByBook.set(row.book_id, [...(shelvesByBook.get(row.book_id) ?? []), name]);
  }

  const logsByReading = new Map<string, NonNullable<typeof logs>>();
  for (const log of logs ?? []) {
    logsByReading.set(log.reading_id, [...(logsByReading.get(log.reading_id) ?? []), log]);
  }

  const notesByReading = new Map<string, NonNullable<typeof notes>>();
  for (const note of notes ?? []) {
    notesByReading.set(note.reading_id, [...(notesByReading.get(note.reading_id) ?? []), note]);
  }

  const readingsByBook = new Map<string, NonNullable<typeof readings>>();
  for (const reading of readings ?? []) {
    readingsByBook.set(reading.book_id, [...(readingsByBook.get(reading.book_id) ?? []), reading]);
  }

  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    categories: categories ?? [],
    shelves: (shelves ?? []).map(({ name, description, sort_order }) => ({
      name,
      description,
      sort_order,
    })),
    goals: (goals ?? []).map((goal) => ({
      period: goal.period as "year" | "month",
      period_key: goal.period_key,
      metric: goal.metric as "books" | "minutes",
      target: goal.target,
    })),
    books: (books ?? []).map((book) => ({
      title: book.title,
      subtitle: book.subtitle,
      authors: book.authors,
      translators: book.translators,
      publisher: book.publisher,
      published_on: book.published_on,
      isbn13: book.isbn13,
      cover_url: book.cover_url,
      total_pages: book.total_pages,
      format: book.format as "ebook" | "paper",
      ownership: book.ownership as "own" | "library" | "subscription" | "borrowed",
      memo: book.memo,
      source: book.source as "manual" | "kakao" | "aladin",
      source_ref: book.source_ref,
      category: book.categories?.name ?? null,
      tags: tagsByBook.get(book.id) ?? [],
      shelves: shelvesByBook.get(book.id) ?? [],
      readings: (readingsByBook.get(book.id) ?? []).map((reading) => ({
        attempt_no: reading.attempt_no,
        status: reading.status as "want" | "reading" | "paused" | "finished" | "dropped",
        progress_unit: reading.progress_unit as "percent" | "page",
        current_value: reading.current_value,
        target_value: reading.target_value,
        started_at: reading.started_at,
        finished_at: reading.finished_at,
        dropped_at: reading.dropped_at,
        drop_reason: reading.drop_reason,
        rating: reading.rating,
        review: reading.review,
        review_is_private: reading.review_is_private,
        spoiler: reading.spoiler,
        due_on: reading.due_on,
        progress_logs: (logsByReading.get(reading.id) ?? []).map(
          ({ logged_on, value_from, value_to, minutes, memo }) => ({
            logged_on,
            value_from,
            value_to,
            minutes,
            memo,
          }),
        ),
        notes: (notesByReading.get(reading.id) ?? []).map(
          ({ kind, location, body, is_favorite }) => ({
            kind: kind as "quote" | "thought" | "question",
            location,
            body,
            is_favorite,
          }),
        ),
      })),
    })),
  };
}

/** 완독 목록 CSV용 행. 완독한 회차만, 최근 완독부터. */
export function finishedRowsFrom(backup: Backup): FinishedRow[] {
  const rows: FinishedRow[] = [];

  for (const book of backup.books) {
    for (const reading of book.readings) {
      if (reading.status !== "finished") continue;

      rows.push({
        title: book.title,
        authors: book.authors,
        publisher: book.publisher,
        category: book.category,
        tags: book.tags,
        attemptNo: reading.attempt_no,
        rating: reading.rating,
        finishedAt: reading.finished_at,
        minutes: reading.progress_logs.reduce((sum, log) => sum + (log.minutes ?? 0), 0),
        review: reading.review,
      });
    }
  }

  return rows.sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
}
