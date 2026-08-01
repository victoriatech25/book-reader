"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readBookForm } from "@/lib/books/schema";
import { checkMinutes, checkProgress, planUnitChange } from "@/lib/progress";
import {
  checkNoteBody,
  checkNoteLocation,
  checkRating,
  checkReview,
  isNoteKind,
  normalizeText,
  parseRating,
} from "@/lib/reviews";
import {
  buildStatusPatch,
  initialProgress,
  InvalidTransitionError,
  READING_STATUSES,
  type ProgressUnit,
  type ReadingStatus,
} from "@/lib/reading-status";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { syncBookTags } from "@/lib/taxonomy/sync";
import { checkTagNames, parseTagInput } from "@/lib/taxonomy/tags";

import { ACTION_IDLE, actionSaved, type ActionState } from "./action-state";

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

  const tagNames = parseTagInput(formData.get("tags") as string | null);
  const tagCheck = checkTagNames(tagNames);
  if (!tagCheck.ok) return { error: tagCheck.message };

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

  // 태그는 책이 생긴 뒤에야 붙일 수 있다(book_tags가 book_id를 참조한다).
  // 여기서 실패해도 책은 살린다 — 태그는 나중에 수정 화면에서 다시 붙이면 된다.
  if (tagNames.length > 0) {
    const { error: tagError } = await syncBookTags(supabase, user.id, book.id, tagNames);
    if (tagError) console.error(`[books] 태그 연결 실패: ${tagError}`);
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
  const { supabase, user } = await requireUser();

  const bookId = formData.get("book_id");
  if (typeof bookId !== "string") return { error: "잘못된 요청입니다." };

  const parsed = readBookForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 출처(source, source_ref)는 등록 시점의 사실이라 수정 대상이 아니다.
  const { source_ref: _ref, source: _source, ...input } = parsed.data;
  void _ref;
  void _source;

  const tagNames = parseTagInput(formData.get("tags") as string | null);
  const tagCheck = checkTagNames(tagNames);
  if (!tagCheck.ok) return { error: tagCheck.message };

  const { error } = await supabase.from("books").update(input).eq("id", bookId);
  if (error) return { error: toMessage(error) };

  const { error: tagError } = await syncBookTags(supabase, user.id, bookId, tagNames);
  if (tagError) return { error: tagError };

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

// ---------------------------------------------------------------------------
// 완독 · 소감
// ---------------------------------------------------------------------------

/** 폼에서 별점·소감·스포일러를 읽고 검증한다. 완독과 소감 수정이 함께 쓴다. */
function readReviewFields(formData: FormData) {
  const rating = parseRating(formData.get("rating"));
  const ratingCheck = checkRating(rating);
  if (!ratingCheck.ok) return { error: ratingCheck.message } as const;

  const review = normalizeText(formData.get("review"));
  const reviewCheck = checkReview(review);
  if (!reviewCheck.ok) return { error: reviewCheck.message } as const;

  return {
    error: null,
    fields: { rating, review, spoiler: formData.get("spoiler") === "on" },
  } as const;
}

/**
 * 완독 처리와 소감을 한 번에 저장한다 (PRD §3.1 F5).
 *
 * 완독 버튼과 소감 작성을 두 단계로 나누면 소감을 건너뛰게 된다. 상태 전이와
 * 같은 트랜잭션(단일 update)으로 묶어 한 화면에서 끝낸다.
 */
export async function finishReadingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const readingId = formData.get("reading_id");
  if (typeof readingId !== "string") return { error: "잘못된 요청입니다." };

  const parsed = readReviewFields(formData);
  if (parsed.error !== null) return { error: parsed.error };

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
      "finished",
    );
  } catch (error) {
    if (error instanceof InvalidTransitionError) return { error: error.message };
    throw error;
  }

  const { error } = await supabase
    .from("readings")
    .update({ ...patch, ...parsed.fields })
    .eq("id", readingId);

  if (error) return { error: toMessage(error) };

  revalidatePath("/");
  revalidatePath(`/books/${reading.book_id}`);
  return ACTION_IDLE;
}

/** 완독 후 소감·별점만 고친다. 상태는 건드리지 않는다. */
export async function updateReviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const readingId = formData.get("reading_id");
  const bookId = formData.get("book_id");
  if (typeof readingId !== "string" || typeof bookId !== "string") {
    return { error: "잘못된 요청입니다." };
  }

  const parsed = readReviewFields(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const { error } = await supabase.from("readings").update(parsed.fields).eq("id", readingId);
  if (error) return { error: toMessage(error) };

  revalidatePath("/");
  revalidatePath(`/books/${bookId}`);
  return ACTION_IDLE;
}

// ---------------------------------------------------------------------------
// 인용구 · 메모
// ---------------------------------------------------------------------------
export async function createNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const readingId = formData.get("reading_id");
  const kind = formData.get("kind");
  if (typeof readingId !== "string" || !isNoteKind(kind)) {
    return { error: "잘못된 요청입니다." };
  }

  const { data: reading, error: loadError } = await supabase
    .from("readings")
    .select("id, book_id, progress_unit, target_value")
    .eq("id", readingId)
    .single();

  if (loadError || !reading) return { error: "독서 기록을 찾을 수 없습니다." };

  const body = normalizeText(formData.get("body"));
  const bodyCheck = checkNoteBody(body);
  if (!bodyCheck.ok) return { error: bodyCheck.message };

  const rawLocation = normalizeText(formData.get("location"));
  const location = rawLocation === null ? null : Number(rawLocation);
  const locationCheck = checkNoteLocation(
    location,
    reading.progress_unit as ProgressUnit,
    reading.target_value,
  );
  if (!locationCheck.ok) return { error: locationCheck.message };

  const { error } = await supabase.from("notes").insert({
    user_id: user.id,
    reading_id: readingId,
    kind,
    location,
    body: body as string,
  });

  if (error) return { error: toMessage(error) };

  // 대시보드가 최근 인용구를 보여준다(W10). 여기서 안 지우면 인용구를 남기고
  // 홈으로 가도 옛 목록이 남는다.
  revalidatePath("/");
  revalidatePath(`/books/${reading.book_id}`);
  return actionSaved();
}

export async function toggleNoteFavoriteAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const noteId = formData.get("note_id");
  const bookId = formData.get("book_id");
  if (typeof noteId !== "string" || typeof bookId !== "string") return;

  const { data: note } = await supabase
    .from("notes")
    .select("id, is_favorite")
    .eq("id", noteId)
    .single();

  if (!note) return;

  await supabase.from("notes").update({ is_favorite: !note.is_favorite }).eq("id", noteId);

  // 대시보드는 즐겨찾기를 위로 올려 보여준다.
  revalidatePath("/");
  revalidatePath(`/books/${bookId}`);
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const noteId = formData.get("note_id");
  const bookId = formData.get("book_id");
  if (typeof noteId !== "string" || typeof bookId !== "string") return;

  await supabase.from("notes").delete().eq("id", noteId);

  revalidatePath("/");
  revalidatePath(`/books/${bookId}`);
}

// ---------------------------------------------------------------------------
// 진행 기록
// ---------------------------------------------------------------------------

/**
 * record_progress()가 raise하는 문장은 한국어로 작성돼 있어 그대로 보여줘도 된다.
 * 그 외 DB 오류는 내부 사정이므로 감춘다.
 */
function toRpcMessage(error: { code?: string; message: string }): string {
  if (error.code === "23514" || error.code === "02000" || error.code === "P0001") {
    return error.message;
  }
  console.error(`[progress] ${error.code ?? "?"}: ${error.message}`);
  return "기록하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

/**
 * 진행 기록. progress_logs insert와 readings.current_value 갱신을 DB 함수
 * 하나로 묶어 원자적으로 처리한다 (PRD §2.3).
 */
export async function recordProgressAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const readingId = formData.get("reading_id");
  if (typeof readingId !== "string") return { error: "잘못된 요청입니다." };

  const { data: reading, error: loadError } = await supabase
    .from("readings")
    .select("id, book_id, status, progress_unit, current_value, target_value")
    .eq("id", readingId)
    .single();

  if (loadError || !reading) return { error: "독서 기록을 찾을 수 없습니다." };

  const rawValue = String(formData.get("value") ?? "").trim();
  if (rawValue === "") return { error: "진행 값을 입력하세요." };

  const check = checkProgress({
    value: Number(rawValue),
    current: reading.current_value,
    target: reading.target_value,
    unit: reading.progress_unit as ProgressUnit,
  });
  if (!check.ok) return { error: check.message };

  const rawMinutes = String(formData.get("minutes") ?? "").trim();
  const minutes = rawMinutes === "" ? null : Number(rawMinutes);
  const minutesCheck = checkMinutes(minutes);
  if (!minutesCheck.ok) return { error: minutesCheck.message };

  const rawMemo = String(formData.get("memo") ?? "").trim();

  const { error } = await supabase.rpc("record_progress", {
    p_reading_id: readingId,
    p_value_to: Number(rawValue),
    // 생성된 타입은 기본값이 있는 인자를 optional로 본다. 생략하면 DB 기본값(null)이 쓰인다.
    p_minutes: minutes ?? undefined,
    p_memo: rawMemo === "" ? undefined : rawMemo,
  });

  if (error) return { error: toRpcMessage(error) };

  revalidatePath("/");
  revalidatePath(`/books/${reading.book_id}`);
  return ACTION_IDLE;
}

/**
 * 진행률 단위 전환 (PRD §3.1 F3).
 *
 * 종이책을 페이지수 없이 담으면 %로 시작하는데, 나중에 페이지수를 채워도
 * 그 회차는 계속 %였다. 재독 말고는 빠져나갈 길이 없던 것을 여기서 연다.
 * 허용 조건 판단은 순수 함수(planUnitChange)에 있다.
 */
export async function changeProgressUnitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const readingId = formData.get("reading_id");
  const to = formData.get("to");
  if (typeof readingId !== "string" || (to !== "percent" && to !== "page")) {
    return { error: "잘못된 요청입니다." };
  }

  const { data: reading, error: loadError } = await supabase
    .from("readings")
    .select("id, book_id, status, progress_unit, books(total_pages)")
    .eq("id", readingId)
    .single();

  if (loadError || !reading) return { error: "독서 기록을 찾을 수 없습니다." };

  // 기록이 하나라도 있으면 거부한다. 정확한 건수를 메시지에 넣어야 사용자가
  // 무엇 때문에 막혔는지 안다.
  const { count, error: countError } = await supabase
    .from("progress_logs")
    .select("id", { count: "exact", head: true })
    .eq("reading_id", readingId);

  if (countError) return { error: toMessage(countError) };

  const plan = planUnitChange({
    to,
    from: reading.progress_unit as ProgressUnit,
    status: reading.status as ReadingStatus,
    totalPages: reading.books?.total_pages ?? null,
    logCount: count ?? 0,
  });

  if (!plan.ok) return { error: plan.message };

  const { error } = await supabase
    .from("readings")
    .update({
      progress_unit: plan.progress_unit,
      target_value: plan.target_value,
      current_value: plan.current_value,
    })
    .eq("id", readingId);

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
