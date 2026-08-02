"use client";

import { useState } from "react";

import {
  buttonPrimary,
  buttonSecondary,
  card,
  errorText,
  input,
  label,
  quietLink,
} from "@/components/ui/styles";
import { loginErrorMessage } from "@/lib/auth/login-error";
import { authRedirectTo } from "@/lib/auth/redirect-to";
import { loginSchema } from "@/lib/auth/validation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Status =
  { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = loginSchema.safeParse({ email });
    if (!parsed.success) {
      setStatus({ kind: "error", message: parsed.error.issues[0].message });
      return;
    }

    setStatus({ kind: "sending" });

    // 브라우저 클라이언트로 보내야 PKCE code_verifier가 쿠키에 남고,
    // 링크를 눌러 돌아왔을 때 /auth/confirm 이 세션으로 교환할 수 있다.
    const supabase = createBrowserSupabaseClient();

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: authRedirectTo(window.location.origin, next) },
    });

    if (error) {
      /*
       * 오류를 뭉개지 않는다. 콘솔에는 원문을, 화면에는 옮긴 말을 남긴다.
       * 발송 한도인지 설정 문제인지 주소 문제인지가 갈리는데, 한 문장으로
       * 덮으면 사용자는 주소만 고쳐가며 헤매고 개발자는 화면으로 원인을
       * 좁힐 수 없다.
       */
      console.error("[login] 매직링크 발송 실패", {
        code: error.code,
        status: error.status,
        message: error.message,
      });

      setStatus({ kind: "error", message: loginErrorMessage(error) });
      return;
    }

    setStatus({ kind: "sent" });
  }

  /**
   * Google 로그인.
   *
   * 메일을 거치지 않는 것이 요점이다. 매직링크는 메일함에 도착하는 시점에
   * 매여 있고, 발송 한도에 걸리면 아예 못 들어온다. OAuth는 발송이라는
   * 단계 자체가 없다.
   *
   * 콜백은 매직링크와 같은 /auth/confirm 이다 — 그 라우트가 이미 PKCE의
   * `?code=`를 세션으로 교환한다.
   */
  async function handleGoogle() {
    setStatus({ kind: "sending" });

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectTo(window.location.origin, next) },
    });

    // 성공하면 브라우저가 구글로 떠나므로 여기로 돌아오지 않는다.
    if (error) {
      console.error("[login] Google 로그인 실패", {
        code: error.code,
        status: error.status,
        message: error.message,
      });
      setStatus({ kind: "error", message: loginErrorMessage(error) });
    }
  }

  if (status.kind === "sent") {
    return (
      <div role="status" className={`${card} text-muted-foreground text-sm`}>
        <p className="text-foreground font-medium">메일을 확인해주세요</p>
        <p className="mt-1.5">
          <span className="font-mono">{email}</span> 으로 로그인 링크를 보냈습니다. 링크는 한 번만
          쓸 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className={`mt-3 ${quietLink}`}
        >
          다른 주소로 다시 보내기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/*
        Google을 위에 둔다. 메일을 기다리지 않아도 되는 쪽이 기본이어야 한다.
        매직링크는 그 아래 남긴다 — 이미 그걸로 쓰던 계정이 있고, 같은 주소면
        Supabase가 같은 사용자로 잇는다.
      */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={status.kind === "sending"}
        className={`w-full ${buttonSecondary}`}
      >
        Google 계정으로 계속하기
      </button>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">또는 메일로 받기</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div>
          <label htmlFor="email" className={label}>
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={status.kind === "error"}
            aria-describedby={status.kind === "error" ? "email-error" : undefined}
            className={`mt-1.5 w-full ${input}`}
          />
        </div>

        {status.kind === "error" && (
          <p id="email-error" role="alert" className={errorText}>
            {status.message}
          </p>
        )}

        <button
          type="submit"
          disabled={status.kind === "sending"}
          className={`w-full ${buttonPrimary}`}
        >
          {status.kind === "sending" ? "보내는 중..." : "로그인 링크 받기"}
        </button>
      </form>
    </div>
  );
}
