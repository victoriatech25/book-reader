import Home from "@/app/page";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// 툴체인 스모크: jsdom 환경, RTL, @/ 경로 별칭, jest-dom 단정이 모두 동작하는지 확인한다.
describe("Home", () => {
  it("앱 이름을 제목으로 렌더한다", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "book-reader" })).toBeInTheDocument();
  });

  it("다음 작업 목록을 렌더한다", () => {
    render(<Home />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
