"use client";

import { useActionState, useState } from "react";

import { ACTION_IDLE, type ActionState } from "@/app/books/action-state";
import { createNoteAction } from "@/app/books/actions";
import { buttonSecondary, errorText, input } from "@/components/ui/styles";
import type { ProgressUnit } from "@/lib/reading-status";
import { NOTE_KIND_LABEL, NOTE_KINDS, NOTE_MAX_LENGTH } from "@/lib/reviews";

const inputClass = input;

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
        className={`w-full ${inputClass} font-serif`}
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
          className={buttonSecondary}
        >
          {pending ? "저장 중..." : "남기기"}
        </button>

        <span className="text-muted-foreground ml-auto font-mono text-xs">
          {body.length} / {NOTE_MAX_LENGTH}
        </span>
      </div>

      {state.error && (
        <p role="alert" className={errorText}>
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
