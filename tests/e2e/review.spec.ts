import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/session";
import { createTestUser, deleteTestUser, type TestUser } from "./support/supabase-admin";

test.describe.serial("완독 · 소감 · 인용구", () => {
  let user: TestUser;
  let page: Page;

  // 파일당 한 번만 로그인하고 페이지를 공유한다 (books.spec.ts와 같은 이유).
  test.beforeAll(async ({ browser }) => {
    user = await createTestUser("review");
    page = await browser.newPage();
    await loginAs(page, user.email);
    await page.waitForURL("/");
  });

  test.afterAll(async () => {
    await page?.close();
    if (user) await deleteTestUser(user.id);
  });

  async function startReading(page: Page, title: string) {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    // 값이 실제로 들어간 뒤 제출한다. 유실되면 required가 막아 원인을 알기 어렵다.
    await page.getByLabel("제목").fill(title);
    await expect(page.getByLabel("제목")).toHaveValue(title);
    await page.getByRole("button", { name: "서재에 담기" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "읽기 시작" }).click();
    await expect(page.getByText("1회독 · 읽는 중")).toBeVisible();
  }

  test("완독과 소감을 한 화면에서 끝낸다", async () => {
    await startReading(page, "완독 검증용 책");

    await page.getByRole("button", { name: "완독" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("별점").selectOption("4.5");
    await dialog.getByLabel("한 줄 소감").fill("끝까지 붙잡고 읽었다.");
    await dialog.getByRole("button", { name: "완독으로 저장" }).click();

    await expect(page.getByText("1회독 · 완독")).toBeVisible();
    // 소감 수정 폼의 <option>에도 같은 문자열이 있으므로 표시용 문단으로 좁힌다.
    await expect(page.locator("p", { hasText: "★ 4.5" })).toBeVisible();
    // 수정 폼의 textarea 값에도 같은 문자열이 들어 있으므로 표시용 문단으로 좁힌다.
    await expect(page.locator("p", { hasText: "끝까지 붙잡고 읽었다." })).toBeVisible();

    // 완독일이 자동으로 찍힌다.
    await expect(page.getByText(/완독 \d{4}\. \d{2}\. \d{2}\./)).toBeVisible();
  });

  test("소감이 500자를 넘으면 서버가 거부한다", async () => {
    await startReading(page, "소감 길이 검증용");

    await page.getByRole("button", { name: "완독" }).click();
    const dialog = page.getByRole("dialog");

    // maxlength는 UI 방어일 뿐이다. 서버 검증이 실제로 도는지 확인한다.
    await dialog
      .getByLabel("한 줄 소감")
      .evaluate((el: HTMLTextAreaElement) => el.removeAttribute("maxlength"));
    await dialog.getByLabel("한 줄 소감").fill("ㄱ".repeat(501));
    await dialog.getByRole("button", { name: "완독으로 저장" }).click();

    await expect(page.getByText("소감은 500자까지 쓸 수 있습니다. (현재 501자)")).toBeVisible();
    await expect(page.getByText("1회독 · 읽는 중")).toBeVisible();
  });

  test("완독한 뒤 별점과 소감을 고칠 수 있다", async () => {
    await startReading(page, "소감 수정 검증용");

    await page.getByRole("button", { name: "완독" }).click();
    await page.getByRole("dialog").getByLabel("별점").selectOption("3");
    await page.getByRole("dialog").getByRole("button", { name: "완독으로 저장" }).click();
    await expect(page.locator("p", { hasText: "★ 3.0" })).toBeVisible();

    // 이미 별점이 있으면 요약 문구가 "고치기"가 된다.
    await page.getByText("별점·소감 고치기").click();
    await page.getByLabel("별점").selectOption("5");
    await page.getByLabel("한 줄 소감").fill("다시 보니 더 좋다.");
    await page.getByRole("button", { name: "소감 저장" }).click();

    await expect(page.locator("p", { hasText: "★ 5.0" })).toBeVisible();
    await expect(page.locator("p", { hasText: "다시 보니 더 좋다." })).toBeVisible();
  });

  test("인용구를 위치와 함께 남기고 즐겨찾기·삭제한다", async () => {
    await startReading(page, "인용구 검증용 책");

    await page.getByLabel("인용구 내용").fill("역사는 사람이 만든 이야기다.");
    await page.getByLabel("종류").selectOption("quote");
    await page.getByLabel("위치 (%)").fill("42");
    await page.getByRole("button", { name: "남기기" }).click();

    await expect(page.getByText("역사는 사람이 만든 이야기다.")).toBeVisible();
    await expect(page.getByText("인용 · 42%")).toBeVisible();
    // 저장 후 입력이 비워진다.
    await expect(page.getByLabel("인용구 내용")).toHaveValue("");

    await page.getByRole("button", { name: "즐겨찾기에 추가" }).click();
    await expect(page.getByRole("button", { name: "즐겨찾기 해제" })).toBeVisible();

    await page.getByRole("button", { name: "인용구 삭제" }).click();

    const confirm = page.getByRole("dialog", { name: "이 기록을 삭제할까요?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "삭제" }).click();

    await expect(page.getByText("역사는 사람이 만든 이야기다.")).toHaveCount(0);
  });

  test("인용구 위치가 전체를 넘으면 거부한다", async () => {
    await startReading(page, "인용 위치 검증용");

    await page.getByLabel("인용구 내용").fill("범위를 벗어난 위치");
    await page.getByLabel("위치 (%)").evaluate((el: HTMLInputElement) => el.removeAttribute("max"));
    await page.getByLabel("위치 (%)").fill("101");
    await page.getByRole("button", { name: "남기기" }).click();

    await expect(page.getByText("위치는 100%를 넘을 수 없습니다.")).toBeVisible();
  });
});
