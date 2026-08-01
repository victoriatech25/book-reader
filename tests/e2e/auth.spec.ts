import { expect, test } from "@playwright/test";

import {
  createTestUser,
  deleteTestUser,
  issueMagicLinkTokenHash,
  type TestUser,
} from "./support/supabase-admin";

test.describe("보호 라우트 (미로그인)", () => {
  test("홈에 들어가면 로그인 페이지로 보내고 원래 경로를 next로 남긴다", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "독서대" })).toBeVisible();
  });

  test("보호된 경로는 next 파라미터에 그대로 담긴다", async ({ page }) => {
    await page.goto("/library?status=reading");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/library?status=reading");
  });

  test("API는 리다이렉트가 아니라 401 JSON을 준다", async ({ request }) => {
    const response = await request.get("/api/book-search?q=사피엔스");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." },
    });
  });

  test("만료·위조된 링크는 로그인 페이지에 사유를 표시한다", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=invalid-token&type=magiclink");

    await expect(page).toHaveURL(/\/login\?error=link_invalid/);
    // Next의 라우트 안내 요소도 role="alert"라서 텍스트로 좁힌다.
    await expect(page.getByText("로그인 링크가 만료되었거나")).toBeVisible();
  });
});

// 한 사용자를 공유하므로 순서대로 돌린다.
test.describe.serial("매직링크 로그인", () => {
  let user: TestUser;

  test.beforeAll(async () => {
    user = await createTestUser("auth");
  });

  test.afterAll(async () => {
    if (user) await deleteTestUser(user.id);
  });

  test("링크로 들어오면 세션이 생기고 홈에 이메일이 보인다", async ({ page }) => {
    const tokenHash = await issueMagicLinkTokenHash(user.email);

    await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/`);

    await expect(page).toHaveURL("/");
    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
  });

  test("로그인 상태로 /login에 가면 홈으로 돌려보낸다", async ({ page }) => {
    const tokenHash = await issueMagicLinkTokenHash(user.email);
    await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/`);

    await page.goto("/login");

    await expect(page).toHaveURL("/");
  });

  test("로그아웃하면 세션이 끊기고 홈이 다시 막힌다", async ({ page }) => {
    const tokenHash = await issueMagicLinkTokenHash(user.email);
    await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/`);
    await expect(page.getByText(user.email)).toBeVisible();

    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("next가 외부 URL이면 홈으로 되돌린다 (오픈 리다이렉트 방어)", async ({ page }) => {
    const tokenHash = await issueMagicLinkTokenHash(user.email);

    await page.goto(
      `/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent("https://example.com")}`,
    );

    await expect(page).toHaveURL("/");
  });
});
