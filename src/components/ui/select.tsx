import { input } from "./styles";

/**
 * 선택 컨트롤.
 *
 * 네이티브 `<select>`를 그대로 쓴다. 목록 자체는 OS가 그리게 두는 편이
 * 모바일에서 낫다 — iOS는 휠, 안드로이드는 시트로 뜬다. 직접 만든 드롭다운은
 * 그 감각을 흉내 내지 못하고, 키보드·스크린리더 동작을 전부 다시 만들어야 한다.
 *
 * 바꾼 것은 껍데기뿐이다. 브라우저 기본 화살표(appearance)는 OS마다 모양이
 * 다르고 하나같이 웹 폼으로 읽혀서, 끄고 같은 자리에 우리 화살표를 얹는다.
 *
 * 화살표를 배경 이미지가 아니라 svg로 넣는 이유는 색이다. 배경 이미지에는
 * data URI로 색을 박아야 하는데, 그러면 테마 셋(라이트·다크·세피아)에서 한
 * 가지 색으로 남는다. svg는 currentColor를 따라간다.
 */
export function Select({
  className = "",
  selectClassName = "",
  children,
  ...props
}: React.ComponentProps<"select"> & { selectClassName?: string }) {
  return (
    // inline-grid라 폭이 select 내용에 맞춰진다. 호출부가 w-full을 주면 늘어난다.
    <span className={`text-muted-foreground relative inline-grid items-center ${className}`}>
      <select
        {...props}
        className={`${input} w-full cursor-pointer appearance-none pr-9 ${selectClassName}`}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        focusable="false"
        className="pointer-events-none absolute right-3 size-4"
      >
        <path
          d="M4 6.5 8 10.5 12 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
