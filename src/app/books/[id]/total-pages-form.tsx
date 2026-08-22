"use client";

import { useActionState, useState } from "react";

import { ACTION_IDLE, type ActionState } from "@/app/books/action-state";
import { updateTotalPagesAction } from "@/app/books/actions";
import { buttonSecondary, errorText, input } from "@/components/ui/styles";

export function TotalPagesForm({
  bookId,
  totalPages,
}: {
  bookId: string;
  totalPages: number | null;
}) {
  const [pages, setPages] = useState<string>(totalPages ? String(totalPages) : "");
  const [isEditing, setIsEditing] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const res = await updateTotalPagesAction(prev, formData);
      if (!res.error) {
        setIsEditing(false);
      }
      return res;
    },
    ACTION_IDLE,
  );


  if (!isEditing && totalPages) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground font-mono">전체 분량: {totalPages}쪽</span>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          수정
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="book_id" value={bookId} />
        <label htmlFor="total-pages-input" className="text-muted-foreground text-xs font-medium">
          전체 페이지수
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id="total-pages-input"
            name="total_pages"
            type="number"
            min={1}
            max={100000}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            placeholder="예: 320"
            className={`w-24 ${input} py-1 text-xs`}
          />
          <span className="text-muted-foreground text-xs">쪽</span>
        </div>

        <button type="submit" disabled={pending} className={`${buttonSecondary} min-h-9 px-3 text-xs`}>
          {pending ? "저장 중..." : "저장"}
        </button>

        {totalPages && (
          <button
            type="button"
            onClick={() => {
              setPages(String(totalPages));
              setIsEditing(false);
            }}
            className="text-muted-foreground hover:text-foreground px-1 text-xs"
          >
            취소
          </button>
        )}
      </form>

      {state.error && (
        <p role="alert" className={`mt-1 ${errorText} text-xs`}>
          {state.error}
        </p>
      )}
    </div>
  );
}
