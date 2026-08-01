"use client";

import { useActionState } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonSecondary, errorText, input } from "@/components/ui/styles";

import { createShelfAction, deleteShelfAction, updateShelfAction } from "./actions";

export type Shelf = {
  id: string;
  name: string;
  description: string | null;
  bookCount: number;
};

function ShelfRow({ shelf }: { shelf: Shelf }) {
  const [state, formAction, pending] = useActionState(updateShelfAction, ACTION_IDLE);

  return (
    <li className="border-border border-b py-3 last:border-b-0">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="shelf_id" value={shelf.id} />

        <div className="flex flex-wrap items-center gap-2">
          <input
            name="name"
            defaultValue={shelf.name}
            aria-label={`${shelf.name} 이름`}
            className={`w-52 ${input} py-1`}
          />
          <button
            type="submit"
            disabled={pending}
            aria-label={`${shelf.name} 저장`}
            className={buttonSecondary}
          >
            {pending ? "저장 중..." : "저장"}
          </button>
          <span className="text-muted-foreground ml-auto font-mono text-xs">
            {shelf.bookCount}권
          </span>
        </div>

        <input
          name="description"
          defaultValue={shelf.description ?? ""}
          aria-label={`${shelf.name} 설명`}
          placeholder="설명 (선택)"
          className={`w-full ${input} py-1`}
        />
      </form>

      {state.error && (
        <p role="alert" className={`mt-1 ${errorText} text-xs`}>
          {state.error}
        </p>
      )}

      <form action={deleteShelfAction} className="mt-1">
        <input type="hidden" name="shelf_id" value={shelf.id} />
        <ConfirmSubmit
          label="서재 삭제"
          triggerAriaLabel={`${shelf.name} 삭제`}
          triggerClassName="text-muted-foreground hover:text-destructive text-xs transition-colors"
          title={`"${shelf.name}" 서재를 삭제할까요?`}
          description={`담겨 있던 책 ${shelf.bookCount}권은 그대로 남고 묶음만 사라집니다.`}
          confirmLabel="삭제"
        />
      </form>
    </li>
  );
}

export function ShelfManager({ shelves }: { shelves: Shelf[] }) {
  const [state, formAction, pending] = useActionState(createShelfAction, ACTION_IDLE);

  return (
    <section>
      <h2 className="text-foreground text-base font-semibold">서재</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        분야·태그와 달리 성격이 없는 임의 묶음입니다. &ldquo;2026 상반기&rdquo;, &ldquo;회사
        스터디&rdquo;처럼 씁니다. 책은 상세 화면에서 담습니다.
      </p>

      {shelves.length > 0 && (
        <ul className="mt-4">
          {shelves.map((shelf) => (
            <ShelfRow key={shelf.id} shelf={shelf} />
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          name="name"
          aria-label="새 서재 이름"
          placeholder="새 서재 이름"
          className={`w-52 ${input} py-1`}
        />
        <button type="submit" disabled={pending} className={buttonSecondary}>
          {pending ? "만드는 중..." : "서재 만들기"}
        </button>
      </form>

      {state.error && (
        <p role="alert" className={`mt-2 ${errorText} text-xs`}>
          {state.error}
        </p>
      )}
    </section>
  );
}
