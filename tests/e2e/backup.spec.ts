import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/session";
import { createTestUser, deleteTestUser, type TestUser } from "./support/supabase-admin";

/**
 * W12 백업 (PRD §3.2 F15).
 *
 * 형식·CSV 이스케이프·중복 판정은 단위 테스트가 덮고, 왕복 동일성은 V3가
 * DB 층에서 덮는다. 여기서는 화면에서 받은 파일을 화면으로 다시 넣었을 때
 * 실제로 복원되는지를 본다 — 그게 백업의 존재 이유다.
 */
test.describe.serial("백업", () => {
  let owner: TestUser;
  let page: Page;
  let backupJson = "";

  test.beforeAll(async ({ browser }) => {
    owner = await createTestUser("backup");
    page = await browser.newPage();
    await loginAs(page, owner.email);
    await page.waitForURL("/");
  });

  test.afterAll(async () => {
    await page?.close();
    if (owner) await deleteTestUser(owner.id);
  });

  test("데이터를 만든다", async () => {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    await page.getByLabel("제목").fill("백업 검증용 사피엔스");
    await expect(page.getByLabel("제목")).toHaveValue("백업 검증용 사피엔스");
    await page.getByLabel("저자").fill("유발 하라리");
    await page.getByLabel("분야").selectOption({ label: "역사" });
    await page.getByLabel("태그").fill("번역서, 추천받음");
    await page.getByRole("button", { name: "서재에 담기" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);

    await page.getByLabel("진행률 (%)").first().fill("100");
    await page.getByLabel("읽은 시간 (분)").first().fill("120");
    await page.getByRole("button", { name: "기록", exact: true }).click();
    await expect(page.getByText("1회독 · 읽는 중")).toBeVisible();

    await page.getByRole("button", { name: "완독" }).click();
    await page.getByLabel("별점").selectOption("4.5");
    // 쉼표와 따옴표가 든 소감 — CSV 이스케이프가 실제로 걸리는지 본다.
    await page.getByLabel("한 줄 소감").fill('밤에 읽기 좋았다, 특히 "인지혁명" 장이.');
    await page.getByRole("button", { name: "완독으로 저장" }).click();
    await expect(page.getByText("1회독 · 완독")).toBeVisible();

    await page.getByLabel("인용구 내용").fill("질서는 상상의 산물이지만 힘은 실재한다.");
    await page.getByRole("button", { name: "남기기" }).click();
    await expect(page.locator("p", { hasText: "질서는 상상의 산물" })).toBeVisible();

    // 위시리스트 한 권 더 — 회차 상태가 섞여 있어야 의미가 있다.
    await page.goto("/books/new");
    await page.getByRole("button", { name: "검색 없이 직접 입력하기" }).click();
    await page.getByLabel("제목").fill("백업 검증용 코스모스");
    await expect(page.getByLabel("제목")).toHaveValue("백업 검증용 코스모스");
    await page.getByLabel("분야").selectOption({ label: "과학" });
    await page.getByRole("button", { name: "서재에 담기" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
  });

  test("JSON 백업을 내려받는다", async () => {
    await page.goto("/settings");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "전체 백업 내려받기 (JSON)" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^book-reader-\d{4}-\d{2}-\d{2}\.json$/);

    backupJson = await readFile(await download.path(), "utf8");
    const backup = JSON.parse(backupJson);

    expect(backup.version).toBe(1);
    expect(backup.books).toHaveLength(2);

    const sapiens = backup.books.find((b: { title: string }) => b.title.includes("사피엔스"));
    // 분류는 id가 아니라 이름으로 들어간다 — 그래야 다른 계정으로 옮겨진다.
    expect(sapiens.category).toBe("역사");
    expect(sapiens.tags.sort()).toEqual(["번역서", "추천받음"]);
    expect(sapiens.readings).toHaveLength(1);
    expect(sapiens.readings[0].status).toBe("finished");
    expect(sapiens.readings[0].rating).toBe(4.5);
    expect(sapiens.readings[0].progress_logs).toHaveLength(1);
    expect(sapiens.readings[0].notes).toHaveLength(1);
  });

  test("완독 목록 CSV를 내려받는다", async () => {
    await page.goto("/settings");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "완독 목록 (CSV)" }).click(),
    ]);

    expect(download.suggestedFilename()).toContain("완독목록");

    const csv = await readFile(await download.path(), "utf8");
    expect(csv).toContain("제목,저자,출판사");
    expect(csv).toContain("백업 검증용 사피엔스");
    // 쉼표와 따옴표가 든 소감이 칸을 깨뜨리지 않아야 한다.
    expect(csv).toContain('"밤에 읽기 좋았다, 특히 ""인지혁명"" 장이."');
    // 위시리스트는 완독 목록에 없다.
    expect(csv).not.toContain("코스모스");
  });

  test("같은 계정에 다시 넣으면 전부 건너뛴다", async () => {
    await page.goto("/settings");

    await page.getByLabel("백업 파일 (.json)").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backupJson),
    });
    await page.getByRole("button", { name: "가져오기" }).click();

    await expect(page.getByText(/2권은 이미 있어 건너뛰었습니다/)).toBeVisible();

    // 서재가 두 배가 되지 않았다.
    await page.goto("/library");
    await expect(page.getByRole("button", { name: "전체 2권" })).toBeVisible();
  });

  test("백업 형식이 아니면 거절한다", async () => {
    await page.goto("/settings");

    await page.getByLabel("백업 파일 (.json)").setInputFiles({
      name: "not-a-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ hello: "world" })),
    });
    await page.getByRole("button", { name: "가져오기" }).click();

    await expect(page.getByText(/백업 파일 형식이 아닙니다/)).toBeVisible();
  });

  // 관계를 이름으로 저장한 이유가 이것이다. UUID로 이었다면 옮길 수 없다.
  test("다른 계정에 넣으면 그대로 복원된다", async ({ browser }) => {
    const other = await createTestUser("backup-restore");
    const otherPage = await browser.newPage();

    try {
      await loginAs(otherPage, other.email);
      await otherPage.waitForURL("/");

      await otherPage.goto("/settings");
      await otherPage.getByLabel("백업 파일 (.json)").setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(backupJson),
      });
      await otherPage.getByRole("button", { name: "가져오기" }).click();
      await expect(otherPage.getByText(/책 2권 · 회차 2건/)).toBeVisible();

      // 책과 분류가 살아 있다.
      await otherPage.goto("/library");
      await expect(otherPage.getByRole("button", { name: "전체 2권" })).toBeVisible();
      await expect(otherPage.getByRole("link", { name: /사피엔스/ })).toBeVisible();
      await expect(otherPage.getByRole("link", { name: /코스모스/ })).toBeVisible();

      await otherPage.getByLabel("태그").selectOption("번역서");
      await expect(otherPage.getByRole("link", { name: /사피엔스/ })).toBeVisible();
      await expect(otherPage.getByRole("link", { name: /코스모스/ })).toHaveCount(0);

      // 별점·소감·인용구·진행 기록까지 돌아왔다.
      await otherPage.getByRole("link", { name: /사피엔스/ }).click();
      await expect(otherPage.getByText("1회독 · 완독")).toBeVisible();
      // 소감 편집 셀렉트의 <option>에도 같은 글자가 있다. 표시용 <p>로 좁힌다.
      await expect(otherPage.locator("p", { hasText: "★ 4.5" })).toBeVisible();
      await expect(otherPage.locator("p", { hasText: "밤에 읽기 좋았다" })).toBeVisible();
      await expect(otherPage.locator("p", { hasText: "질서는 상상의 산물" })).toBeVisible();
      await expect(otherPage.getByText("진행 기록 1건")).toBeVisible();

      // 통계도 원본과 같은 값으로 다시 계산된다.
      await otherPage.goto("/");
      await expect(otherPage.getByRole("group", { name: "완독 1권" })).toBeVisible();
      await expect(otherPage.getByRole("group", { name: "독서 시간 2시간" })).toBeVisible();
    } finally {
      await otherPage.close();
      await deleteTestUser(other.id);
    }
  });
});
