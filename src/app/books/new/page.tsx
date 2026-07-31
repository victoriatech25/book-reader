import { quietLink } from "@/components/ui/styles";
import type { Metadata } from "next";
import Link from "next/link";

import { NewBookView } from "./new-book-view";

export const metadata: Metadata = { title: "책 등록 · book-reader" };

export default function NewBookPage() {
  return (
    <div className="bg-background flex flex-1 justify-center px-6 py-12">
      <main className="w-full max-w-xl">
        <Link href="/" className={quietLink}>
          ← 홈
        </Link>
        <h1 className="text-foreground mt-4 mb-8 text-2xl font-semibold tracking-tight">책 등록</h1>
        <NewBookView />
      </main>
    </div>
  );
}
