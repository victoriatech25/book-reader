import { expect, test } from "@playwright/test";

// W0 스모크: 루트 페이지가 실제로 서빙되는지만 확인한다.
// 인증이 붙는 W3부터 세션 주입 헬퍼를 추가한다(WORKPLAN §2 V4).
test("루트 페이지가 앱 이름을 렌더한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "book-reader" })).toBeVisible();
});
