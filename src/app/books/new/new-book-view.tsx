"use client";

import { useState } from "react";

import type { BookSearchItem } from "@/lib/book-search/kakao";

import { createBookAction } from "../actions";
import { BookForm, EMPTY_BOOK, type BookDefaults } from "../book-form";

type SearchState =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "done"; items: BookSearchItem[] }
  | { kind: "error"; message: string };

function toDefaults(item: BookSearchItem): BookDefaults {
  return {
    ...EMPTY_BOOK,
    title: item.title,
    authors: item.authors.join(", "),
    translators: item.translators.join(", "),
    publisher: item.publisher ?? "",
    published_on: item.publishedOn ?? "",
    isbn13: item.isbn13 ?? "",
    cover_url: item.coverUrl ?? "",
    // 카카오는 페이지수를 주지 않는다. 종이책이면 사용자가 채운다 (PRD §6.2).
    total_pages: "",
    source: "kakao",
    source_ref: JSON.stringify(item.sourceRef),
  };
}

export function NewBookView() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [defaults, setDefaults] = useState<BookDefaults | null>(null);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length === 0) return;

    setSearch({ kind: "searching" });

    try {
      const response = await fetch(`/api/book-search?q=${encodeURIComponent(query.trim())}`);
      const body = await response.json();

      if (!response.ok) {
        setSearch({
          kind: "error",
          message: body?.error?.message ?? "검색에 실패했습니다. 직접 입력할 수 있습니다.",
        });
        return;
      }

      setSearch({ kind: "done", items: body.items });
    } catch {
      setSearch({ kind: "error", message: "검색에 실패했습니다. 직접 입력할 수 있습니다." });
    }
  }

  if (defaults) {
    return (
      <div className="space-y-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            내용을 확인하고 저장하세요
          </h2>
          <button
            type="button"
            onClick={() => setDefaults(null)}
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            검색으로 돌아가기
          </button>
        </div>
        <BookForm
          action={createBookAction}
          defaults={defaults}
          submitLabel="서재에 담기"
          cancelHref="/"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          aria-label="책 검색"
          placeholder="제목이나 저자로 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100"
        />
        <button
          type="submit"
          disabled={search.kind === "searching"}
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {search.kind === "searching" ? "검색 중..." : "검색"}
        </button>
      </form>

      {search.kind === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {search.message}
        </p>
      )}

      {search.kind === "done" && search.items.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          검색 결과가 없습니다. 아래에서 직접 입력하세요.
        </p>
      )}

      {search.kind === "done" && search.items.length > 0 && (
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {search.items.map((item, index) => (
            <li key={`${item.isbn13 ?? item.title}-${index}`}>
              <button
                type="button"
                onClick={() => setDefaults(toDefaults(item))}
                // 표지 이미지와 중첩 span으로 이름이 애매해지지 않도록 명시한다.
                aria-label={`${item.title} 선택`}
                className="flex w-full items-start gap-3 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                {item.coverUrl ? (
                  // 표지는 외부 도메인이라 next/image 대신 img를 쓴다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.coverUrl}
                    alt=""
                    className="h-16 w-11 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <span className="h-16 w-11 shrink-0 rounded-sm bg-zinc-100 dark:bg-zinc-800" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {[item.authors.join(", "), item.publisher, item.publishedOn]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setDefaults(EMPTY_BOOK)}
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          검색 없이 직접 입력하기
        </button>
      </div>
    </div>
  );
}
