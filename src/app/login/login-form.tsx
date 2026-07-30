"use client";

import { useState } from "react";

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
    const redirectTo = new URL("/auth/confirm", window.location.origin);
    redirectTo.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: redirectTo.toString() },
    });

    if (error) {
      setStatus({
        kind: "error",
        message: "로그인 링크를 보내지 못했습니다. 잠시 후 다시 시도해주세요.",
      });
      return;
    }

    setStatus({ kind: "sent" });
  }

  if (status.kind === "sent") {
    return (
      <div
        role="status"
        className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      >
        <p className="font-medium text-zinc-900 dark:text-zinc-50">메일을 확인해주세요</p>
        <p className="mt-1.5">
          <span className="font-mono">{email}</span> 으로 로그인 링크를 보냈습니다. 링크는 한 번만
          쓸 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-3 text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          다른 주소로 다시 보내기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={status.kind === "error"}
          aria-describedby={status.kind === "error" ? "email-error" : undefined}
          className="mt-1.5 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100"
        />
      </div>

      {status.kind === "error" && (
        <p id="email-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {status.kind === "sending" ? "보내는 중..." : "로그인 링크 받기"}
      </button>
    </form>
  );
}
