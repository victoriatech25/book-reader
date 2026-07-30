import { defineConfig, devices } from "@playwright/test";

// E2E는 전용 포트를 쓴다. 3000번은 다른 프로젝트의 개발 서버가 이미 쓰고 있는
// 경우가 있고, reuseExistingServer가 그걸 우리 앱으로 착각하면 테스트가
// 엉뚱한 앱을 검사하며 실패한다.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // 테스트마다 Supabase 인증을 새로 타므로 워커를 늘리면 요청이 몰려 간헐적으로
  // 응답이 끊긴다(TLS 오류·타임아웃). 순차 실행이면 전 구간이 안정적이고
  // 프로덕션 빌드 기준 테스트당 1~2초라 전체도 1분 안쪽이다.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // 개발 서버는 라우트를 요청 시점에 컴파일한다. 워커 여럿이 같은 서버를 치면
  // 첫 요청이 기본 5초를 쉽게 넘기므로 단정 제한을 넉넉히 둔다.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // 외부 URL을 대상으로 돌릴 때는 로컬 서버를 띄우지 않는다.
  //
  // 개발 서버가 아니라 프로덕션 빌드를 띄운다. 개발 서버는 라우트를 요청 시점에
  // 컴파일하는데, 테스트가 쌓이면 응답이 들쭉날쭉해져 엉뚱한 곳에서 타임아웃이
  // 났다. 빌드 산출물을 그대로 검증하는 편이 실제 배포와도 가깝다.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm exec next start --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
