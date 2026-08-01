"use client";

import { useState } from "react";

import { buttonPrimary, errorText, input, quietLink } from "@/components/ui/styles";
import type { BookSearchItem } from "@/lib/book-search/kakao";

import { createBookAction } from "../actions";
import { BookForm, EMPTY_BOOK, type BookDefaults, type CategoryOption } from "../book-form";

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

export function NewBookView({
  categories,
  tagSuggestions,
}: {
  categories: CategoryOption[];
  tagSuggestions: string[];
}) {
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
          <h2 className="text-foreground text-sm font-medium">내용을 확인하고 저장하세요</h2>
          <button type="button" onClick={() => setDefaults(null)} className={quietLink}>
            검색으로 돌아가기
          </button>
        </div>
        <BookForm
          action={createBookAction}
          defaults={defaults}
          submitLabel="서재에 담기"
          cancelHref="/"
          categories={categories}
          tagSuggestions={tagSuggestions}
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
          className={`w-full ${input}`}
        />
        <button
          type="submit"
          disabled={search.kind === "searching"}
          className={`shrink-0 ${buttonPrimary}`}
        >
          {search.kind === "searching" ? "검색 중..." : "검색"}
        </button>
      </form>

      {search.kind === "error" && (
        <p role="alert" className={errorText}>
          {search.message}
        </p>
      )}

      {search.kind === "done" && search.items.length === 0 && (
        <p className="text-muted-foreground text-sm">
          검색 결과가 없습니다. 아래에서 직접 입력하세요.
        </p>
      )}

      {search.kind === "done" && search.items.length > 0 && (
        <ul className="divide-border border-border divide-y border-y">
          {search.items.map((item, index) => (
            <li key={`${item.isbn13 ?? item.title}-${index}`}>
              <button
                type="button"
                onClick={() => setDefaults(toDefaults(item))}
                // 표지 이미지와 중첩 span으로 이름이 애매해지지 않도록 명시한다.
                aria-label={`${item.title} 선택`}
                className="hover:bg-accent flex w-full items-start gap-3 rounded-md px-2 py-3 text-left transition-colors"
              >
                {item.coverUrl ? (
                  // 표지는 외부 도메인이라 next/image 대신 img를 쓴다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.coverUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-16 w-11 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <span className="bg-muted h-16 w-11 shrink-0 rounded-sm" />
                )}
                <span className="min-w-0">
                  <span className="text-foreground block truncate font-serif text-base font-medium">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
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

      <div className="border-border border-t pt-6">
        <button type="button" onClick={() => setDefaults(EMPTY_BOOK)} className={quietLink}>
          검색 없이 직접 입력하기
        </button>
      </div>
    </div>
  );
}
