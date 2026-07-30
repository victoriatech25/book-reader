import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserBadge } from "@/components/user-badge";

// 툴체인 스모크도 겸한다: jsdom, RTL, @/ 경로 별칭, jest-dom 단정.
// (홈은 W3부터 async 서버 컴포넌트라 RTL로 렌더할 수 없어 E2E가 담당한다.)
describe("UserBadge", () => {
  it("로그인한 이메일을 보여준다", () => {
    render(<UserBadge email="reader@example.com" />);
    expect(screen.getByText("reader@example.com")).toBeInTheDocument();
  });

  it("로그아웃은 POST로만 보낸다 — 링크 프리페치로 세션이 끊기면 안 된다", () => {
    const { container } = render(<UserBadge email="reader@example.com" />);
    const form = container.querySelector("form");

    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/auth/signout");
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });
});
