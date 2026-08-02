import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/session";
import { createTestUser, deleteTestUser, type TestUser } from "./support/supabase-admin";

/**
 * W10 대시보드: 올해 요약 · 목표 · 차트 · 최근 인용구.
 *
 * 집계 계산 자체는 단위 테스트(tests/unit/stats.test.ts)가 전수로 덮는다.
 * 여기서는 화면이 실제 DB 값과 이어져 있는지만 본다.
 */
test.describe.serial("대시보드", () => {
  let user: TestUser;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    user = await createTestUser("dashboard");
    page = await browser.newPage();
    await loginAs(page, user.email);
    await page.waitForURL("/");
  });

  test.afterAll(async () => {
    await page?.close();
    if (user) await deleteTestUser(user.id);
  });

  async function register(title: string, category?: string) {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    await page.getByLabel("제목").fill(title);
    await expect(page.getByLabel("제목")).toHaveValue(title);
    if (category) await page.getByLabel("분야").selectOption({ label: category });
    await page.getByRole("button", { name: "서재에 담기" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
  }

  test("책이 없으면 0으로 시작한다", async () => {
    await page.goto("/");
    // 제목 옆 앱 마크. 장식이라 aria-hidden이므로 역할이 아니라 요소로 본다.
    await expect(page.locator("h1 svg")).toBeVisible();
    await expect(page.getByRole("group", { name: "완독 0권" })).toBeVisible();
    await expect(page.getByText("완독한 책이 아직 없습니다.")).toBeVisible();
    await expect(page.getByText("아직 목표가 없습니다. 아래에서 세워보세요.")).toBeVisible();
  });

  test("완독하면 올해 요약과 분야 도넛에 반영된다", async () => {
    await register("통계 검증용 책", "과학");

    await page.getByLabel("진행률 (%)").first().fill("100");
    await page.getByLabel("읽은 시간 (분)").first().fill("90");
    await page.getByRole("button", { name: "기록", exact: true }).click();
    await expect(page.getByText("1회독 · 읽는 중")).toBeVisible();

    await page.getByRole("button", { name: "완독" }).click();
    await page.getByLabel("별점").selectOption("4.5");
    await page.getByRole("button", { name: "완독으로 저장" }).click();
    await expect(page.getByText("1회독 · 완독")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("group", { name: "완독 1권" })).toBeVisible();
    await expect(page.getByRole("group", { name: "독서 시간 1시간 30분" })).toBeVisible();
    await expect(page.getByRole("group", { name: "평균 별점 ★ 4.5" })).toBeVisible();

    // 도넛은 접근성 이름에 분포를 그대로 담는다.
    await expect(page.getByRole("img", { name: /분야 분포. 전체 1권. 과학 1권/ })).toBeVisible();
  });

  test("진행을 기록하면 연속 기록이 1일이 된다", async () => {
    await page.goto("/");
    await expect(page.getByRole("group", { name: "연속 기록 1일" })).toBeVisible();
  });

  test("연간 권수 목표를 세우면 게이지가 달성률을 보여준다", async () => {
    await page.goto("/");

    await page.getByLabel("목표 기간").selectOption("year");
    await page.getByLabel("목표 지표").selectOption("books");
    await page.getByLabel("목표치").fill("4");
    await page.getByRole("button", { name: "목표 세우기" }).click();

    // 1 / 4 = 25%
    const gauge = page.getByRole("progressbar", { name: "연간 권수 목표 달성률" });
    await expect(gauge).toBeVisible();
    await expect(gauge).toHaveAttribute("aria-valuenow", "25");
    await expect(page.getByText("1권 / 4권")).toBeVisible();
    await expect(page.getByText("3권 남았습니다.")).toBeVisible();
  });

  test("같은 목표를 다시 세우면 새로 만들지 않고 목표치를 갈아끼운다", async () => {
    await page.goto("/");

    await page.getByLabel("목표 기간").selectOption("year");
    await page.getByLabel("목표 지표").selectOption("books");
    await page.getByLabel("목표치").fill("2");
    await page.getByRole("button", { name: "목표 세우기" }).click();

    await expect(page.getByText("1권 / 2권")).toBeVisible();
    // 목표가 두 개로 늘지 않았다.
    await expect(page.getByRole("progressbar", { name: /연간 권수/ })).toHaveCount(1);
  });

  test("월간 시간 목표는 분 단위로 센다", async () => {
    await page.goto("/");

    await page.getByLabel("목표 기간").selectOption("month");
    await page.getByLabel("목표 지표").selectOption("minutes");
    await page.getByLabel("목표치").fill("180");
    await page.getByRole("button", { name: "목표 세우기" }).click();

    // 90분 기록 / 180분 목표 = 50%
    const gauge = page.getByRole("progressbar", { name: "월간 독서 시간(분) 목표 달성률" });
    await expect(gauge).toHaveAttribute("aria-valuenow", "50");
    await expect(page.getByText("1시간 30분 / 3시간")).toBeVisible();
  });

  // 목표치는 두 겹으로 막는다. 브라우저(min=1)와 서버 액션.
  test("0 이하는 브라우저가 먼저 막는다", async () => {
    await page.goto("/");
    await page.getByLabel("목표치").fill("0");

    const valid = await page
      .getByLabel("목표치")
      .evaluate((element) => (element as HTMLInputElement).checkValidity());
    expect(valid).toBe(false);
  });

  test("목표치를 비우면 서버가 거부한다", async () => {
    await page.goto("/");
    await page.getByLabel("목표치").fill("");
    await page.getByRole("button", { name: "목표 세우기" }).click();
    await expect(page.getByText("목표치를 입력하세요.")).toBeVisible();
  });

  test("목표를 지우면 게이지가 사라진다", async () => {
    await page.goto("/");

    await page.getByRole("button", { name: "월간 독서 시간(분) 목표 삭제" }).click();
    const confirm = page.getByRole("dialog", { name: "월간 독서 시간(분) 목표를 지울까요?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "삭제" }).click();

    await expect(page.getByRole("progressbar", { name: /월간/ })).toHaveCount(0);
    // 연간 목표는 남아 있다.
    await expect(page.getByRole("progressbar", { name: /연간/ })).toHaveCount(1);
  });

  test("인용구를 남기면 대시보드에 최근 인용구로 뜬다", async () => {
    await page.goto("/library");
    await page.getByRole("link", { name: /통계 검증용 책/ }).click();

    await page.getByLabel("인용구 내용").fill("읽는 일은 결국 시간을 쓰는 일이다.");
    await page.getByRole("button", { name: "남기기" }).click();

    // getByText는 방금 타이핑한 textarea 값에도 걸린다. 그러면 저장이 끝나기
    // 전에 단정이 통과해서 다음 goto가 insert를 앞지른다. 목록에 렌더된
    // <p>로 확인해야 저장 완료를 실제로 기다린다.
    await expect(
      page.locator("p", { hasText: "읽는 일은 결국 시간을 쓰는 일이다." }),
    ).toBeVisible();

    await page.goto("/");
    await expect(
      page.locator("p", { hasText: "읽는 일은 결국 시간을 쓰는 일이다." }),
    ).toBeVisible();
  });
});
