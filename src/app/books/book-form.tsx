"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  buttonPrimary,
  checkbox,
  errorText,
  hint as hintClass,
  input,
  label as labelClass,
  quietLink,
} from "@/components/ui/styles";
import { Select } from "@/components/ui/select";
import { BOOK_FORMATS, BOOK_OWNERSHIPS, FORMAT_LABEL, OWNERSHIP_LABEL } from "@/lib/books/schema";

import { ReviewFields } from "./[id]/review-fields";

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
  category_id: string;
  tags: string;
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
  category_id: "",
  tags: "",
  source: "manual",
  source_ref: "",
};

const inputClass = `mt-1.5 w-full ${input}`;
/** Select는 껍데기가 스타일을 들고 있다. 여기서는 자리(여백·폭)만 준다. */
const selectClass = "mt-1.5 w-full";

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
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

export type CategoryOption = { id: string; name: string };

export function BookForm({
  action,
  defaults,
  submitLabel,
  bookId,
  cancelHref,
  categories,
  tagSuggestions,
  showAlreadyRead = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults: BookDefaults;
  submitLabel: string;
  bookId?: string;
  cancelHref: string;
  categories: CategoryOption[];
  /** 이미 쓰고 있는 태그. datalist로 자동완성해 표기 흔들림을 줄인다. */
  tagSuggestions: string[];
  /** 등록 화면에서만 "이미 읽은 책"을 받는다 (W13.5). */
  showAlreadyRead?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, ACTION_IDLE);
  const [format, setFormat] = useState(defaults.format);
  // 이미 읽은 책 (W13.5). 등록 화면에서만 쓴다 — 수정 화면에는 이미 회차가
  // 있고, 완독 처리는 상세 화면의 완독 모달이 맡는다.
  const [alreadyRead, setAlreadyRead] = useState(false);

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
          <Select
            id="format"
            name="format"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
            className={selectClass}
          >
            {BOOK_FORMATS.map((value) => (
              <option key={value} value={value}>
                {FORMAT_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field name="ownership" label="소장 형태">
          <Select
            id="ownership"
            name="ownership"
            defaultValue={defaults.ownership}
            className={selectClass}
          >
            {BOOK_OWNERSHIPS.map((value) => (
              <option key={value} value={value}>
                {OWNERSHIP_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="category_id" label="분야" hint="통계의 분류 축입니다. 책당 하나만 고릅니다.">
          <Select
            id="category_id"
            name="category_id"
            defaultValue={defaults.category_id}
            className={selectClass}
          >
            <option value="">선택 안 함</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field name="tags" label="태그" hint="쉼표로 구분합니다. 여러 개 붙일 수 있습니다.">
          <input
            id="tags"
            name="tags"
            list="tag-suggestions"
            defaultValue={defaults.tags}
            placeholder="SF, 번역서, 재독 예정"
            className={inputClass}
          />
          <datalist id="tag-suggestions">
            {tagSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>
      </div>

      {showAlreadyRead && (
        <div className="border-border rounded-xl border p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="already_read"
              checked={alreadyRead}
              onChange={(event) => setAlreadyRead(event.target.checked)}
              className={checkbox}
            />
            이미 다 읽은 책이에요
          </label>
          <p className={hintClass}>
            앱을 쓰기 전에 읽은 책입니다. 등록하면 바로 완독이 되고 통계에 잡힙니다.
          </p>

          {alreadyRead && (
            <div className="mt-4 space-y-5">
              <Field
                name="finished_month"
                label="완독 시기"
                hint="년-월까지만 받습니다. 오래된 책의 날짜를 정확히 기억하긴 어렵습니다."
              >
                <input
                  id="finished_month"
                  name="finished_month"
                  type="month"
                  required
                  max={new Date().toISOString().slice(0, 7)}
                  className={inputClass}
                />
              </Field>

              <ReviewFields idPrefix="already-read" />

              <p className={hintClass}>
                읽은 시간은 기록에 없으므로 독서 시간 통계에는 잡히지 않습니다.
              </p>
            </div>
          )}
        </div>
      )}

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

      <details className="border-border rounded-xl border px-3 py-2">
        <summary className="text-muted-foreground cursor-pointer text-sm">
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
        <p role="alert" className={errorText}>
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "저장 중..." : submitLabel}
        </button>
        <Link href={cancelHref} className={quietLink}>
          취소
        </Link>
      </div>
    </form>
  );
}
