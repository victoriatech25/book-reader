import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/session";
import { createTestUser, deleteTestUser, type TestUser } from "./support/supabase-admin";

/**
 * W13 PWA (PRD §3.2 F16).
 *
 * 서비스워커는 프로덕션에서만 등록한다(개발 중 캐시가 끼면 코드를 고쳐도 옛
 * 화면이 뜬다). E2E는 프로덕션 빌드를 대상으로 돌므로 여기서 검증할 수 있다.
 */
test.describe.serial("PWA", () => {
  let user: TestUser;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    user = await createTestUser("pwa");
    page = await browser.newPage();
    await loginAs(page, user.email);
    await page.waitForURL("/");
  });

  test.afterAll(async () => {
    await page?.close();
    if (user) await deleteTestUser(user.id);
  });

  test("매니페스트가 홈 화면 추가에 필요한 값을 담는다", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.name).toContain("독서대");
    expect(manifest.short_name).toBe("독서대");
    // standalone이어야 브라우저 껍데기 없이 뜬다.
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.lang).toBe("ko");

    // 안드로이드 설치 조건: 192·512 아이콘과 maskable 하나.
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === "maskable")).toBe(
      true,
    );
  });

  test("아이콘이 실제 PNG로 나온다", async ({ request }) => {
    for (const size of [192, 512]) {
      const response = await request.get(`/icons/${size}`);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toContain("image/png");

      // PNG 시그니처. 빈 응답이나 에러 페이지가 아님을 확인한다.
      const body = await response.body();
      expect(body.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }
  });

  test("없는 크기는 404다", async ({ request }) => {
    expect((await request.get("/icons/999")).status()).toBe(404);
  });

  test("문서에 매니페스트와 테마 색이 연결돼 있다", async () => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      /manifest\.webmanifest/,
    );
    // 주소창 색이 배경과 같아야 화면이 이어져 보인다.
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveCount(1);
  });

  test("서비스워커가 등록된다", async () => {
    await page.goto("/");

    const registered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return Boolean(registration);
    });
    expect(registered).toBe(true);
  });

  test("오프라인 안내는 로그인 없이도 열린다", async ({ browser }) => {
    // 세션을 확인할 수 없을 때 보여주는 화면이라 보호 라우트면 안 된다.
    const anon = await browser.newPage();
    try {
      await anon.goto("/offline");
      await expect(anon).toHaveURL("/offline");
      await expect(anon.getByRole("heading", { name: "연결이 끊겼습니다" })).toBeVisible();
    } finally {
      await anon.close();
    }
  });

  test("서비스워커가 인증·데이터 경로는 캐시하지 않는다", async () => {
    await page.goto("/");

    // sw.js의 규칙을 직접 확인한다 — 여기가 뚫리면 남의 응답이 남을 수 있다.
    const source = await page.evaluate(async () => {
      const response = await fetch("/sw.js");
      return response.text();
    });

    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('url.pathname.startsWith("/auth/")');
    expect(source).toContain("url.origin !== self.location.origin");
    // 로그아웃 때 방문 기록을 지우는 경로가 살아 있어야 한다.
    expect(source).toContain("clear-pages");
  });
});
