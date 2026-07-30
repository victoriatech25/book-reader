import type { Metadata } from "next";
import Link from "next/link";

import { NewBookView } from "./new-book-view";

export const metadata: Metadata = { title: "책 등록 · book-reader" };

export default function NewBookPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-12 dark:bg-zinc-950">
      <main className="w-full max-w-xl">
        <Link
          href="/"
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← 홈
        </Link>
        <h1 className="mt-4 mb-8 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          책 등록
        </h1>
        <NewBookView />
      </main>
    </div>
  );
}
