import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/session";
import { createTestUser, deleteTestUser, type TestUser } from "./support/supabase-admin";

/**
 * W8 분류: 분야(단일) · 태그(다중·자유 입력) · 서재(임의 묶음).
 *
 * 파일당 한 번만 로그인하고 페이지를 공유한다 (books.spec.ts와 같은 이유).
 */
test.describe.serial("분야 · 태그 · 서재", () => {
  let user: TestUser;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    user = await createTestUser("taxonomy");
    page = await browser.newPage();
    await loginAs(page, user.email);
    await page.waitForURL("/");
  });

  test.afterAll(async () => {
    await page?.close();
    if (user) await deleteTestUser(user.id);
  });

  async function registerBook(title: string, options: { category?: string; tags?: string } = {}) {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    await page.getByLabel("제목").fill(title);
    await expect(page.getByLabel("제목")).toHaveValue(title);

    if (options.category) await page.getByLabel("분야").selectOption({ label: options.category });
    if (options.tags) await page.getByLabel("태그").fill(options.tags);

    await page.getByRole("button", { name: "서재에 담기" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
  }

  test("가입 시 분야 프리셋 12종이 설정에 보인다", async () => {
    await page.goto("/settings");
    // 프리셋은 가입 트리거가 사용자 소유 행으로 복사한다 (PRD §2.3).
    await expect(page.getByLabel("문학 이름")).toHaveValue("문학");
    await expect(page.getByLabel("기타 이름")).toHaveValue("기타");
  });

  test("등록할 때 분야와 태그를 함께 붙인다", async () => {
    await registerBook("분류 검증용 책", { category: "과학", tags: "SF, 번역서" });

    await expect(page.getByText("과학", { exact: true })).toBeVisible();
    await expect(page.getByText("#SF")).toBeVisible();
    await expect(page.getByText("#번역서")).toBeVisible();
  });

  // 자유 입력이라 표기가 흔들린다. 같은 태그로 취급해야 사전이 안 지저분해진다.
  test("대소문자만 다른 태그는 새로 만들지 않는다", async () => {
    await registerBook("태그 중복 검증용", { tags: "sf" });
    await expect(page.getByText("#SF")).toBeVisible();

    await page.goto("/settings");
    // 사전에는 여전히 SF 하나뿐이다.
    await expect(page.getByLabel("SF 이름")).toHaveCount(1);
  });

  test("수정에서 태그를 바꾸면 붙고 떨어진다", async () => {
    await registerBook("태그 수정 검증용", { tags: "처음태그" });
    await page.getByRole("link", { name: "수정" }).click();

    await expect(page.getByLabel("태그")).toHaveValue("처음태그");
    await page.getByLabel("태그").fill("나중태그, 추가태그");
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page.getByText("#나중태그")).toBeVisible();
    await expect(page.getByText("#추가태그")).toBeVisible();
    await expect(page.getByText("#처음태그")).toHaveCount(0);
  });

  test("태그를 합치면 책이 남길 태그로 옮겨간다", async () => {
    await page.goto("/settings");

    await page.getByLabel("합칠 태그").selectOption("나중태그");
    await page.getByLabel("남길 태그").selectOption("추가태그");
    await page.getByRole("button", { name: "합치기" }).click();

    // 합친 태그는 사전에서 사라진다.
    await expect(page.getByLabel("나중태그 이름")).toHaveCount(0);
    await expect(page.getByLabel("추가태그 이름")).toHaveValue("추가태그");
  });

  test("같은 태그끼리는 합칠 수 없다", async () => {
    await page.goto("/settings");
    await page.getByLabel("합칠 태그").selectOption("SF");
    await page.getByLabel("남길 태그").selectOption("SF");
    await page.getByRole("button", { name: "합치기" }).click();

    await expect(page.getByText("같은 태그끼리는 합칠 수 없습니다.")).toBeVisible();
  });

  test("분야를 추가하고 이름을 고친다", async () => {
    await page.goto("/settings");

    await page.getByLabel("새 분야 이름").fill("만화");
    await page.getByRole("button", { name: "분야 추가" }).click();
    await expect(page.getByLabel("만화 이름")).toHaveValue("만화");

    await page.getByLabel("만화 이름").fill("그래픽노블");
    await page.getByRole("button", { name: "만화 저장" }).click();

    await expect(page.getByLabel("그래픽노블 이름")).toHaveValue("그래픽노블");
  });

  // 분야를 지워도 책은 남아야 한다 (FK on delete set null).
  test("분야를 삭제해도 그 분야를 쓰던 책은 남는다", async () => {
    await page.goto("/settings");

    await page.getByRole("button", { name: "과학 삭제" }).click();
    const confirm = page.getByRole("dialog", { name: '"과학" 분야를 삭제할까요?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "삭제" }).click();

    await expect(page.getByLabel("과학 이름")).toHaveCount(0);

    // W10부터 홈은 대시보드다. 책 목록은 서재에 있다.
    await page.goto("/library");
    await expect(page.getByRole("link", { name: /분류 검증용 책/ })).toBeVisible();
  });

  test("서재를 만들고 책을 담았다 뺀다", async () => {
    await page.goto("/settings");
    await page.getByLabel("새 서재 이름").fill("2026 상반기");
    await page.getByRole("button", { name: "서재 만들기" }).click();
    await expect(page.getByLabel("2026 상반기 이름")).toHaveValue("2026 상반기");

    await page.goto("/library");
    await page.getByRole("link", { name: /분류 검증용 책/ }).click();

    const shelfButton = page.getByRole("button", { name: /2026 상반기/ });
    await expect(shelfButton).toHaveAttribute("aria-pressed", "false");

    await shelfButton.click();
    await expect(page.getByRole("button", { name: /2026 상반기/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: /2026 상반기/ }).click();
    await expect(page.getByRole("button", { name: /2026 상반기/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("서재에 담은 권수가 설정에 반영된다", async () => {
    await page.goto("/library");
    await page.getByRole("link", { name: /분류 검증용 책/ }).click();
    await page.getByRole("button", { name: /2026 상반기/ }).click();
    await expect(page.getByRole("button", { name: /2026 상반기/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.goto("/settings");
    // 삭제 안내 문구에도 권수가 들어가므로 숫자 표시만 정확히 집는다.
    const row = page.locator("li", { has: page.getByLabel("2026 상반기 이름") });
    await expect(row.getByText("1권", { exact: true })).toBeVisible();
  });
});
