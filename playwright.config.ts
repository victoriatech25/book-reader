import { defineConfig, devices } from "@playwright/test";

// E2E는 전용 포트를 쓴다. 3000번은 다른 프로젝트의 개발 서버가 이미 쓰고 있는
// 경우가 있고, reuseExistingServer가 그걸 우리 앱으로 착각하면 테스트가
// 엉뚱한 앱을 검사하며 실패한다.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // 외부 URL을 대상으로 돌릴 때는 로컬 서버를 띄우지 않는다.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm dev --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
