import Link from "next/link";
import { notFound } from "next/navigation";

import { updateBookAction } from "@/app/books/actions";
import { BookForm, EMPTY_BOOK } from "@/app/books/book-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: book } = await supabase
    .from("books")
    .select(
      "id, title, subtitle, authors, translators, publisher, published_on, isbn13, cover_url, total_pages, format, ownership, memo, source",
    )
    .eq("id", id)
    .maybeSingle();

  if (!book) notFound();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-12 dark:bg-zinc-950">
      <main className="w-full max-w-xl">
        <Link
          href={`/books/${book.id}`}
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← 상세로
        </Link>
        <h1 className="mt-4 mb-8 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          책 수정
        </h1>

        <BookForm
          action={updateBookAction}
          bookId={book.id}
          cancelHref={`/books/${book.id}`}
          submitLabel="저장"
          defaults={{
            ...EMPTY_BOOK,
            title: book.title,
            subtitle: book.subtitle ?? "",
            authors: book.authors.join(", "),
            translators: book.translators.join(", "),
            publisher: book.publisher ?? "",
            published_on: book.published_on ?? "",
            isbn13: book.isbn13 ?? "",
            cover_url: book.cover_url ?? "",
            total_pages: book.total_pages ? String(book.total_pages) : "",
            format: book.format,
            ownership: book.ownership,
            memo: book.memo ?? "",
            source: book.source,
          }}
        />
      </main>
    </div>
  );
}
