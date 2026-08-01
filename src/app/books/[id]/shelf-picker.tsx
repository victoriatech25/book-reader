import Link from "next/link";

import { toggleShelfBookAction } from "@/app/settings/actions";
import { quietLink } from "@/components/ui/styles";

/**
 * 책을 서재에 담거나 뺀다 (PRD §2.1 B).
 *
 * 서재는 분야·태그와 달리 성격이 없는 임의 묶음이라 등록 폼이 아니라 상세
 * 화면에 둔다 — "2026 상반기"에 넣을지는 책을 담을 때가 아니라 나중에
 * 정하는 일이다.
 *
 * 서버 액션 폼만 쓰므로 클라이언트 컴포넌트가 아니다.
 */
export function ShelfPicker({
  bookId,
  shelves,
  memberOf,
}: {
  bookId: string;
  shelves: { id: string; name: string }[];
  memberOf: Set<string>;
}) {
  if (shelves.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        아직 서재가 없습니다.{" "}
        <Link href="/settings" className={`${quietLink} text-xs`}>
          설정에서 만들기
        </Link>
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {shelves.map((shelf) => {
        const inShelf = memberOf.has(shelf.id);

        return (
          <li key={shelf.id}>
            <form action={toggleShelfBookAction}>
              <input type="hidden" name="shelf_id" value={shelf.id} />
              <input type="hidden" name="book_id" value={bookId} />
              <button
                type="submit"
                aria-pressed={inShelf}
                className={
                  inShelf
                    ? "border-primary bg-primary text-primary-foreground rounded-full border px-3 py-1 text-xs transition-opacity hover:opacity-90"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground rounded-full border px-3 py-1 text-xs transition-colors"
                }
              >
                {inShelf ? "✓ " : "+ "}
                {shelf.name}
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
