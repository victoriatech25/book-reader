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
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <main className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          book-reader
        </h1>
        <p className="mt-2 mb-8 text-sm text-zinc-600 dark:text-zinc-400">
          이메일로 로그인 링크를 보내드립니다. 비밀번호는 없습니다.
        </p>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <LoginForm next={next} />
      </main>
    </div>
  );
}
