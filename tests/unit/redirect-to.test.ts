import { describe, expect, it } from "vitest";

import { authRedirectTo } from "@/lib/auth/redirect-to";

describe("authRedirectTo", () => {
  it("두 로그인 방식이 같은 콜백으로 돌아온다", () => {
    expect(authRedirectTo("https://book-reader-two-opal.vercel.app", "/")).toBe(
      "https://book-reader-two-opal.vercel.app/auth/confirm?next=%2F",
    );
  });

  it("origin의 포트와 스킴을 그대로 지킨다", () => {
    expect(authRedirectTo("http://localhost:3000", "/library")).toBe(
      "http://localhost:3000/auth/confirm?next=%2Flibrary",
    );
  });

  // next를 문자열로 이어붙이면 여기서 쿼리가 깨진다.
  it("next에 쿼리나 한글이 섞여도 인코딩이 어긋나지 않는다", () => {
    const url = new URL(authRedirectTo("https://example.com", "/library?tag=번역서&sort=title"));
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("next")).toBe("/library?tag=번역서&sort=title");
  });
});
