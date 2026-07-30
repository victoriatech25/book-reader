"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readBookForm } from "@/lib/books/schema";
import {
  buildStatusPatch,
  initialProgress,
  InvalidTransitionError,
  READING_STATUSES,
  type ReadingStatus,
} from "@/lib/reading-status";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { ACTION_IDLE, type ActionState } from "./action-state";

/** RLS가 이미 막지만, 액션도 스스로 세션을 확인한다. */
async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return { supabase, user };
}

/** Postgres 에러를 사용자가 읽을 수 있는 문장으로 바꾼다. */
function toMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "이미 등록한 책입니다. 같은 ISBN이 서재에 있습니다.";
  if (error.code === "23514")
    return "입력값이 규칙에 맞지 않습니다. 형태와 페이지수를 확인해주세요.";
  console.error(`[books] ${error.code ?? "?"}: ${error.message}`);
  return "저장하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

// ---------------------------------------------------------------------------
// 등록
// ---------------------------------------------------------------------------
export async function createBookAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = readBookForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { source_ref, ...input } = parsed.data;

  const { data: book, error } = await supabase
    .from("books")
    .insert({
      ...input,
      user_id: user.id,
      source_ref: source_ref as never,
    })
    .select("id, format, total_pages")
    .single();

  if (error || !book) {
    return { error: toMessage(error ?? { message: "unknown" }) };
  }

  // 책과 독서 시도는 항상 함께 생긴다. PRD §2.2 — 위시리스트도 want 상태의
  // reading 레코드로 표현한다.
  const { error: readingError } = await supabase.from("readings").insert({
    user_id: user.id,
    book_id: book.id,
    ...initialProgress(book),
  });

  if (readingError) {
    // reading 없는 책은 어느 목록에도 안 잡힌다. 유령 데이터를 남기지 않는다.
    await supabase.from("books").delete().eq("id", book.id);
    return { error: toMessage(readingError) };
  }

  revalidatePath("/");
  redirect(`/books/${book.id}`);
}

// ---------------------------------------------------------------------------
// 수정 · 삭제
// ---------------------------------------------------------------------------
export async function updateBookAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const bookId = formData.get("book_id");
  if (typeof bookId !== "string") return { error: "잘못된 요청입니다." };

  const parsed = readBookForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 출처(source, source_ref)는 등록 시점의 사실이라 수정 대상이 아니다.
  const { source_ref: _ref, source: _source, ...input } = parsed.data;
  void _ref;
  void _source;

  const { error } = await supabase.from("books").update(input).eq("id", bookId);
  if (error) return { error: toMessage(error) };

  revalidatePath("/");
  revalidatePath(`/books/${bookId}`);
  redirect(`/books/${bookId}`);
}

export async function deleteBookAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const bookId = formData.get("book_id");
  if (typeof bookId !== "string") redirect("/");

  // readings·progress_logs·notes는 FK cascade로 함께 지워진다.
  await supabase.from("books").delete().eq("id", bookId);

  revalidatePath("/");
  redirect("/");
}

// ---------------------------------------------------------------------------
// 상태 전이
// ---------------------------------------------------------------------------
function isReadingStatus(value: unknown): value is ReadingStatus {
  return typeof value === "string" && (READING_STATUSES as readonly string[]).includes(value);
}

export async function changeStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const readingId = formData.get("reading_id");
  const to = formData.get("to");
  const dropReason = formData.get("drop_reason");

  if (typeof readingId !== "string" || !isReadingStatus(to)) {
    return { error: "잘못된 요청입니다." };
  }

  const { data: reading, error: loadError } = await supabase
    .from("readings")
    .select("id, book_id, status, started_at, finished_at, dropped_at")
    .eq("id", readingId)
    .single();

  if (loadError || !reading) return { error: "독서 기록을 찾을 수 없습니다." };

  let patch;
  try {
    patch = buildStatusPatch(
      {
        status: reading.status as ReadingStatus,
        started_at: reading.started_at,
        finished_at: reading.finished_at,
        dropped_at: reading.dropped_at,
      },
      to,
      { dropReason: typeof dropReason === "string" ? dropReason : null },
    );
  } catch (error) {
    if (error instanceof InvalidTransitionError) return { error: error.message };
    throw error;
  }

  const { error } = await supabase.from("readings").update(patch).eq("id", readingId);
  if (error) return { error: toMessage(error) };

  revalidatePath("/");
  revalidatePath(`/books/${reading.book_id}`);
  return ACTION_IDLE;
}

/**
 * 재독. 끝난 기록을 되살리지 않고 attempt_no를 올린 새 행을 만든다.
 * 1회독의 시작일·완독일·별점·소감이 그대로 남는다 (PRD §2.1 A).
 */
export async function startNewAttemptAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const bookId = formData.get("book_id");
  if (typeof bookId !== "string") return { error: "잘못된 요청입니다." };

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, format, total_pages")
    .eq("id", bookId)
    .single();

  if (bookError || !book) return { error: "책을 찾을 수 없습니다." };

  const { data: last } = await supabase
    .from("readings")
    .select("attempt_no")
    .eq("book_id", bookId)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .single();

  const { error } = await supabase.from("readings").insert({
    user_id: user.id,
    book_id: bookId,
    attempt_no: (last?.attempt_no ?? 0) + 1,
    ...initialProgress(book),
  });

  if (error) return { error: toMessage(error) };

  revalidatePath(`/books/${bookId}`);
  return ACTION_IDLE;
}
