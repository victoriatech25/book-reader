"use client";

import { useActionState } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonSecondary, errorText, input } from "@/components/ui/styles";
import { categoryColor } from "@/lib/taxonomy/category";

import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "./actions";

export type Category = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  bookCount: number;
};

/**
 * 분야 한 줄. 이름과 색을 그 자리에서 고친다.
 *
 * 색을 비우면 다시 팔레트 배정으로 돌아간다 — DB에 hex를 박아두지 않는
 * 설계(PRD §2.3)를 화면에서도 되돌릴 수 있어야 한다.
 */
function CategoryRow({ category }: { category: Category }) {
  const [state, formAction, pending] = useActionState(updateCategoryAction, ACTION_IDLE);
  const swatch = categoryColor(category.color, category.sort_order);

  return (
    <li className="border-border border-b py-3 last:border-b-0">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="category_id" value={category.id} />

        <span
          aria-hidden
          className="size-4 shrink-0 rounded-full"
          style={{ backgroundColor: swatch }}
        />

        <input
          name="name"
          defaultValue={category.name}
          aria-label={`${category.name} 이름`}
          className={`w-40 ${input} py-1`}
        />

        <input
          name="color"
          type="color"
          defaultValue={swatch}
          aria-label={`${category.name} 색`}
          className="border-border bg-card h-11 w-14 cursor-pointer rounded-xl border p-1"
        />

        <button
          type="submit"
          disabled={pending}
          aria-label={`${category.name} 저장`}
          className={buttonSecondary}
        >
          {pending ? "저장 중..." : "저장"}
        </button>

        <span className="text-muted-foreground ml-auto font-mono text-xs">
          {category.bookCount}권
        </span>
      </form>

      {state.error && (
        <p role="alert" className={`mt-1 ${errorText} text-xs`}>
          {state.error}
        </p>
      )}

      <form action={deleteCategoryAction} className="mt-1">
        <input type="hidden" name="category_id" value={category.id} />
        <ConfirmSubmit
          label="분야 삭제"
          triggerAriaLabel={`${category.name} 삭제`}
          triggerClassName="text-muted-foreground hover:text-destructive text-xs transition-colors"
          title={`"${category.name}" 분야를 삭제할까요?`}
          description={`이 분야를 쓰던 책 ${category.bookCount}권은 그대로 남고, 분야만 "선택 안 함"이 됩니다.`}
          confirmLabel="삭제"
        />
      </form>
    </li>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(createCategoryAction, ACTION_IDLE);

  return (
    <section>
      <h2 className="text-foreground text-base font-semibold">분야</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        책당 하나만 고릅니다. 통계의 분류 축이라 단일 선택이어야 합니다.
      </p>

      <ul className="mt-4">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </ul>

      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          name="name"
          aria-label="새 분야 이름"
          placeholder="새 분야 이름"
          className={`w-48 ${input} py-1`}
        />
        <button type="submit" disabled={pending} className={buttonSecondary}>
          {pending ? "추가 중..." : "분야 추가"}
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
