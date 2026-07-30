"use client";

import { useActionState, useState } from "react";

import { ACTION_IDLE, type ActionState } from "@/app/books/action-state";
import { createNoteAction } from "@/app/books/actions";
import type { ProgressUnit } from "@/lib/reading-status";
import { NOTE_KIND_LABEL, NOTE_KINDS, NOTE_MAX_LENGTH } from "@/lib/reviews";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100";

type FieldsProps = {
  readingId: string;
  unit: ProgressUnit;
  target: number | null;
  state: ActionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
};

function NoteFields({ readingId, unit, target, state, formAction, pending }: FieldsProps) {
  const [body, setBody] = useState("");

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="reading_id" value={readingId} />

      <textarea
        name="body"
        rows={2}
        maxLength={NOTE_MAX_LENGTH}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-label="인용구 내용"
        placeholder="기억하고 싶은 문장이나 생각"
        className={`w-full ${inputClass}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <select name="kind" aria-label="종류" defaultValue="quote" className={inputClass}>
          {NOTE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {NOTE_KIND_LABEL[kind]}
            </option>
          ))}
        </select>

        <input
          name="location"
          type="number"
          min={0}
          max={target ?? undefined}
          aria-label={unit === "page" ? "쪽" : "위치 (%)"}
          placeholder={unit === "page" ? "쪽" : "%"}
          className={`w-24 ${inputClass}`}
        />

        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {pending ? "저장 중..." : "남기기"}
        </button>

        <span className="ml-auto font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {body.length} / {NOTE_MAX_LENGTH}
        </span>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function NoteForm(props: { readingId: string; unit: ProgressUnit; target: number | null }) {
  const [state, formAction, pending] = useActionState(createNoteAction, ACTION_IDLE);

  // 저장에 성공하면 savedAt이 바뀐다. key를 갈아 끼워 입력을 초기 상태로
  // 되돌린다 — 이펙트 안에서 setState를 부르지 않고 같은 결과를 얻는다.
  return (
    <NoteFields
      key={state.savedAt ?? "new"}
      {...props}
      state={state}
      formAction={formAction}
      pending={pending}
    />
  );
}
