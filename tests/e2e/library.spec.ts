import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/session";
import { createTestUser, deleteTestUser, type TestUser } from "./support/supabase-admin";

/**
 * W9 서재: 상태 탭 · 분야/태그/별점/연도 필터 · 검색 · 정렬 · 뷰 전환.
 *
 * 필터 조합 자체는 단위 테스트(tests/unit/library.test.ts)가 전수로 덮는다.
 * 여기서는 화면이 그 로직에 제대로 연결돼 있는지만 본다.
 */
test.describe.serial("서재", () => {
  let user: TestUser;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    user = await createTestUser("library");
    page = await browser.newPage();
    await loginAs(page, user.email);
    await page.waitForURL("/");

    await register(page, "사피엔스", { category: "역사", tags: "번역서, 추천받음" });
    await finish(page, "4.5");

    await register(page, "코스모스", { category: "과학", tags: "번역서" });
    await readTo(page, "40");

    await register(page, "백석 시집", { category: "문학" });
  });

  test.afterAll(async () => {
    await page?.close();
    if (user) await deleteTestUser(user.id);
  });

  async function register(
    page: Page,
    title: string,
    options: { category?: string; tags?: string } = {},
  ) {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    await page.getByLabel("제목").fill(title);
    await expect(page.getByLabel("제목")).toHaveValue(title);
    if (options.category) await page.getByLabel("분야").selectOption({ label: options.category });
    if (options.tags) await page.getByLabel("태그").fill(options.tags);
    await page.getByRole("button", { name: "서재에 담기" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
  }

  async function readTo(page: Page, percent: string) {
    await page.getByLabel("진행률 (%)").first().fill(percent);
    await page.getByRole("button", { name: "기록", exact: true }).click();
    await expect(page.getByText("1회독 · 읽는 중")).toBeVisible();
  }

  async function finish(page: Page, rating: string) {
    await readTo(page, "100");
    await page.getByRole("button", { name: "완독" }).click();
    await page.getByLabel("별점").selectOption(rating);
    await page.getByRole("button", { name: "완독으로 저장" }).click();
    await expect(page.getByText("1회독 · 완독")).toBeVisible();
  }

  test("전량이 보이고 상태 탭에 권수가 붙는다", async () => {
    await page.goto("/library");

    await expect(page.getByRole("button", { name: "전체 3권" })).toBeVisible();
    await expect(page.getByRole("button", { name: "완독 1권" })).toBeVisible();
    await expect(page.getByRole("button", { name: "읽는 중 1권" })).toBeVisible();
    await expect(page.getByRole("button", { name: "읽고 싶은 1권" })).toBeVisible();
  });

  test("상태 탭으로 거른다", async () => {
    await page.goto("/library");
    await page.getByRole("button", { name: "완독 1권" }).click();

    await expect(page.getByRole("link", { name: /사피엔스/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /코스모스/ })).toHaveCount(0);
  });

  test("검색은 제목·저자·태그에 걸린다", async () => {
    await page.goto("/library");
    await page.getByLabel("서재 검색").fill("코스모");
    await expect(page.getByRole("link", { name: /코스모스/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /사피엔스/ })).toHaveCount(0);

    // 태그로도 찾는다 — 번역서가 붙은 두 권.
    await page.getByLabel("서재 검색").fill("번역서");
    await expect(page.getByRole("link", { name: /사피엔스/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /코스모스/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /백석 시집/ })).toHaveCount(0);
  });

  test("분야와 태그로 거른다", async () => {
    await page.goto("/library");

    await page.getByLabel("분야").selectOption({ label: "과학" });
    await expect(page.getByRole("link", { name: /코스모스/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /사피엔스/ })).toHaveCount(0);

    await page.getByRole("button", { name: "필터 지우기" }).click();
    await page.getByLabel("태그").selectOption("추천받음");
    await expect(page.getByRole("link", { name: /사피엔스/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /코스모스/ })).toHaveCount(0);
  });

  test("별점 필터는 별점 없는 책을 빼고 센다", async () => {
    await page.goto("/library");
    await page.getByLabel("별점").selectOption("4");

    await expect(page.getByRole("link", { name: /사피엔스/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /코스모스/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /백석 시집/ })).toHaveCount(0);
  });

  test("조건이 겹치면 AND로 걸리고 필터를 지우면 되돌아온다", async () => {
    await page.goto("/library");

    await page.getByLabel("태그").selectOption("번역서");
    await page.getByRole("button", { name: "완독 1권" }).click();
    await expect(page.getByRole("link", { name: /사피엔스/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /코스모스/ })).toHaveCount(0);

    await page.getByRole("button", { name: "필터 지우기" }).click();
    await expect(page.getByRole("link", { name: /코스모스/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "필터 지우기" })).toHaveCount(0);
  });

  test("정렬을 바꾸면 순서가 바뀐다", async () => {
    await page.goto("/library");
    const rows = page.getByRole("listitem");

    // 기본은 최근 업데이트순 — 마지막에 등록한 백석 시집이 맨 위.
    await expect(rows.nth(0)).toContainText("백석 시집");

    // 제목순이면 ko-KR 기준 백석 시집 → 사피엔스 → 코스모스.
    await page.getByLabel("정렬").selectOption("title");
    await expect(rows.nth(0)).toContainText("백석 시집");
    await expect(rows.nth(1)).toContainText("사피엔스");
    await expect(rows.nth(2)).toContainText("코스모스");

    // 별점순이면 유일하게 별점이 있는 사피엔스가 맨 위.
    await page.getByLabel("정렬").selectOption("rating");
    await expect(rows.nth(0)).toContainText("사피엔스");
  });

  test("조건에 맞는 책이 없으면 안내가 나온다", async () => {
    await page.goto("/library");
    await page.getByLabel("서재 검색").fill("존재하지않는책");
    await expect(page.getByText("조건에 맞는 책이 없습니다. 필터를 지워보세요.")).toBeVisible();
  });

  test("그리드와 리스트를 오간다", async () => {
    await page.goto("/library");

    await expect(page.getByRole("button", { name: "리스트" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "그리드" }).click();
    await expect(page.getByRole("button", { name: "그리드" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("link", { name: /사피엔스/ })).toBeVisible();
  });
});
