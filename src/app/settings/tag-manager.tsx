"use client";

import { useActionState } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonSecondary, errorText, input } from "@/components/ui/styles";

import { deleteTagAction, mergeTagsAction, renameTagAction } from "./actions";

export type Tag = { id: string; name: string; bookCount: number };

function TagRow({ tag }: { tag: Tag }) {
  const [state, formAction, pending] = useActionState(renameTagAction, ACTION_IDLE);

  return (
    <li className="border-border border-b py-3 last:border-b-0">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="tag_id" value={tag.id} />
        <span className="text-muted-foreground">#</span>
        <input
          name="name"
          defaultValue={tag.name}
          aria-label={`${tag.name} 이름`}
          className={`w-40 ${input} py-1`}
        />
        <button
          type="submit"
          disabled={pending}
          aria-label={`${tag.name} 저장`}
          className={buttonSecondary}
        >
          {pending ? "저장 중..." : "이름 바꾸기"}
        </button>

        <span className="text-muted-foreground ml-auto font-mono text-xs">{tag.bookCount}권</span>
      </form>

      {state.error && (
        <p role="alert" className={`mt-1 ${errorText} text-xs`}>
          {state.error}
        </p>
      )}

      <form action={deleteTagAction} className="mt-1">
        <input type="hidden" name="tag_id" value={tag.id} />
        <ConfirmSubmit
          label="태그 삭제"
          triggerAriaLabel={`${tag.name} 삭제`}
          triggerClassName="text-muted-foreground hover:text-destructive text-xs transition-colors"
          title={`"#${tag.name}" 태그를 삭제할까요?`}
          description={`태그가 붙은 책 ${tag.bookCount}권은 그대로 남고 태그만 떨어집니다.`}
          confirmLabel="삭제"
        />
      </form>
    </li>
  );
}

/**
 * 태그 병합.
 *
 * 자유 입력이라 같은 뜻인데 표기만 다른 태그가 쌓인다(`#SF` / `sf` /
 * `공상과학`). 검색 축으로 쓰려면 정리할 수 있어야 한다.
 */
function TagMerge({ tags }: { tags: Tag[] }) {
  const [state, formAction, pending] = useActionState(mergeTagsAction, ACTION_IDLE);

  if (tags.length < 2) return null;

  return (
    <form action={formAction} className="border-border mt-6 rounded-md border p-4">
      <h3 className="text-foreground text-sm font-medium">태그 합치기</h3>
      <p className="text-muted-foreground mt-1 text-xs">
        왼쪽 태그가 붙은 책들을 오른쪽 태그로 옮기고, 왼쪽 태그를 지웁니다.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select name="from" aria-label="합칠 태그" defaultValue="" className={`${input} py-1`}>
          <option value="">합칠 태그</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              #{tag.name} ({tag.bookCount})
            </option>
          ))}
        </select>

        <span className="text-muted-foreground text-sm">→</span>

        <select name="into" aria-label="남길 태그" defaultValue="" className={`${input} py-1`}>
          <option value="">남길 태그</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              #{tag.name} ({tag.bookCount})
            </option>
          ))}
        </select>

        <button type="submit" disabled={pending} className={buttonSecondary}>
          {pending ? "합치는 중..." : "합치기"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className={`mt-2 ${errorText} text-xs`}>
          {state.error}
        </p>
      )}
    </form>
  );
}

export function TagManager({ tags }: { tags: Tag[] }) {
  return (
    <section>
      <h2 className="text-foreground text-base font-semibold">태그</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        책당 여러 개 붙일 수 있습니다. 태그는 책을 등록·수정할 때 만들어집니다.
      </p>

      {tags.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          아직 태그가 없습니다. 책을 등록하거나 수정할 때 태그 칸에 적으면 여기 쌓입니다.
        </p>
      ) : (
        <>
          <ul className="mt-4">
            {tags.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
          </ul>
          <TagMerge tags={tags} />
        </>
      )}
    </section>
  );
}
