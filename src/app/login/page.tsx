import type { Metadata } from "next";

import { sanitizeNextPath } from "@/lib/auth/redirect";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인 · book-reader" };

const ERROR_MESSAGES: Record<string, string> = {
  link_invalid: "로그인 링크가 만료되었거나 이미 사용되었습니다. 다시 요청해주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeNextPath(params.next);
  const error = params.error ? ERROR_MESSAGES[params.error] : undefined;

  return (
    <div className="bg-background flex flex-1 items-center justify-center px-6 py-16">
      <main id="main" className="w-full max-w-sm">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">book-reader</h1>
        <p className="text-muted-foreground mt-2 mb-8 text-sm">
          이메일로 로그인 링크를 보내드립니다. 비밀번호는 없습니다.
        </p>

        {error && (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-md border px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}

        <LoginForm next={next} />
      </main>
    </div>
  );
}
