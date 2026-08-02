import { describe, expect, it } from "vitest";

import { isRetryable, loginErrorMessage } from "@/lib/auth/login-error";

describe("loginErrorMessage", () => {
  it("발송 한도는 기다리라고 알려준다", () => {
    const byCode = loginErrorMessage({ code: "over_email_send_rate_limit", status: 429 });
    expect(byCode).toContain("다시 시도");
    expect(byCode).toContain("한도");
  });

  // 429인데 code가 비어 오는 경우가 있다. 상태 코드만으로도 같은 판정이어야 한다.
  it("code 없이 429만 와도 한도로 본다", () => {
    expect(isRetryable({ status: 429 })).toBe(true);
    expect(loginErrorMessage({ status: 429 })).toContain("한도");
  });

  it("설정 문제는 관리자 몫이라고 밝힌다", () => {
    expect(loginErrorMessage({ code: "email_provider_disabled" })).toContain("관리자");
    expect(loginErrorMessage({ code: "signup_disabled" })).toContain("관리자");
  });

  /*
   * 메일 서버 문제를 주소 문제처럼 말하면 사용자가 멀쩡한 주소를 고치며
   * 헤맨다. 5xx일 때는 주소 탓이 아니라고 분명히 말해야 한다.
   */
  it("서버 오류는 주소 문제가 아니라고 못박는다", () => {
    const message = loginErrorMessage({ status: 500, code: "unexpected_failure" });
    expect(message).toContain("주소 문제가 아니");
    expect(isRetryable({ status: 500 })).toBe(false);
  });

  it("주소가 잘못된 경우는 주소를 가리킨다", () => {
    expect(loginErrorMessage({ code: "validation_failed" })).toContain("이메일 주소");
    expect(loginErrorMessage({ code: "email_address_invalid" })).toContain("이메일 주소");
  });

  // 모르는 오류를 "잠시 후 다시"로만 덮으면 물어볼 거리가 남지 않는다.
  it("모르는 오류는 code를 남겨 물어볼 수 있게 한다", () => {
    expect(loginErrorMessage({ code: "some_new_code", status: 400 })).toContain("some_new_code");
    expect(loginErrorMessage({ status: 400 })).toContain("HTTP 400");
  });

  it("아무 단서가 없으면 일반 문구로 떨어진다", () => {
    expect(loginErrorMessage({})).toBe(
      "로그인 링크를 보내지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  });
});
