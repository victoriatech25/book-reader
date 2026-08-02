/**
 * 로그인 링크 발송 실패 사유를 사람 말로 바꾼다.
 *
 * 원래는 무슨 오류든 "잠시 후 다시 시도해주세요" 한 줄로 뭉갰다. 그러면
 * 사용자는 무엇을 고쳐야 하는지 모르고, 개발자도 화면만 보고는 원인을 좁힐
 * 수 없다 — 프로덕션에서 실제로 그 상태에 빠졌다(2026-08-02).
 *
 * Supabase(GoTrue)는 오류마다 code를 준다. 우리가 실제로 만날 수 있는 것만
 * 골라 옮기고, 나머지는 일반 문구에 code를 붙여 물어볼 거리를 남긴다.
 */

export type LoginErrorLike = {
  code?: string | null;
  status?: number | null;
  message?: string | null;
};

/** 사용자가 기다렸다 다시 시도하면 되는 종류인가. 화면이 재시도 안내를 붙일지 정한다. */
export function isRetryable(error: LoginErrorLike): boolean {
  return error.code === "over_email_send_rate_limit" || error.status === 429;
}

export function loginErrorMessage(error: LoginErrorLike): string {
  // 429는 code가 없는 경우가 있어 상태 코드도 같이 본다.
  if (isRetryable(error)) {
    return "요청이 너무 잦습니다. 1분쯤 뒤에 다시 시도해주세요. 메일 발송 한도에 걸렸을 수 있습니다.";
  }

  switch (error.code) {
    case "email_provider_disabled":
      return "이메일 로그인이 꺼져 있습니다. 관리자 설정을 확인해야 합니다.";
    case "signup_disabled":
      return "새 계정 가입이 막혀 있습니다. 관리자 설정을 확인해야 합니다.";
    case "validation_failed":
      return "이메일 주소를 다시 확인해주세요.";
    case "email_address_invalid":
      return "받을 수 없는 이메일 주소입니다.";
    default:
      break;
  }

  // 메일 서버가 링크를 못 보낸 경우. 주소나 입력의 문제가 아니라고 알려야
  // 사용자가 주소를 고치며 헤매지 않는다.
  if (error.status !== null && error.status !== undefined && error.status >= 500) {
    return "메일을 보내는 중 문제가 생겼습니다. 주소 문제가 아니니 잠시 후 다시 시도해주세요.";
  }

  const detail = error.code ?? (error.status ? `HTTP ${error.status}` : null);
  return detail
    ? `로그인 링크를 보내지 못했습니다. (${detail})`
    : "로그인 링크를 보내지 못했습니다. 잠시 후 다시 시도해주세요.";
}
