import { categoryColor } from "@/lib/taxonomy/category";

type BookCoverProps = {
  title: string;
  coverUrl?: string | null;
  categoryColorVal?: string | null;
  categorySortOrder?: number;
  className?: string;
};

/**
 * 도서 표지 컴포넌트.
 *
 * 표지 이미지가 있으면 렌더링하고, 없으면 카테고리 색상 기반의
 * 은은한 그라데이션과 책 제목 첫 글자, 세리프 감성을 담은
 * 미니 북 커버 플레이스홀더를 렌더링한다.
 */
export function BookCover({
  title,
  coverUrl,
  categoryColorVal,
  categorySortOrder = 0,
  className = "aspect-[2/3] w-full rounded-sm",
}: BookCoverProps) {
  if (coverUrl) {
    return (
      // 표지는 외부 도메인 이미지이므로 img 태그 사용
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={`object-cover ${className}`}
      />
    );
  }

  const baseColor = categoryColor(categoryColorVal ?? null, categorySortOrder);
  const initial = title.trim().charAt(0) || "책";

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden border border-border/40 p-2 select-none ${className}`}
      style={{
        backgroundColor: `${baseColor}15`,
        borderColor: `${baseColor}30`,
      }}
      aria-label={`${title} (표지 없음)`}
    >
      {/* 책등(Spine) 입체감 효과 */}
      <div
        className="absolute top-0 bottom-0 left-0 w-1 opacity-40"
        style={{ backgroundColor: baseColor }}
      />

      <div className="pl-1 text-left">
        <span
          className="font-serif text-[11px] font-medium tracking-tight line-clamp-2"
          style={{ color: baseColor }}
        >
          {title}
        </span>
      </div>

      <div className="flex items-end justify-end">
        <span
          className="font-serif text-lg font-bold opacity-30 select-none"
          style={{ color: baseColor }}
        >
          {initial}
        </span>
      </div>
    </div>
  );
}
