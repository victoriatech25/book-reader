/**
 * 앱 마크. 제목 옆에 붙는다.
 *
 * 서가 — 꽂힌 책 세 권과 옆에 기대어 선 한 권. 앱 아이콘(/icons/[size])과 같은
 * 형상이다. 다만 아이콘의 먹색 배경 사각형은 뺐다. 제목 옆에서는 그게 덩어리로
 * 앉는다.
 *
 * 색은 디자인 토큰을 쓴다. 아이콘은 값을 박아야 해서(ImageResponse가 CSS
 * 변수를 모른다) 두 곳의 색이 갈라지는데, 마크 쪽이 테마를 따라가는 편이
 * 화면에서 자연스럽다.
 *
 * 글자로 이름이 바로 옆에 있으므로 스크린리더에는 읽히지 않게 한다.
 */
export function BrandMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <rect
        x="4.4"
        y="8.4"
        width="2.9"
        height="10.6"
        rx="0.4"
        className="fill-card stroke-foreground"
        strokeWidth="1.1"
      />
      {/* 가운데 한 권만 테라코타. 차트 색과 같은 토큰이라 화면 전체가 한 색조로 묶인다. */}
      <rect x="8" y="6.6" width="2.7" height="12.4" rx="0.4" className="fill-chart-1" />
      <rect
        x="11.4"
        y="9.4"
        width="3"
        height="9.6"
        rx="0.4"
        className="fill-card stroke-foreground"
        strokeWidth="1.1"
      />
      {/* 기대어 선 책. 밑변 왼쪽 모서리를 축으로 돌려야 바닥에서 뜨지 않는다. */}
      <rect
        x="16.2"
        y="9.6"
        width="2.8"
        height="9.4"
        rx="0.4"
        transform="rotate(-15 16.2 19)"
        className="fill-card stroke-foreground"
        strokeWidth="1.1"
      />
      {/* 선반. 마지막에 그어 책 밑동을 덮는다. */}
      <path
        d="M2.8 19.4h18.4"
        className="stroke-foreground"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
