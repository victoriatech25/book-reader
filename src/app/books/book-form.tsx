"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { BOOK_FORMATS, BOOK_OWNERSHIPS, FORMAT_LABEL, OWNERSHIP_LABEL } from "@/lib/books/schema";

import { ACTION_IDLE, type ActionState } from "./action-state";

export type BookDefaults = {
  title: string;
  subtitle: string;
  authors: string;
  translators: string;
  publisher: string;
  published_on: string;
  isbn13: string;
  cover_url: string;
  total_pages: string;
  format: string;
  ownership: string;
  memo: string;
  source: string;
  source_ref: string;
};

export const EMPTY_BOOK: BookDefaults = {
  title: "",
  subtitle: "",
  authors: "",
  translators: "",
  publisher: "",
  published_on: "",
  isbn13: "",
  cover_url: "",
  total_pages: "",
  format: "ebook",
  ownership: "own",
  memo: "",
  source: "manual",
  source_ref: "",
};

const inputClass =
  "mt-1.5 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100";
const labelClass = "block text-sm font-medium text-zinc-900 dark:text-zinc-100";

function Field({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

export function BookForm({
  action,
  defaults,
  submitLabel,
  bookId,
  cancelHref,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults: BookDefaults;
  submitLabel: string;
  bookId?: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, ACTION_IDLE);
  const [format, setFormat] = useState(defaults.format);

  return (
    <form action={formAction} className="space-y-5">
      {bookId && <input type="hidden" name="book_id" value={bookId} />}
      <input type="hidden" name="source" value={defaults.source} />
      <input type="hidden" name="source_ref" value={defaults.source_ref} />

      <Field name="title" label="제목">
        <input
          id="title"
          name="title"
          defaultValue={defaults.title}
          required
          autoFocus
          className={inputClass}
        />
      </Field>

      <Field name="authors" label="저자" hint="여러 명이면 쉼표로 구분합니다.">
        <input id="authors" name="authors" defaultValue={defaults.authors} className={inputClass} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="publisher" label="출판사">
          <input
            id="publisher"
            name="publisher"
            defaultValue={defaults.publisher}
            className={inputClass}
          />
        </Field>

        <Field name="published_on" label="출간일">
          <input
            id="published_on"
            name="published_on"
            type="date"
            defaultValue={defaults.published_on}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="format" label="형태">
          <select
            id="format"
            name="format"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
            className={inputClass}
          >
            {BOOK_FORMATS.map((value) => (
              <option key={value} value={value}>
                {FORMAT_LABEL[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field name="ownership" label="소장 형태">
          <select
            id="ownership"
            name="ownership"
            defaultValue={defaults.ownership}
            className={inputClass}
          >
            {BOOK_OWNERSHIPS.map((value) => (
              <option key={value} value={value}>
                {OWNERSHIP_LABEL[value]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        name="total_pages"
        label="페이지수"
        hint={
          format === "paper"
            ? "종이책은 페이지수를 넣어야 진행률을 페이지로 기록합니다. 비워두면 %로 셉니다."
            : "전자책은 %로 진행률을 세므로 비워둬도 됩니다."
        }
      >
        <input
          id="total_pages"
          name="total_pages"
          type="number"
          min={1}
          max={20000}
          defaultValue={defaults.total_pages}
          className={inputClass}
        />
      </Field>

      <details className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">
          자세히 (부제 · 역자 · ISBN · 표지 · 메모)
        </summary>
        <div className="mt-4 space-y-5">
          <Field name="subtitle" label="부제">
            <input
              id="subtitle"
              name="subtitle"
              defaultValue={defaults.subtitle}
              className={inputClass}
            />
          </Field>

          <Field name="translators" label="역자" hint="여러 명이면 쉼표로 구분합니다.">
            <input
              id="translators"
              name="translators"
              defaultValue={defaults.translators}
              className={inputClass}
            />
          </Field>

          <Field name="isbn13" label="ISBN13" hint="숫자 13자리">
            <input
              id="isbn13"
              name="isbn13"
              inputMode="numeric"
              defaultValue={defaults.isbn13}
              className={inputClass}
            />
          </Field>

          <Field name="cover_url" label="표지 주소">
            <input
              id="cover_url"
              name="cover_url"
              type="url"
              defaultValue={defaults.cover_url}
              className={inputClass}
            />
          </Field>

          <Field name="memo" label="메모">
            <textarea
              id="memo"
              name="memo"
              rows={3}
              defaultValue={defaults.memo}
              className={inputClass}
            />
          </Field>
        </div>
      </details>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {pending ? "저장 중..." : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
