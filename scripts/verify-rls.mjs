/**
 * V3 통합 검증 — 0001_init.sql 이 실제 DB에서 의도대로 동작하는지 확인한다.
 *
 *   1) 가입 트리거: profile 1행 + 분야 프리셋 12행이 사용자 소유로 생성되는가
 *   2) CRUD 왕복: books → readings → record_progress()
 *   3) RLS 격리: 사용자 B가 A의 데이터를 조회/수정/삭제/RPC 호출할 수 없는가
 *   4) 제약: 소감 500자, 별점 0.5 배수, percent 단위의 target_value=100
 *   5) 재독: attempt_no 증가와 (book_id, attempt_no) 유일성, 이전 회차 보존
 *
 * 외부 의존성 없이 Data API(PostgREST)와 Auth API를 직접 호출한다.
 * PostgREST를 그대로 때리므로 앱이 나중에 쓰게 될 경로와 동일한 층을 검증한다.
 *
 *   pnpm verify:rls
 *
 * 테스트 사용자는 실행 끝에 삭제한다(auth.users 삭제 → 전 테이블 cascade).
 */

import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// 환경변수 (.env.local 직접 파싱 — dotenv 의존성을 만들지 않는다)
// ---------------------------------------------------------------------------
function loadEnv(path = ".env.local") {
  const env = {};
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`${path} 을 읽을 수 없습니다. U1(키 입력)이 끝났는지 확인하세요.`);
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const URL_BASE = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const PUBLISHABLE = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;

for (const [name, value] of [
  ["NEXT_PUBLIC_SUPABASE_URL", URL_BASE],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", PUBLISHABLE],
  ["SUPABASE_SERVICE_ROLE_KEY", SECRET],
]) {
  if (!value) throw new Error(`${name} 이 .env.local 에 없습니다.`);
}

// ---------------------------------------------------------------------------
// 결과 집계
// ---------------------------------------------------------------------------
let passed = 0;
const failures = [];

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// HTTP 헬퍼
// ---------------------------------------------------------------------------
async function request(path, { method = "GET", token, key, body, prefer } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${token ?? key}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, ok: res.ok, body: json };
}

const rest = (path, opts = {}) =>
  request(`/rest/v1${path}`, { key: PUBLISHABLE, prefer: "return=representation", ...opts });

const admin = (path, opts = {}) => request(path, { key: SECRET, ...opts });

// ---------------------------------------------------------------------------
// 테스트 사용자
// ---------------------------------------------------------------------------
const stamp = Date.now();
const users = [];

async function createUser(tag) {
  const email = `rls-${tag}-${stamp}@verify.local`;
  const password = `Verify-${stamp}-${tag}!`;

  const created = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: { email, password, email_confirm: true },
  });
  if (!created.ok) {
    throw new Error(`사용자 생성 실패(${created.status}): ${JSON.stringify(created.body)}`);
  }

  const signedIn = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    key: PUBLISHABLE,
    body: { email, password },
  });
  if (!signedIn.ok) {
    throw new Error(`로그인 실패(${signedIn.status}): ${JSON.stringify(signedIn.body)}`);
  }

  const user = { tag, id: created.body.id, email, token: signedIn.body.access_token };
  users.push(user);
  return user;
}

async function cleanup() {
  for (const u of users) {
    const res = await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) console.log(`  (정리 실패: ${u.email} → ${res.status})`);
  }
}

// ---------------------------------------------------------------------------
// 본체
// ---------------------------------------------------------------------------
async function main() {
  console.log(`대상: ${URL_BASE}`);

  const a = await createUser("a");
  const b = await createUser("b");
  console.log(`테스트 사용자 2명 생성 (A=${a.id.slice(0, 8)}, B=${b.id.slice(0, 8)})`);

  // -- 1. 가입 트리거 -------------------------------------------------------
  section("1. 가입 트리거");

  const profile = await rest("/profiles?select=id,timezone", { token: a.token });
  check(
    "profile 1행 자동 생성",
    profile.ok && profile.body?.length === 1,
    `status=${profile.status} rows=${profile.body?.length}`,
  );
  check(
    "timezone 기본값 'Asia/Seoul'",
    profile.body?.[0]?.timezone === "Asia/Seoul",
    String(profile.body?.[0]?.timezone),
  );

  const cats = await rest("/categories?select=name,color,sort_order&order=sort_order", {
    token: a.token,
  });
  check("분야 프리셋 12행 생성", cats.ok && cats.body?.length === 12, `rows=${cats.body?.length}`);
  check("프리셋 첫 항목은 문학", cats.body?.[0]?.name === "문학", String(cats.body?.[0]?.name));
  check("프리셋 색상은 null(앱이 배정)", cats.body?.every((c) => c.color === null) === true);

  const catsB = await rest("/categories?select=id", { token: b.token });
  check(
    "B의 분야는 B 소유 12행 (A와 분리)",
    catsB.body?.length === 12,
    `rows=${catsB.body?.length}`,
  );

  // -- 2. CRUD 왕복 ---------------------------------------------------------
  section("2. CRUD 왕복 (A)");

  const literature =
    cats.body?.[0] &&
    (await rest("/categories?select=id&name=eq.%EB%AC%B8%ED%95%99", { token: a.token }));
  const categoryId = literature?.body?.[0]?.id ?? null;

  const bookRes = await rest("/books", {
    method: "POST",
    token: a.token,
    body: {
      user_id: a.id,
      title: "검증용 도서",
      authors: ["테스터"],
      format: "ebook",
      category_id: categoryId,
      isbn13: "9781234567897",
    },
  });
  check(
    "books insert",
    bookRes.ok && bookRes.body?.[0]?.id,
    `status=${bookRes.status} ${JSON.stringify(bookRes.body)}`,
  );
  const bookId = bookRes.body?.[0]?.id;

  const readingRes = await rest("/readings", {
    method: "POST",
    token: a.token,
    body: { user_id: a.id, book_id: bookId, progress_unit: "percent", target_value: 100 },
  });
  check(
    "readings insert (기본 상태 want)",
    readingRes.body?.[0]?.status === "want",
    JSON.stringify(readingRes.body),
  );
  const readingId = readingRes.body?.[0]?.id;

  const rpc = await rest("/rpc/record_progress", {
    method: "POST",
    token: a.token,
    body: { p_reading_id: readingId, p_value_to: 30, p_minutes: 25, p_memo: "1장까지" },
  });
  check("record_progress RPC 호출", rpc.ok, `status=${rpc.status} ${JSON.stringify(rpc.body)}`);
  check("want → reading 자동 승격", rpc.body?.status === "reading", String(rpc.body?.status));
  check("current_value 갱신 (30)", rpc.body?.current_value === 30, String(rpc.body?.current_value));
  check("started_at 자동 기록", Boolean(rpc.body?.started_at));

  const logs = await rest(
    `/progress_logs?select=value_from,value_to,minutes&reading_id=eq.${readingId}`,
    { token: a.token },
  );
  check("progress_logs 1행 기록", logs.body?.length === 1, `rows=${logs.body?.length}`);
  check(
    "value_from=0, value_to=30 (두 테이블 정합)",
    logs.body?.[0]?.value_from === 0 && logs.body?.[0]?.value_to === 30,
    JSON.stringify(logs.body?.[0]),
  );

  // 연속 기록: 다음 기록의 시작점이 직전 도달점과 이어져야 타임라인이 성립한다.
  const rpcAgain = await rest("/rpc/record_progress", {
    method: "POST",
    token: a.token,
    body: { p_reading_id: readingId, p_value_to: 55 },
  });
  check("두 번째 진행 기록", rpcAgain.ok, `status=${rpcAgain.status}`);
  check(
    "current_value 갱신 (55)",
    rpcAgain.body?.current_value === 55,
    String(rpcAgain.body?.current_value),
  );

  const chained = await rest(
    `/progress_logs?select=value_from,value_to&reading_id=eq.${readingId}&order=created_at`,
    { token: a.token },
  );
  check("progress_logs 2행", chained.body?.length === 2, `rows=${chained.body?.length}`);
  check(
    "두 번째 기록의 value_from이 직전 도달점(30)과 이어진다",
    chained.body?.[1]?.value_from === 30 && chained.body?.[1]?.value_to === 55,
    JSON.stringify(chained.body?.[1]),
  );

  // 되돌리는 기록도 허용한다 — 잘못 적은 값을 고치는 정당한 경우가 있다.
  const backward = await rest("/rpc/record_progress", {
    method: "POST",
    token: a.token,
    body: { p_reading_id: readingId, p_value_to: 40 },
  });
  check(
    "되돌아가는 기록 → 허용",
    backward.ok && backward.body?.current_value === 40,
    `status=${backward.status}`,
  );

  // -- 3. RLS 격리 ----------------------------------------------------------
  section("3. RLS 격리 (B가 A의 데이터에 접근)");

  const bSeesBooks = await rest("/books?select=id", { token: b.token });
  check("B의 books 목록은 0행", bSeesBooks.body?.length === 0, `rows=${bSeesBooks.body?.length}`);

  const bSeesBookById = await rest(`/books?select=id&id=eq.${bookId}`, { token: b.token });
  check(
    "B가 A의 book을 id로 조회 → 0행",
    bSeesBookById.body?.length === 0,
    `rows=${bSeesBookById.body?.length}`,
  );

  const bUpdate = await rest(`/books?id=eq.${bookId}`, {
    method: "PATCH",
    token: b.token,
    body: { title: "탈취 시도" },
  });
  check(
    "B가 A의 book UPDATE → 0행 반영",
    Array.isArray(bUpdate.body) && bUpdate.body.length === 0,
    `status=${bUpdate.status} ${JSON.stringify(bUpdate.body)}`,
  );

  const bDelete = await rest(`/books?id=eq.${bookId}`, { method: "DELETE", token: b.token });
  check(
    "B가 A의 book DELETE → 0행 반영",
    Array.isArray(bDelete.body) && bDelete.body.length === 0,
    `status=${bDelete.status} ${JSON.stringify(bDelete.body)}`,
  );

  const bRpc = await rest("/rpc/record_progress", {
    method: "POST",
    token: b.token,
    body: { p_reading_id: readingId, p_value_to: 99 },
  });
  check("B가 A의 reading에 RPC 호출 → 실패", !bRpc.ok, `status=${bRpc.status}`);

  const bInsertForA = await rest("/books", {
    method: "POST",
    token: b.token,
    body: { user_id: a.id, title: "A 사칭 등록" },
  });
  check("B가 user_id를 A로 위조해 insert → 거부", !bInsertForA.ok, `status=${bInsertForA.status}`);

  const stillIntact = await rest(`/books?select=title&id=eq.${bookId}`, { token: a.token });
  check(
    "A의 book은 원본 그대로",
    stillIntact.body?.[0]?.title === "검증용 도서",
    String(stillIntact.body?.[0]?.title),
  );

  const anonBooks = await rest("/books?select=id");
  check(
    "비로그인(publishable 키만)으로 books 조회 → 0행 또는 거부",
    !anonBooks.ok || anonBooks.body?.length === 0,
    `status=${anonBooks.status} rows=${anonBooks.body?.length}`,
  );

  // -- 4. 제약 --------------------------------------------------------------
  section("4. 제약 (위반은 거부되어야 한다)");

  const longReview = await rest(`/readings?id=eq.${readingId}`, {
    method: "PATCH",
    token: a.token,
    body: { review: "ㄱ".repeat(501) },
  });
  check("소감 501자 → 거부", !longReview.ok, `status=${longReview.status}`);

  const okReview = await rest(`/readings?id=eq.${readingId}`, {
    method: "PATCH",
    token: a.token,
    body: { review: "ㄱ".repeat(500) },
  });
  check(
    "소감 500자 → 허용",
    okReview.ok,
    `status=${okReview.status} ${JSON.stringify(okReview.body)}`,
  );

  const badRating = await rest(`/readings?id=eq.${readingId}`, {
    method: "PATCH",
    token: a.token,
    body: { rating: 4.3 },
  });
  check("별점 4.3 → 거부 (0.5 배수만)", !badRating.ok, `status=${badRating.status}`);

  const goodRating = await rest(`/readings?id=eq.${readingId}`, {
    method: "PATCH",
    token: a.token,
    body: { rating: 4.5 },
  });
  check("별점 4.5 → 허용", goodRating.ok, `status=${goodRating.status}`);

  const badPercentTarget = await rest("/readings", {
    method: "POST",
    token: a.token,
    body: {
      user_id: a.id,
      book_id: bookId,
      attempt_no: 2,
      progress_unit: "percent",
      target_value: 350,
    },
  });
  check(
    "percent 단위에 target_value=350 → 거부",
    !badPercentTarget.ok,
    `status=${badPercentTarget.status}`,
  );

  const pageNoTarget = await rest("/readings", {
    method: "POST",
    token: a.token,
    body: { user_id: a.id, book_id: bookId, attempt_no: 3, progress_unit: "page" },
  });
  check("page 단위에 target_value 없음 → 거부", !pageNoTarget.ok, `status=${pageNoTarget.status}`);

  const overshoot = await rest("/rpc/record_progress", {
    method: "POST",
    token: a.token,
    body: { p_reading_id: readingId, p_value_to: 120 },
  });
  check("진행 120% (분량 초과) → 거부", !overshoot.ok, `status=${overshoot.status}`);

  const finishedAtMissing = await rest(`/readings?id=eq.${readingId}`, {
    method: "PATCH",
    token: a.token,
    body: { status: "finished" },
  });
  check(
    "finished_at 없이 status=finished → 거부",
    !finishedAtMissing.ok,
    `status=${finishedAtMissing.status}`,
  );

  const finishOk = await rest(`/readings?id=eq.${readingId}`, {
    method: "PATCH",
    token: a.token,
    body: { status: "finished", finished_at: new Date().toISOString() },
  });
  check("finished_at과 함께 완독 처리 → 허용", finishOk.ok, `status=${finishOk.status}`);

  const afterFinish = await rest("/rpc/record_progress", {
    method: "POST",
    token: a.token,
    body: { p_reading_id: readingId, p_value_to: 50 },
  });
  check("완독된 독서에 진행 기록 → 거부", !afterFinish.ok, `status=${afterFinish.status}`);

  const dupIsbn = await rest("/books", {
    method: "POST",
    token: a.token,
    body: { user_id: a.id, title: "같은 ISBN 중복", isbn13: "9781234567897" },
  });
  check("같은 사용자·같은 ISBN13 중복 → 거부", !dupIsbn.ok, `status=${dupIsbn.status}`);

  const sameIsbnOtherUser = await rest("/books", {
    method: "POST",
    token: b.token,
    body: { user_id: b.id, title: "다른 사용자 같은 ISBN", isbn13: "9781234567897" },
  });
  check(
    "다른 사용자가 같은 ISBN13 → 허용",
    sameIsbnOtherUser.ok,
    `status=${sameIsbnOtherUser.status}`,
  );

  // -- 5. 재독 (W5) ---------------------------------------------------------
  section("5. 재독 — attempt_no");

  const secondAttempt = await rest("/readings", {
    method: "POST",
    token: a.token,
    body: {
      user_id: a.id,
      book_id: bookId,
      attempt_no: 2,
      progress_unit: "percent",
      target_value: 100,
    },
  });
  check("완독한 책에 2회독 추가 → 허용", secondAttempt.ok, `status=${secondAttempt.status}`);

  const duplicateAttempt = await rest("/readings", {
    method: "POST",
    token: a.token,
    body: {
      user_id: a.id,
      book_id: bookId,
      attempt_no: 2,
      progress_unit: "percent",
      target_value: 100,
    },
  });
  check("같은 회차 번호 중복 → 거부", !duplicateAttempt.ok, `status=${duplicateAttempt.status}`);

  const attempts = await rest(
    `/readings?select=attempt_no,status&book_id=eq.${bookId}&order=attempt_no`,
    { token: a.token },
  );
  check(
    "1회독 기록이 그대로 남아 있다",
    attempts.body?.length === 2,
    `rows=${attempts.body?.length}`,
  );
  check(
    "1회독은 완독 상태를 유지한다",
    attempts.body?.[0]?.status === "finished",
    String(attempts.body?.[0]?.status),
  );
  check(
    "2회독은 want로 시작한다",
    attempts.body?.[1]?.status === "want",
    String(attempts.body?.[1]?.status),
  );
}

// ---------------------------------------------------------------------------
try {
  await main();
} catch (err) {
  failures.push(`실행 중단: ${err.message}`);
  console.error(`\n실행 중단: ${err.message}`);
} finally {
  console.log("\n테스트 사용자 정리...");
  await cleanup();
}

console.log(`\n${"=".repeat(60)}`);
console.log(`통과 ${passed} · 실패 ${failures.length}`);
if (failures.length > 0) {
  console.log("\n실패 항목:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("V3 통합 검증 통과");
