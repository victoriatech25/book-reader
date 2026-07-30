import { readFileSync } from "node:fs";

/**
 * E2E용 Supabase 관리자 헬퍼.
 *
 * 매직링크는 메일함을 거치므로 브라우저만으로는 자동화할 수 없다. 대신 관리자
 * API로 링크의 token_hash를 직접 발급받아 우리 /auth/confirm 라우트에 넣는다.
 * 우회가 아니라 실제 인증 경로를 그대로 통과시키는 방식이다(WORKPLAN §2 V4).
 */

function loadEnv(path = ".env.local"): Record<string, string> {
  const env: Record<string, string> = {};
  const raw = readFileSync(path, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }

  return env;
}

const env = loadEnv();

export const SUPABASE_URL = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SECRET_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SECRET_KEY) {
  throw new Error(
    "E2E에는 .env.local 의 NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.",
  );
}

async function adminFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SECRET_KEY,
      Authorization: `Bearer ${SECRET_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Supabase admin ${path} → ${response.status}: ${text}`);
  }

  return body;
}

export type TestUser = { id: string; email: string };

export async function createTestUser(tag: string): Promise<TestUser> {
  const email = `e2e-${tag}-${Date.now()}@verify.local`;
  const user = await adminFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, email_confirm: true }),
  });

  return { id: user.id, email };
}

/** 매직링크의 token_hash. /auth/confirm?token_hash=...&type=magiclink 로 쓴다. */
export async function issueMagicLinkTokenHash(email: string): Promise<string> {
  const result = await adminFetch("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "magiclink", email }),
  });

  // GoTrue는 최상위로, supabase-js는 properties 안에 담아준다. 둘 다 받는다.
  const hashedToken: string | undefined = result?.hashed_token ?? result?.properties?.hashed_token;

  if (!hashedToken) {
    throw new Error(`generate_link 응답에 hashed_token이 없습니다: ${JSON.stringify(result)}`);
  }

  return hashedToken;
}

export async function deleteTestUser(id: string): Promise<void> {
  await adminFetch(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
}
