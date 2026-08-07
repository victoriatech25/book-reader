import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/session";
import { createTestUser, deleteTestUser, type TestUser } from "./support/supabase-admin";

test.describe.serial("진행률 기록", () => {
  let user: TestUser;
  let page: Page;

  // 파일당 한 번만 로그인하고 페이지를 공유한다 (books.spec.ts와 같은 이유).
  test.beforeAll(async ({ browser }) => {
    user = await createTestUser("progress");
    page = await browser.newPage();
    await loginAs(page, user.email);
    await page.waitForURL("/");
  });

  test.afterAll(async () => {
    await page?.close();
    if (user) await deleteTestUser(user.id);
  });

  async function registerBook(page: Page, title: string, paperPages?: number) {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    // 값이 실제로 들어간 뒤 제출한다. 유실되면 required가 막아 원인을 알기 어렵다.
    await page.getByLabel("제목").fill(title);
    await expect(page.getByLabel("제목")).toHaveValue(title);

    if (paperPages) {
      // "소장 형태"와 겹치지 않도록 정확히 일치시킨다.
      await page.getByLabel("형태", { exact: true }).selectOption("paper");
      await page.getByLabel("페이지수").fill(String(paperPages));
    }

    await page.getByRole("button", { name: "서재에 담기" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
  }

  test("전자책은 %로 기록하고, want 상태는 읽는 중으로 자동 승격된다", async () => {
    await registerBook(page, "진행률 전자책");
    await expect(page.getByText("1회독 · 읽고 싶은")).toBeVisible();

    await page.getByLabel("진행률 (%)").first().fill("30");
    await page.getByLabel("읽은 시간 (분)").first().fill("25");
    await page.getByPlaceholder("한 줄 메모 (선택)").fill("1장까지");
    await page.getByRole("button", { name: "기록", exact: true }).click();

    // RPC가 want → reading 으로 올리고 시작일을 찍는다.
    await expect(page.getByText("1회독 · 읽는 중")).toBeVisible();
    await expect(page.getByText("30%", { exact: true })).toBeVisible();

    await page.getByText("진행 기록 1건").click();
    await expect(page.getByText("0% → 30%")).toBeVisible();
    await expect(page.getByText("25분")).toBeVisible();
    await expect(page.getByText("1장까지")).toBeVisible();
  });

  test("종이책은 쪽수로 기록한다", async () => {
    await registerBook(page, "진행률 종이책", 480);

    await page.getByLabel("현재 쪽").first().fill("120");
    await page.getByRole("button", { name: "기록", exact: true }).click();

    await expect(page.getByText("120 / 480쪽")).toBeVisible();
    // 상세 화면은 진행률을 숫자가 아니라 막대 폭으로 보여준다. 120/480 = 25%.
    await expect(page.locator('div[style*="width: 25%"]')).toBeVisible();
  });

  // W7.5 — 종이책을 페이지수 없이 담으면 %로 굳어버리던 것을 푼다 (PRD §3.1 F3).
  test("페이지수를 나중에 채우면 쪽 단위로 바꿀 수 있다", async () => {
    await registerBook(page, "단위 전환 검증용");
    // 형태만 종이책이고 페이지수가 없으므로 %로 시작한다.
    await expect(page.getByText("0%", { exact: true })).toBeVisible();

    // 페이지수가 없으면 쪽 단위로 못 간다고 알려준다.
    await page.getByRole("button", { name: "페이지 단위로 바꾸기" }).click();
    await expect(page.getByText(/페이지수가 없습니다/)).toBeVisible();

    // 도서 수정에서 페이지수를 채운 뒤 다시 시도한다.
    await page.getByRole("link", { name: "수정" }).click();
    await page.getByLabel("형태", { exact: true }).selectOption("paper");
    await page.getByLabel("페이지수").fill("300");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);

    await page.getByRole("button", { name: "페이지 단위로 바꾸기" }).click();
    await expect(page.getByText("0 / 300쪽")).toBeVisible();

    await page.getByLabel("현재 쪽").first().fill("150");
    await page.getByRole("button", { name: "기록", exact: true }).click();
    await expect(page.getByText("150 / 300쪽")).toBeVisible();

    // 기록이 생긴 뒤로는 막는다 — 지난 기록이 다른 눈금으로 읽히게 된다.
    await page.getByRole("button", { name: "퍼센트 단위로 바꾸기" }).click();
    await expect(page.getByText(/진행 기록이 1건 있어/)).toBeVisible();
    await expect(page.getByText("150 / 300쪽")).toBeVisible();
  });

  test("전체 분량을 넘는 값은 거부하고 사유를 보여준다", async () => {
    await registerBook(page, "상한 검증용", 300);

    // max 속성을 우회해 서버까지 보낸다 — 검증은 서버가 최종 판정한다.
    await page
      .getByLabel("현재 쪽")
      .first()
      .evaluate((input: HTMLInputElement) => {
        input.removeAttribute("max");
      });
    await page.getByLabel("현재 쪽").first().fill("301");
    await page.getByRole("button", { name: "기록", exact: true }).click();

    await expect(page.getByText("전체 300쪽을 넘을 수 없습니다.")).toBeVisible();
    await expect(page.getByText("0 / 300쪽")).toBeVisible();
  });

  test("되돌아가는 입력은 경고를 띄우되 막지는 않는다", async () => {
    await registerBook(page, "되돌리기 검증용");

    await page.getByLabel("진행률 (%)").first().fill("50");
    await page.getByRole("button", { name: "기록", exact: true }).click();
    await expect(page.getByText("50%", { exact: true })).toBeVisible();

    await page.getByLabel("진행률 (%)").first().fill("40");
    await expect(page.getByText(/보다 뒤로 갑니다/)).toBeVisible();

    await page.getByRole("button", { name: "기록", exact: true }).click();
    await expect(page.getByText("40%", { exact: true })).toBeVisible();

    await page.getByText("진행 기록 2건").click();
    await expect(page.getByText("50% → 40%")).toBeVisible();
  });

  test("홈의 빠른 기록으로 페이지 이동 없이 진행을 남긴다", async () => {
    await registerBook(page, "빠른 기록 검증용");
    await page.getByRole("button", { name: "읽기 시작" }).click();
    await expect(page.getByText("1회독 · 읽는 중")).toBeVisible();

    await page.goto("/");
    const card = page.locator("li", { hasText: "빠른 기록 검증용" }).first();
    await expect(card).toBeVisible();

    await card.getByLabel("진행률 (%)").fill("70");
    await card.getByRole("button", { name: "기록" }).click();

    // 왼쪽은 지금 어디인지, 오른쪽은 얼마나 남았는지.
    // exact가 곧 단정이다 — 예전에는 양쪽 다 "70%"라 이 로케이터가 둘을 물었다.
    await expect(card.getByText("70%", { exact: true })).toBeVisible();
    await expect(card.getByText("30% 남음")).toBeVisible();
    await expect(page).toHaveURL("/");
  });
});
