import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/session";
import { createTestUser, deleteTestUser, type TestUser } from "./support/supabase-admin";

/**
 * W5 핵심 루프: 등록 → 상태 전이 → 재독 → 수정 → 삭제.
 * 한 사용자의 서재 상태를 이어가므로 순서대로 돌린다.
 */
test.describe.serial("도서 등록과 상태 전이", () => {
  let user: TestUser;
  let page: Page;

  // 파일당 한 번만 로그인하고 페이지를 공유한다. 테스트마다 로그인하면 Supabase
  // 인증 요청이 스무 번 넘게 몰려 간헐적으로 응답이 끊긴다.
  test.beforeAll(async ({ browser }) => {
    user = await createTestUser("books");
    page = await browser.newPage();
    await loginAs(page, user.email);
    await page.waitForURL("/");
  });

  test.afterAll(async () => {
    await page?.close();
    if (user) await deleteTestUser(user.id);
  });

  async function registerBook(page: Page, title: string) {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    // 값이 실제로 들어간 뒤 제출한다. 유실되면 required가 막아 원인을 알기 어렵다.
    await page.getByLabel("제목").fill(title);
    await expect(page.getByLabel("제목")).toHaveValue(title);
    await page.getByLabel("저자").fill("테스터");
    await page.getByRole("button", { name: "서재에 담기" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
  }

  test("직접 입력으로 등록하면 상세로 가고 want 상태의 1회독이 생긴다", async () => {
    await registerBook(page, "등록 검증용 책");

    await expect(page.getByRole("heading", { level: 1, name: "등록 검증용 책" })).toBeVisible();
    await expect(page.getByText("1회독 · 읽고 싶은")).toBeVisible();
    // 전자책이 기본이므로 퍼센트로 센다.
    await expect(page.getByText("0%", { exact: true })).toBeVisible();
  });

  test("서버 검증에 걸리면 저장하지 않고 사유를 한국어로 보여준다", async () => {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    await page.getByLabel("제목").fill("ISBN 검증용");

    await page.getByText("자세히 (부제 · 역자 · ISBN · 표지 · 메모)").click();
    await page.getByLabel("ISBN13").fill("123");

    await page.getByRole("button", { name: "서재에 담기" }).click();

    // Next의 라우트 안내 요소도 role="alert"라서 텍스트로 좁힌다.
    await expect(page.getByText("ISBN13은 숫자 13자리여야 합니다.")).toBeVisible();
    await expect(page).toHaveURL(/\/books\/new/);
  });

  test("읽기 시작 → 잠시 멈춤 → 다시 읽기 → 완독까지 전이한다", async () => {
    await registerBook(page, "상태 전이 검증용 책");

    await page.getByRole("button", { name: "읽기 시작" }).click();
    await expect(page.getByText("1회독 · 읽는 중")).toBeVisible();

    await page.getByRole("button", { name: "잠시 멈춤" }).click();
    await expect(page.getByText("1회독 · 잠시 멈춤")).toBeVisible();

    await page.getByRole("button", { name: "다시 읽기", exact: true }).click();
    await expect(page.getByText("1회독 · 읽는 중")).toBeVisible();

    // 완독은 별점·소감을 함께 받는 모달로 처리한다 (W7).
    await page.getByRole("button", { name: "완독" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "완독으로 저장" }).click();
    await expect(page.getByText("1회독 · 완독")).toBeVisible();

    // 완독은 종착점이라 더 이상 전이 버튼이 없다.
    await expect(page.getByRole("button", { name: "완독" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "잠시 멈춤" })).toHaveCount(0);
  });

  test("완독한 책은 기존 기록을 남긴 채 새 회차를 시작한다", async () => {
    await registerBook(page, "재독 검증용 책");

    await page.getByRole("button", { name: "읽기 시작" }).click();
    await page.getByRole("button", { name: "완독" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "완독으로 저장" }).click();
    await expect(page.getByText("1회독 · 완독")).toBeVisible();

    await page.getByRole("button", { name: "다시 읽기 (새 회차)" }).click();

    await expect(page.getByText("2회독 · 읽고 싶은")).toBeVisible();
    // 1회독 기록은 그대로 남아 있어야 한다 (PRD §2.1 A).
    await expect(page.getByText("1회독 · 완독")).toBeVisible();
  });

  test("중단하면 사유가 함께 남는다", async () => {
    await registerBook(page, "중단 검증용 책");

    await page.getByRole("button", { name: "읽기 시작" }).click();
    await page.getByPlaceholder("중단 사유 (선택)").fill("번역이 어렵다");
    await page.getByRole("button", { name: "중단" }).click();

    await expect(page.getByText("1회독 · 중단")).toBeVisible();
    await expect(page.getByText("중단 사유: 번역이 어렵다")).toBeVisible();
  });

  test("수정한 내용이 상세에 반영된다", async () => {
    await registerBook(page, "수정 전 제목");

    await page.getByRole("link", { name: "수정" }).click();
    await page.getByLabel("제목").fill("수정 후 제목");
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "수정 후 제목" })).toBeVisible();
  });

  test("등록한 책이 홈 목록에 보이고, 삭제하면 사라진다", async () => {
    await registerBook(page, "삭제 검증용 책");

    await page.goto("/");
    await expect(page.getByRole("link", { name: /삭제 검증용 책/ })).toBeVisible();

    await page.getByRole("link", { name: /삭제 검증용 책/ }).click();

    // W7.5부터 삭제는 확인을 한 번 거친다. cascade로 회차·기록·인용구까지
    // 함께 지워지므로 클릭 한 번에 사라지면 안 된다.
    const confirm = page.getByRole("dialog", { name: "이 책을 삭제할까요?" });
    await expect(confirm).toBeHidden();

    await page.getByRole("button", { name: "삭제", exact: true }).first().click();
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "삭제" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: /삭제 검증용 책/ })).toHaveCount(0);
  });
});
