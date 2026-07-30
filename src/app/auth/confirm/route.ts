import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["magiclink", "signup", "invite", "recovery", "email_change"];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as string[]).includes(value);
}

/**
 * 매직링크가 돌아오는 지점.
 *
 * 두 가지 형태를 모두 받는다.
 *   - `?code=`       기본 이메일 템플릿 + PKCE. 링크를 요청한 브라우저에서 열어야 한다.
 *   - `?token_hash=` 이메일 템플릿을 {{ .TokenHash }} 로 바꿨거나, 관리자 API로
 *                    발급한 링크. 브라우저가 달라도 동작한다(E2E가 이 경로를 쓴다).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = sanitizeNextPath(searchParams.get("next"));

  const supabase = await createServerSupabaseClient();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error(`[auth/confirm] exchangeCodeForSession: ${error.message}`);
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error(`[auth/confirm] verifyOtp: ${error.message}`);
  }

  return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
}
