"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { actionSaved, type ActionState } from "@/app/books/action-state";
import {
  describeSummary,
  isDuplicatePolicy,
  planImport,
  type DuplicatePolicy,
  type ImportSummary,
} from "@/lib/backup/import-plan";
import { parseBackup } from "@/lib/backup/schema";
import { isGoalMetric, isGoalPeriod, periodKeyFor, seoulToday } from "@/lib/stats/aggregate";
import { checkCategoryColor, checkCategoryName } from "@/lib/taxonomy/category";
import { checkShelfDescription, checkShelfName } from "@/lib/taxonomy/shelf";
import { normalizeTagName, planTagMerge, tagKey } from "@/lib/taxonomy/tags";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return { supabase, user };
}

function toMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "같은 이름이 이미 있습니다.";
  if (error.code === "23514") return "입력값이 규칙에 맞지 않습니다.";
  console.error(`[settings] ${error.code ?? "?"}: ${error.message}`);
  return "저장하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

/** 빈 문자열·공백만 있는 입력은 "값 없음"으로 본다. */
function text(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 분류를 고치면 서재·상세·홈이 전부 달라 보인다. */
function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/books", "layout");
}

// ---------------------------------------------------------------------------
// 분야 — 책당 1개. 프리셋 12종은 가입 트리거가 사용자 소유로 복사해뒀다.
// ---------------------------------------------------------------------------
export async function createCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const name = text(formData.get("name"));
  const nameCheck = checkCategoryName(name);
  if (!nameCheck.ok) return { error: nameCheck.message };

  // 새 분야는 목록 맨 뒤에 붙인다.
  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name: name as string,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) return { error: toMessage(error) };

  revalidateAll();
  return actionSaved();
}

export async function updateCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const id = formData.get("category_id");
  if (typeof id !== "string") return { error: "잘못된 요청입니다." };

  const name = text(formData.get("name"));
  const nameCheck = checkCategoryName(name);
  if (!nameCheck.ok) return { error: nameCheck.message };

  // 빈 값으로 비우면 앱이 다시 팔레트에서 배정한다 (PRD §2.3).
  const color = text(formData.get("color"));
  const colorCheck = checkCategoryColor(color);
  if (!colorCheck.ok) return { error: colorCheck.message };

  const { error } = await supabase
    .from("categories")
    .update({ name: name as string, color })
    .eq("id", id);

  if (error) return { error: toMessage(error) };

  revalidateAll();
  return actionSaved();
}

/**
 * 분야를 지운다. 그 분야를 쓰던 책은 books.category_id 가 null 이 될 뿐
 * 삭제되지 않는다(FK on delete set null).
 */
export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = formData.get("category_id");
  if (typeof id !== "string") return;

  await supabase.from("categories").delete().eq("id", id);
  revalidateAll();
}

// ---------------------------------------------------------------------------
// 태그 — 책당 N개, 자유 입력. 그래서 정리 기능이 필요하다.
// ---------------------------------------------------------------------------
export async function renameTagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const id = formData.get("tag_id");
  if (typeof id !== "string") return { error: "잘못된 요청입니다." };

  const name = normalizeTagName(String(formData.get("name") ?? ""));
  if (name.length === 0) return { error: "태그 이름을 입력하세요." };
  if (name.length > 30) return { error: "태그 이름은 30자까지 쓸 수 있습니다." };

  const { error } = await supabase.from("tags").update({ name }).eq("id", id);
  if (error) return { error: toMessage(error) };

  revalidateAll();
  return actionSaved();
}

/**
 * 두 태그를 합친다. `from`에 붙은 책들을 `into`로 옮기고 `from`을 지운다.
 *
 * 같은 뜻인데 표기만 다른 태그(`#SF` / `sf` / `공상과학`)가 쌓이면 검색 축으로
 * 못 쓴다. 트랜잭션은 아니지만 순서를 지키면 중간에 끊겨도 데이터가 깨지지
 * 않는다 — 옮기다 멈추면 두 태그에 나뉘어 남고, 다시 합치면 된다.
 */
export async function mergeTagsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const { data: owned, error: loadError } = await supabase.from("tags").select("id, name");
  if (loadError) return { error: "태그를 불러오지 못했습니다." };

  const names = (owned ?? []).map((tag) => tag.name);
  const plan = planTagMerge(text(formData.get("from")), text(formData.get("into")), names);
  if (!plan.ok) return { error: plan.message };

  const byKey = new Map((owned ?? []).map((tag) => [tagKey(tag.name), tag]));
  const source = byKey.get(tagKey(plan.from));
  const target = byKey.get(tagKey(plan.into));
  if (!source || !target) return { error: "태그를 찾을 수 없습니다." };

  const { data: sourceLinks, error: linkError } = await supabase
    .from("book_tags")
    .select("book_id")
    .eq("tag_id", source.id);
  if (linkError) return { error: "태그를 불러오지 못했습니다." };

  const { data: targetLinks } = await supabase
    .from("book_tags")
    .select("book_id")
    .eq("tag_id", target.id);

  // 이미 양쪽에 붙어 있는 책은 새로 넣지 않는다 — 기본키(book_id, tag_id) 충돌.
  const already = new Set((targetLinks ?? []).map((row) => row.book_id));
  const toMove = (sourceLinks ?? []).map((row) => row.book_id).filter((id) => !already.has(id));

  if (toMove.length > 0) {
    const { error } = await supabase
      .from("book_tags")
      .insert(toMove.map((bookId) => ({ book_id: bookId, tag_id: target.id })));
    if (error) return { error: toMessage(error) };
  }

  // 연결은 cascade로 함께 사라진다.
  const { error: deleteError } = await supabase.from("tags").delete().eq("id", source.id);
  if (deleteError) return { error: toMessage(deleteError) };

  revalidateAll();
  return actionSaved();
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = formData.get("tag_id");
  if (typeof id !== "string") return;

  // book_tags는 FK cascade로 함께 지워진다. 책 자체는 남는다.
  await supabase.from("tags").delete().eq("id", id);
  revalidateAll();
}

// ---------------------------------------------------------------------------
// 서재 — 사용자가 임의로 묶는 컬렉션
// ---------------------------------------------------------------------------
export async function createShelfAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const name = text(formData.get("name"));
  const nameCheck = checkShelfName(name);
  if (!nameCheck.ok) return { error: nameCheck.message };

  const description = text(formData.get("description"));
  const descriptionCheck = checkShelfDescription(description);
  if (!descriptionCheck.ok) return { error: descriptionCheck.message };

  const { data: last } = await supabase
    .from("shelves")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("shelves").insert({
    user_id: user.id,
    name: name as string,
    description,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) return { error: toMessage(error) };

  revalidateAll();
  return actionSaved();
}

export async function updateShelfAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const id = formData.get("shelf_id");
  if (typeof id !== "string") return { error: "잘못된 요청입니다." };

  const name = text(formData.get("name"));
  const nameCheck = checkShelfName(name);
  if (!nameCheck.ok) return { error: nameCheck.message };

  const description = text(formData.get("description"));
  const descriptionCheck = checkShelfDescription(description);
  if (!descriptionCheck.ok) return { error: descriptionCheck.message };

  const { error } = await supabase
    .from("shelves")
    .update({ name: name as string, description })
    .eq("id", id);

  if (error) return { error: toMessage(error) };

  revalidateAll();
  return actionSaved();
}

export async function deleteShelfAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = formData.get("shelf_id");
  if (typeof id !== "string") return;

  // shelf_books는 cascade. 담겨 있던 책은 그대로 남는다.
  await supabase.from("shelves").delete().eq("id", id);
  revalidateAll();
}

/** 책을 서재에 담거나 뺀다. 상세 화면에서 쓴다. */
export async function toggleShelfBookAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const shelfId = formData.get("shelf_id");
  const bookId = formData.get("book_id");
  if (typeof shelfId !== "string" || typeof bookId !== "string") return;

  const { data: existing } = await supabase
    .from("shelf_books")
    .select("shelf_id")
    .eq("shelf_id", shelfId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (existing) {
    await supabase.from("shelf_books").delete().eq("shelf_id", shelfId).eq("book_id", bookId);
  } else {
    await supabase.from("shelf_books").insert({ shelf_id: shelfId, book_id: bookId });
  }

  revalidatePath(`/books/${bookId}`);
  // 설정 화면이 서재별 권수를 보여준다. 여기서 안 지우면 담자마자 설정으로
  // 넘어갔을 때 옛 숫자가 남는다.
  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------
// 목표 (PRD §3.1 F10) — 연간/월간, 지표는 권수 또는 시간(분)
// ---------------------------------------------------------------------------

/**
 * 목표를 세우거나 고친다.
 *
 * 같은 (기간, 기간키, 지표) 조합은 하나뿐이다(DB unique). 두 번째로 세우면
 * 새로 만드는 게 아니라 목표치를 갈아끼운다 — 사용자는 "올해 목표"를 하나로
 * 생각하지 두 개를 만들었다고 생각하지 않는다.
 */
export async function setGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const period = formData.get("period");
  const metric = formData.get("metric");
  if (!isGoalPeriod(period) || !isGoalMetric(metric)) {
    return { error: "잘못된 요청입니다." };
  }

  const rawTarget = String(formData.get("target") ?? "").trim();
  if (rawTarget === "") return { error: "목표치를 입력하세요." };

  const target = Number(rawTarget);
  if (!Number.isInteger(target) || target <= 0) {
    return { error: "목표치는 1 이상의 정수여야 합니다." };
  }

  const periodKey = periodKeyFor(period, seoulToday());

  const { error } = await supabase
    .from("goals")
    .upsert(
      { user_id: user.id, period, period_key: periodKey, metric, target },
      { onConflict: "user_id,period,period_key,metric" },
    );

  if (error) return { error: toMessage(error) };

  revalidatePath("/");
  return actionSaved();
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = formData.get("goal_id");
  if (typeof id !== "string") return;

  await supabase.from("goals").delete().eq("id", id);
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// 백업 가져오기 (PRD §3.2 F15)
// ---------------------------------------------------------------------------

/**
 * 백업 파일을 서재에 얹는다.
 *
 * 지우고 덮어쓰지 않는다 — 실수로 올린 파일 하나에 서재가 사라지면 안 된다.
 * 이미 있는 책은 정책에 따라 건너뛴다(planImport).
 *
 * 트랜잭션은 아니다. 책 단위로 넣으므로 중간에 끊기면 넣던 데까지 남고,
 * 같은 파일을 다시 올리면 이미 들어간 책은 건너뛴다. 그래서 재시도가 안전하다.
 */
export async function importBackupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "백업 파일을 고르세요." };
  }

  const policyRaw = formData.get("policy");
  const policy: DuplicatePolicy = isDuplicatePolicy(policyRaw) ? policyRaw : "skip";

  const parsed = parseBackup(await file.text());
  if (!parsed.ok) return { error: parsed.message };

  const backup = parsed.backup;

  // -- 분류를 먼저 맞춘다. 이름으로 찾고 없으면 만든다. --------------------
  const categoryId = await ensureByName(
    supabase,
    "categories",
    backup.categories.map((c) => ({
      user_id: user.id,
      name: c.name,
      color: c.color,
      sort_order: c.sort_order,
    })),
  );
  const shelfId = await ensureByName(
    supabase,
    "shelves",
    backup.shelves.map((s) => ({
      user_id: user.id,
      name: s.name,
      description: s.description,
      sort_order: s.sort_order,
    })),
  );
  const tagNames = [...new Set(backup.books.flatMap((b) => b.tags))];
  const tagId = await ensureByName(
    supabase,
    "tags",
    tagNames.map((name) => ({ user_id: user.id, name })),
  );

  // -- 무엇을 넣을지 정한다 -------------------------------------------------
  const { data: existing } = await supabase.from("books").select("isbn13, title");
  const plan = planImport(existing ?? [], backup.books, policy);

  const summary: ImportSummary = {
    books: 0,
    readings: 0,
    logs: 0,
    notes: 0,
    skipped: plan.skipped.length,
  };

  for (const item of plan.insert) {
    const { data: inserted, error } = await supabase
      .from("books")
      .insert({
        user_id: user.id,
        title: item.title,
        subtitle: item.subtitle,
        authors: item.authors,
        translators: item.translators,
        publisher: item.publisher,
        published_on: item.published_on,
        isbn13: item.isbn13,
        cover_url: item.cover_url,
        total_pages: item.total_pages,
        format: item.format,
        ownership: item.ownership,
        memo: item.memo,
        source: item.source,
        source_ref: item.source_ref as never,
        category_id: item.category ? (categoryId.get(item.category) ?? null) : null,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error(`[backup] "${item.title}" 저장 실패: ${error?.message}`);
      continue;
    }

    summary.books += 1;

    const links = item.tags
      .map((name) => tagId.get(name))
      .filter((id): id is string => typeof id === "string")
      .map((id) => ({ book_id: inserted.id, tag_id: id }));
    if (links.length > 0) await supabase.from("book_tags").insert(links);

    const shelfLinks = item.shelves
      .map((name) => shelfId.get(name))
      .filter((id): id is string => typeof id === "string")
      .map((id) => ({ shelf_id: id, book_id: inserted.id }));
    if (shelfLinks.length > 0) await supabase.from("shelf_books").insert(shelfLinks);

    for (const reading of item.readings) {
      const { data: newReading, error: readingError } = await supabase
        .from("readings")
        .insert({
          user_id: user.id,
          book_id: inserted.id,
          attempt_no: reading.attempt_no,
          status: reading.status,
          progress_unit: reading.progress_unit,
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
        })
        .select("id")
        .single();

      if (readingError || !newReading) {
        console.error(`[backup] "${item.title}" ${reading.attempt_no}회독 저장 실패`);
        continue;
      }

      summary.readings += 1;

      if (reading.progress_logs.length > 0) {
        const { error: logError } = await supabase.from("progress_logs").insert(
          reading.progress_logs.map((log) => ({
            user_id: user.id,
            reading_id: newReading.id,
            logged_on: log.logged_on,
            value_from: log.value_from,
            value_to: log.value_to,
            minutes: log.minutes,
            memo: log.memo,
          })),
        );
        if (!logError) summary.logs += reading.progress_logs.length;
      }

      if (reading.notes.length > 0) {
        const { error: noteError } = await supabase.from("notes").insert(
          reading.notes.map((note) => ({
            user_id: user.id,
            reading_id: newReading.id,
            kind: note.kind,
            location: note.location,
            body: note.body,
            is_favorite: note.is_favorite,
          })),
        );
        if (!noteError) summary.notes += reading.notes.length;
      }
    }
  }

  if (backup.goals.length > 0) {
    await supabase.from("goals").upsert(
      backup.goals.map((goal) => ({ user_id: user.id, ...goal })),
      { onConflict: "user_id,period,period_key,metric" },
    );
  }

  revalidateAll();
  return actionSaved(describeSummary(summary));
}

/**
 * 이름으로 찾고 없으면 만든다. 이름 → id 표를 돌려준다.
 *
 * 분야·태그·서재가 전부 같은 모양이라 한 함수로 묶었다. unique(user_id, name)
 * 덕분에 upsert가 안전하다.
 */
async function ensureByName(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  table: "categories" | "tags" | "shelves",
  rows: { user_id: string; name: string }[],
): Promise<Map<string, string>> {
  if (rows.length > 0) {
    await supabase.from(table).upsert(rows as never, { onConflict: "user_id,name" });
  }

  const { data } = await supabase.from(table).select("id, name");
  return new Map((data ?? []).map((row) => [row.name, row.id]));
}
