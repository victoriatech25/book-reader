"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Select } from "@/components/ui/select";
import {
  input,
  quietLink,
  segmentItem,
  segmentItemActive,
  segmentTrack,
} from "@/components/ui/styles";
import { formatDate } from "@/lib/format";
import {
  countByStatus,
  EMPTY_FILTER,
  filterBooks,
  finishedYears,
  hasActiveFilter,
  isSortKey,
  SORT_LABEL,
  SORT_OPTIONS,
  sortBooks,
  STATUS_TAB_LABEL,
  STATUS_TABS,
  usedTags,
  type LibraryBook,
  type LibraryFilter,
  type SortKey,
} from "@/lib/library/filter";
import { formatProgress, progressPercent } from "@/lib/progress";
import { STATUS_LABEL } from "@/lib/reading-status";
import { formatRating, RATING_OPTIONS } from "@/lib/reviews";
import { categoryColor } from "@/lib/taxonomy/category";

type View = "grid" | "list";

function CategoryBadge({ book }: { book: LibraryBook }) {
  if (!book.categoryName) return null;
  const color = categoryColor(book.categoryColor, book.categorySortOrder);

  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      {book.categoryName}
    </span>
  );
}

function Cover({ book, className }: { book: LibraryBook; className: string }) {
  // 표지가 없을 때의 자리. block을 반드시 준다 — span은 inline이라
  // aspect-ratio와 w-full이 먹지 않고, 그리드에서 높이가 0이 된다.
  // 리스트는 부모가 flex라 우연히 가려져 있었다.
  if (!book.coverUrl) return <span className={`bg-muted block ${className}`} />;
  return (
    // 표지는 외부 도메인이라 next/image 대신 img를 쓴다.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={book.coverUrl}
      alt=""
      loading="lazy"
      decoding="async"
      className={`object-cover ${className}`}
    />
  );
}

function ProgressBar({ book }: { book: LibraryBook }) {
  const percent = progressPercent(book.currentValue, book.targetValue);
  return (
    <div className="bg-muted mt-2 h-1 w-full overflow-hidden rounded-full">
      <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
    </div>
  );
}

function GridCard({ book }: { book: LibraryBook }) {
  return (
    <li>
      <Link
        href={`/books/${book.id}`}
        className="hover:bg-accent block rounded-lg p-2 transition-colors"
      >
        <Cover book={book} className="aspect-[2/3] w-full rounded-sm" />
        <span className="text-foreground mt-2 block truncate font-serif text-sm font-medium">
          {book.title}
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
          {book.authors.join(", ")}
        </span>
        <span className="text-muted-foreground mt-1 block font-mono text-xs">
          {book.status ? STATUS_LABEL[book.status] : "-"}
          {book.rating !== null && ` · ${formatRating(book.rating)}`}
        </span>
        {book.status === "reading" && <ProgressBar book={book} />}
      </Link>
    </li>
  );
}

/** 소감이 짧으므로 리스트 뷰에서는 전문을 그대로 보여준다 (PRD §3.1 F8). */
function ListRow({ book }: { book: LibraryBook }) {
  return (
    <li>
      <Link
        href={`/books/${book.id}`}
        className="hover:bg-accent flex flex-wrap gap-x-4 gap-y-2 rounded-md px-2 py-3 transition-colors"
      >
        <Cover book={book} className="h-20 w-14 shrink-0 rounded-sm" />

        <span className="min-w-0 flex-1 basis-48">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-foreground font-serif text-base font-medium">{book.title}</span>
            <span className="text-muted-foreground text-xs">{book.authors.join(", ")}</span>
            {book.attemptNo > 1 && (
              <span className="text-muted-foreground text-xs">{book.attemptNo}회독</span>
            )}
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <CategoryBadge book={book} />
            {book.tags.map((tag) => (
              <span
                key={tag}
                className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs"
              >
                #{tag}
              </span>
            ))}
          </span>

          {book.review && <span className="prose-quote mt-2 block text-sm">{book.review}</span>}
        </span>

        {/*
          좁은 화면에서는 아래 줄로 내려 한 줄에 늘어놓는다. 375px에서 오른쪽
          고정 열을 유지하면 본문 폭이 140px 남짓이 되어 소감이 두세 글자씩
          접힌다 — 소감 전문을 보여주는 뷰인데 읽을 수가 없다.
        */}
        <span className="flex w-full flex-wrap items-baseline gap-x-3 sm:block sm:w-28 sm:shrink-0 sm:text-right">
          <span className="text-muted-foreground text-xs">
            {book.status ? STATUS_LABEL[book.status] : "-"}
          </span>
          <span className="text-muted-foreground font-mono text-xs sm:mt-0.5 sm:block">
            {formatProgress(book.currentValue, book.progressUnit, book.targetValue)}
          </span>
          {book.rating !== null && (
            <span className="text-foreground font-mono text-xs sm:mt-0.5 sm:block">
              {formatRating(book.rating)}
            </span>
          )}
          {book.finishedAt && (
            <span className="text-muted-foreground font-mono text-xs sm:mt-0.5 sm:block">
              {formatDate(book.finishedAt)}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function LibraryView({
  books,
  categories,
}: {
  books: LibraryBook[];
  categories: { id: string; name: string }[];
}) {
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<View>("list");

  function patch(next: Partial<LibraryFilter>) {
    setFilter((current) => ({ ...current, ...next }));
  }

  // 상태 탭의 권수는 다른 필터를 적용한 뒤에 센다. 그래야 "완독 (0)"을 보고
  // 누르지 않게 된다.
  const withoutStatus = useMemo(
    () => filterBooks(books, { ...filter, status: "all" }),
    [books, filter],
  );
  const counts = useMemo(() => countByStatus(withoutStatus), [withoutStatus]);

  const visible = useMemo(() => sortBooks(filterBooks(books, filter), sort), [books, filter, sort]);

  const years = useMemo(() => finishedYears(books), [books]);
  const tags = useMemo(() => usedTags(books), [books]);

  return (
    <div>
      <input
        type="search"
        value={filter.keyword}
        onChange={(event) => patch({ keyword: event.target.value })}
        aria-label="서재 검색"
        placeholder="제목 · 저자 · 출판사 · 태그로 검색"
        className={`w-full ${input}`}
      />

      {/* 밑줄 탭 대신 알약. 좁은 화면에서는 줄바꿈 없이 옆으로 밀린다. */}
      <div className={`mt-5 ${segmentTrack}`}>
        {STATUS_TABS.map((tab) => {
          const active = filter.status === tab;
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={active}
              // 숫자를 span으로 붙이면 접근성 이름이 "전체3"으로 이어져
              // 스크린리더가 "전체삼"으로 읽는다.
              aria-label={`${STATUS_TAB_LABEL[tab]} ${counts[tab]}권`}
              onClick={() => patch({ status: tab })}
              className={active ? segmentItemActive : segmentItem}
            >
              {STATUS_TAB_LABEL[tab]}
              <span className="font-mono text-xs opacity-70">{counts[tab]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 lg:grid lg:grid-cols-[190px_1fr] lg:gap-8">
        {/* 데스크톱은 사이드바, 모바일은 위에 깔린다 (PRD §4) */}
        <aside className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
          <Select
            aria-label="분야"
            value={filter.categoryId ?? ""}
            onChange={(event) => patch({ categoryId: event.target.value || null })}
          >
            <option value="">분야 전체</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="태그"
            value={filter.tag ?? ""}
            onChange={(event) => patch({ tag: event.target.value || null })}
          >
            <option value="">태그 전체</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </Select>

          <Select
            aria-label="별점"
            value={filter.minRating ?? ""}
            onChange={(event) =>
              patch({ minRating: event.target.value ? Number(event.target.value) : null })
            }
          >
            <option value="">별점 전체</option>
            {[...RATING_OPTIONS].reverse().map((value) => (
              <option key={value} value={value}>
                ★ {value.toFixed(1)} 이상
              </option>
            ))}
          </Select>

          <Select
            aria-label="완독 연도"
            value={filter.year ?? ""}
            onChange={(event) => patch({ year: event.target.value || null })}
          >
            <option value="">연도 전체</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}년 완독
              </option>
            ))}
          </Select>

          <Select
            aria-label="정렬"
            value={sort}
            onChange={(event) => {
              if (isSortKey(event.target.value)) setSort(event.target.value);
            }}
          >
            {SORT_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {SORT_LABEL[key]}
              </option>
            ))}
          </Select>

          {hasActiveFilter(filter) && (
            <button
              type="button"
              onClick={() => setFilter(EMPTY_FILTER)}
              className={`${quietLink} text-xs lg:mt-1 lg:text-left`}
            >
              필터 지우기
            </button>
          )}
        </aside>

        <div className="mt-6 lg:mt-0">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              {visible.length}권
              {visible.length !== books.length && (
                <span className="text-muted-foreground"> / 전체 {books.length}권</span>
              )}
            </p>

            <div className={segmentTrack}>
              {(["list", "grid"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                  className={`${view === mode ? segmentItemActive : segmentItem} text-xs`}
                >
                  {mode === "list" ? "리스트" : "그리드"}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="text-muted-foreground mt-8 text-sm">
              {books.length === 0
                ? "아직 등록한 책이 없습니다."
                : "조건에 맞는 책이 없습니다. 필터를 지워보세요."}
            </p>
          ) : view === "grid" ? (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((book) => (
                <GridCard key={book.id} book={book} />
              ))}
            </ul>
          ) : (
            <ul className="divide-border border-border mt-4 divide-y border-y">
              {visible.map((book) => (
                <ListRow key={book.id} book={book} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
