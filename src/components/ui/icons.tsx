/**
 * 이동 링크에 붙는 아이콘.
 *
 * 아이콘 패키지를 새로 들이지 않고 직접 그린다 — 필요한 것이 세 개뿐이고,
 * 앱 마크(BrandMark)도 같은 방식이라 선 굵기와 성격이 맞는다. 패키지를 넣으면
 * 그 라이브러리의 그림체가 우리 마크 옆에 나란히 서게 된다.
 *
 * 전부 currentColor를 따라간다. 글자 옆에 서므로 색·크기가 글자와 함께
 * 움직여야 한다. 이름이 바로 옆에 글자로 있으니 스크린리더에는 감춘다.
 */
type IconProps = { className?: string };

function Svg({ className = "size-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** 집. 대시보드로 돌아가는 링크. */
export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.8 10.4 12 3.8l8.2 6.6" />
      <path d="M5.8 9.6v9.4a1.2 1.2 0 0 0 1.2 1.2h10a1.2 1.2 0 0 0 1.2-1.2V9.6" />
      <path d="M10 20.2v-5.4h4v5.4" />
    </Svg>
  );
}

/**
 * 조절 손잡이.
 *
 * 톱니바퀴를 먼저 그렸다가 버렸다. 16px에서는 이와 굴대와 테가 서로 붙어
 * 그냥 동그라미 한 덩어리로 뭉갠다. 가로선 두 개와 손잡이 두 개는 같은
 * 크기에서 형태가 남고, 설정 화면이 실제로 하는 일(분야·태그·백업·테마를
 * 조절하는 것)과도 맞는다.
 */
export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8.6h6.2M14.2 8.6H20" />
      <circle cx="12.2" cy="8.6" r="2" />
      <path d="M4 15.4h3.6M11.6 15.4H20" />
      <circle cx="9.6" cy="15.4" r="2" />
    </Svg>
  );
}

/** 뒤로. 홈이 아니라 "왔던 화면"으로 돌아가는 자리에만 쓴다. */
export function BackIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Svg>
  );
}

/**
 * 펼친 책. 서재로 가는 링크.
 *
 * 앱 마크와 같은 서가로 그리면 16px에서 책등 세 개가 "00\"처럼 뭉치고,
 * 무엇보다 제목 옆의 마크와 같은 그림이 링크에 또 나온다. 펼친 책은 획이
 * 굵고 가운데가 비어 작은 크기에서 형태가 남는다.
 */
export function LibraryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 7.6v11.8" />
      <path d="M12 7.6C10.2 6 7.6 5.4 4.2 5.6v11.6c3.4-.2 6 .4 7.8 2" />
      <path d="M12 7.6c1.8-1.6 4.4-2.2 7.8-2v11.6c-3.4-.2-6 .4-7.8 2" />
    </Svg>
  );
}
