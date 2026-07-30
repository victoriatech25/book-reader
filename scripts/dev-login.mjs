/**
 * 로컬 확인용 임시 로그인 링크 발급.
 *
 * 화면을 눈으로 확인해야 할 때(WORKPLAN §2 V5) 매직링크 메일을 기다리지 않기
 * 위한 도구다. 임시 사용자를 만들고 /auth/confirm 링크를 출력한다.
 *
 *   node scripts/dev-login.mjs [포트]    임시 사용자 생성 + 링크 출력
 *   node scripts/dev-login.mjs --cleanup 임시 사용자 전체 삭제
 *
 * 임시 사용자는 @verify.local 도메인을 쓴다. 실제 계정과 섞이지 않는다.
 * 로컬 개발 전용이며 서비스 롤 키가 필요하다.
 */

import { readFileSync } from "node:fs";

const TEST_DOMAIN = "@verify.local";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]),
);

const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const secret = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !secret) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.",
  );
  process.exit(1);
}

async function admin(path, init = {}) {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`${path} → ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

if (process.argv.includes("--cleanup")) {
  const { users } = await admin("/auth/v1/admin/users?per_page=200");
  const temporary = users.filter((user) => user.email?.endsWith(TEST_DOMAIN));

  for (const user of temporary) {
    await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
    console.log(`삭제: ${user.email}`);
  }

  console.log(`임시 사용자 ${temporary.length}명 정리 완료`);
  process.exit(0);
}

const port = process.argv[2] ?? "3000";
const email = `dev-${Date.now()}${TEST_DOMAIN}`;

await admin("/auth/v1/admin/users", {
  method: "POST",
  body: JSON.stringify({ email, email_confirm: true }),
});

const link = await admin("/auth/v1/admin/generate_link", {
  method: "POST",
  body: JSON.stringify({ type: "magiclink", email }),
});

const tokenHash = link?.hashed_token ?? link?.properties?.hashed_token;

console.log(`임시 사용자: ${email}`);
console.log(
  `\nhttp://localhost:${port}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/`,
);
console.log(`\n확인이 끝나면: node scripts/dev-login.mjs --cleanup`);
