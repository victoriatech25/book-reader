import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/session";
import { createTestUser, deleteTestUser, type TestUser } from "./support/supabase-admin";

/**
 * W11 테마 (PRD §3.1 F12).
 *
 * 선택 규칙 자체는 단위 테스트(tests/unit/theme.test.ts)가 덮는다.
 * 여기서는 화면이 실제로 바뀌고 새로고침 뒤에도 유지되는지만 본다.
 */
test.describe.serial("테마", () => {
  let user: TestUser;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    user = await createTestUser("theme");
    // OS는 라이트로 두고 시작한다. "시스템"이 이걸 따라가는지 봐야 한다.
    page = await browser.newPage({ colorScheme: "light" });
    await loginAs(page, user.email);
    await page.waitForURL("/");
  });

  test.afterAll(async () => {
    await page?.close();
    if (user) await deleteTestUser(user.id);
  });

  /*
   * 실제로 적용된 테마를 본다. 시스템 모드에서는 클래스를 붙이지 않고 CSS의
   * prefers-color-scheme 규칙이 처리하므로, 클래스가 아니라 결과를 봐야 한다.
   * globals.css가 :root와 .dark에 color-scheme을 각각 선언해둔다.
   */
  const applied = () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  const stored = () => page.evaluate(() => window.localStorage.getItem("theme"));

  // 라디오 자체는 sr-only라 직접 못 누른다. 사용자가 누르는 것은 라벨이다.
  // fieldset의 legend가 "테마"라 그룹으로 좁힐 수 있다.
  const pick = (label: string) =>
    page.getByRole("group", { name: "테마" }).first().getByText(label, { exact: true }).click();

  test("기본은 시스템 설정을 따른다", async () => {
    await page.goto("/");
    expect(await applied()).toBe("light");
    // 시스템은 키를 저장하지 않는다 — 클래스도 붙지 않는다.
    expect(await stored()).toBeNull();
    expect(await page.evaluate(() => document.documentElement.className)).not.toContain("light");
  });

  test("다크를 고르면 즉시 바뀌고 저장된다", async () => {
    await page.goto("/");
    await pick("다크");

    expect(await applied()).toBe("dark");
    expect(await stored()).toBe("dark");
    // 화면 색만 바뀌고 선택 표시가 안 따라오면 뭘 고른 건지 알 수 없다.
    await expect(page.getByRole("radio", { name: "다크" }).first()).toBeChecked();
  });

  test("새로고침해도 유지되고 깜빡이지 않는다", async () => {
    await page.goto("/");
    // 첫 페인트 스크립트가 붙이므로 로드 직후 이미 dark다.
    expect(await applied()).toBe("dark");
    await expect(page.getByRole("radio", { name: "다크" }).first()).toBeChecked();
  });

  // OS가 라이트인데 다크로 고정했으므로, 시스템으로 되돌리면 라이트로 가야 한다.
  test("시스템으로 되돌리면 OS 설정으로 돌아간다", async () => {
    await page.goto("/");
    await pick("시스템 설정");

    expect(await applied()).toBe("light");
    expect(await stored()).toBeNull();
  });

  test("시스템일 때 OS가 다크로 바뀌면 따라간다", async () => {
    await page.goto("/");

    // 클래스를 안 붙이므로 CSS가 직접 반응한다. JS 리스너가 필요 없다.
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await applied()).toBe("dark");

    await page.emulateMedia({ colorScheme: "light" });
    expect(await applied()).toBe("light");
  });

  test("라이트로 고정하면 OS가 다크여도 라이트를 지킨다", async () => {
    await page.goto("/");
    await pick("라이트");
    await page.emulateMedia({ colorScheme: "dark" });

    expect(await applied()).toBe("light");
    expect(await stored()).toBe("light");

    await page.emulateMedia({ colorScheme: "light" });
  });

  test("설정 화면에도 같은 선택이 보인다", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("radio", { name: "라이트" })).toBeChecked();
  });

  /*
   * 세피아는 color-scheme이 light라 applied()로는 라이트와 구분되지 않는다.
   * 실제로 칠해진 배경색을 본다.
   */
  test("세피아는 OS가 다크여도 미색을 지킨다", async () => {
    await page.goto("/");
    await pick("세피아");

    expect(await stored()).toBe("sepia");
    await expect(page.getByRole("radio", { name: "세피아" }).first()).toBeChecked();

    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const sepia = await background();
    expect(sepia).not.toBe("rgb(250, 249, 247)"); // 라이트
    expect(sepia).not.toBe("rgb(28, 26, 24)"); // 다크

    await page.emulateMedia({ colorScheme: "dark" });
    expect(await background()).toBe(sepia);
    await page.emulateMedia({ colorScheme: "light" });

    // 첫 페인트 스크립트도 세피아를 알아야 새로고침에서 안 깜빡인다.
    await page.reload();
    expect(await background()).toBe(sepia);
    expect(await page.evaluate(() => document.documentElement.className)).toContain("theme-sepia");
  });

  // Tailwind의 .sepia는 filter: sepia() 유틸리티다. 이름이 겹치면 화면 전체에
  // 필터가 걸린다. 클래스 이름을 theme-sepia로 피한 이유가 이것이다.
  test("세피아 테마가 화면에 필터를 걸지 않는다", async () => {
    await page.goto("/");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).filter)).toBe(
      "none",
    );
  });

  test("본문 바로가기 링크가 키보드로 잡힌다", async () => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skip = page.getByRole("link", { name: "본문 바로가기" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });
});
