import { expect, test } from "@playwright/test";

// 앱이 실제로 서빙되는지 확인하는 최소 스모크.
// 인증 동작 자체는 auth.spec.ts가 다룬다.
test("로그인 페이지가 렌더된다", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { level: 1, name: "독서대" })).toBeVisible();
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인 링크 받기" })).toBeVisible();
});
