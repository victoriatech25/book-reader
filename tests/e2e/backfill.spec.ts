import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/session";
import { createTestUser, deleteTestUser, type TestUser } from "./support/supabase-admin";

/**
 * W13.5 이미 읽은 책 소급 등록.
 *
 * 검증·시각 변환은 단위 테스트가 덮는다. 여기서는 등록 한 번으로 완독까지
 * 되고 **통계에 실제로 잡히는지**를 본다 — 그게 이 기능의 목적이다.
 */
test.describe.serial("이미 읽은 책", () => {
  let user: TestUser;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    user = await createTestUser("backfill");
    page = await browser.newPage();
    await loginAs(page, user.email);
    await page.waitForURL("/");
  });

  test.afterAll(async () => {
    await page?.close();
    if (user) await deleteTestUser(user.id);
  });

  async function backfill(options: {
    title: string;
    month: string;
    rating?: string;
    review?: string;
    category?: string;
  }) {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    await page.getByLabel("제목").fill(options.title);
    await expect(page.getByLabel("제목")).toHaveValue(options.title);
    if (options.category) {
      await page.getByLabel("분야").selectOption({ label: options.category });
    }

    await page.getByLabel("이미 다 읽은 책이에요").check();
    await page.getByLabel("완독 시기").fill(options.month);
    if (options.rating) await page.getByLabel("별점").selectOption(options.rating);
    if (options.review) await page.getByLabel("한 줄 소감").fill(options.review);

    await page.getByRole("button", { name: "서재에 담기" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
  }

  test("체크하기 전에는 완독 입력이 숨어 있다", async () => {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();

    await expect(page.getByLabel("완독 시기")).toHaveCount(0);
    await page.getByLabel("이미 다 읽은 책이에요").check();
    await expect(page.getByLabel("완독 시기")).toBeVisible();
  });

  test("등록하자마자 완독 상태가 된다", async () => {
    await backfill({
      title: "소급 사피엔스",
      month: "2024-03",
      rating: "4.5",
      review: "몇 년 전에 읽었지만 아직 생각난다.",
      category: "역사",
    });

    // 읽는 중을 거치지 않고 바로 완독이다.
    await expect(page.getByText("1회독 · 완독")).toBeVisible();
    await expect(page.locator("p", { hasText: "★ 4.5" })).toBeVisible();
    await expect(page.locator("p", { hasText: "몇 년 전에 읽었지만" })).toBeVisible();

    // 완독일이 입력한 달의 1일로 찍힌다.
    await expect(page.getByText("2024. 03. 01.").first()).toBeVisible();

    // 다 읽은 책이므로 진행률이 꽉 차 있다.
    await expect(page.locator('div[style*="width: 100%"]')).toBeVisible();
  });

  test("완독한 책이라 진행 기록 폼이 없다", async () => {
    // 끝난 회차에는 기록할 수 없다(isTerminal).
    await expect(page.getByLabel("진행률 (%)")).toHaveCount(0);
  });

  // 요청의 핵심이다.
  test("통계에 반영된다", async () => {
    await backfill({ title: "소급 코스모스", month: "2024-11", rating: "5", category: "과학" });
    await backfill({ title: "소급 총균쇠", month: "2025-02", rating: "4", category: "역사" });

    await page.goto("/");

    // 올해(2026) 완독은 0권이다 — 과거에 읽은 책이니 올해로 잡히면 안 된다.
    await expect(page.getByRole("group", { name: "완독 0권" })).toBeVisible();
    // 읽은 시간은 기록이 없으므로 0이다.
    await expect(page.getByRole("group", { name: "독서 시간 0분" })).toBeVisible();

    // 서재에서는 완독 3권으로 잡힌다.
    await page.goto("/library");
    await expect(page.getByRole("button", { name: "완독 3권" })).toBeVisible();

    // 연도 필터가 완독 연도를 알아본다.
    await page.getByLabel("완독 연도").selectOption("2024");
    await expect(page.getByRole("link", { name: /소급 사피엔스/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /소급 코스모스/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /소급 총균쇠/ })).toHaveCount(0);
  });

  test("완독 시기를 안 넣으면 브라우저가 막는다", async () => {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    await page.getByLabel("제목").fill("시기 없는 책");
    await page.getByLabel("이미 다 읽은 책이에요").check();

    const valid = await page
      .getByLabel("완독 시기")
      .evaluate((element) => (element as HTMLInputElement).checkValidity());
    expect(valid).toBe(false);
  });

  test("체크를 풀면 예전처럼 위시리스트로 들어간다", async () => {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    await page.getByLabel("제목").fill("안 읽은 책");
    await expect(page.getByLabel("제목")).toHaveValue("안 읽은 책");

    await page.getByLabel("이미 다 읽은 책이에요").check();
    await page.getByLabel("이미 다 읽은 책이에요").uncheck();

    await page.getByRole("button", { name: "서재에 담기" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
    await expect(page.getByText("1회독 · 읽고 싶은")).toBeVisible();
  });
});
