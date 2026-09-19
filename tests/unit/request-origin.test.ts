import { describe, expect, it } from "vitest";

import { requestOrigin } from "@/lib/request-origin";

function req(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("requestOrigin", () => {
  it("프록시 헤더가 있으면 Host 와 X-Forwarded-Proto 로 origin 을 만든다", () => {
    const r = req("http://0.0.0.0:3000/reader/auth/confirm?code=x", {
      host: "victoria-tech.com",
      "x-forwarded-proto": "https",
    });
    expect(requestOrigin(r)).toBe("https://victoria-tech.com");
  });

  it("X-Forwarded-Host 가 Host 보다 우선한다", () => {
    const r = req("http://0.0.0.0:3000/", {
      host: "127.0.0.1:3100",
      "x-forwarded-host": "victoria-tech.com",
      "x-forwarded-proto": "https",
    });
    expect(requestOrigin(r)).toBe("https://victoria-tech.com");
  });

  it("프록시가 여럿이면 X-Forwarded-Proto 의 첫 값을 쓴다", () => {
    const r = req("http://0.0.0.0:3000/", {
      host: "victoria-tech.com",
      "x-forwarded-proto": "https, http",
    });
    expect(requestOrigin(r)).toBe("https://victoria-tech.com");
  });

  it("X-Forwarded-Proto 가 없으면 request.url 의 프로토콜을 쓴다", () => {
    const r = req("http://localhost:3000/", { host: "localhost:3000" });
    expect(requestOrigin(r)).toBe("http://localhost:3000");
  });

  it("Host 조차 없으면 request.url 의 origin 으로 돌아간다", () => {
    expect(requestOrigin(req("http://0.0.0.0:3000/x"))).toBe("http://0.0.0.0:3000");
  });
});
