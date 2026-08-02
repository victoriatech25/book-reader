/**
 * 화면이 공유하는 클래스 문자열.
 *
 * 같은 입력·버튼 스타일이 파일마다 복사돼 있어서 한 곳만 고치면 화면끼리
 * 어긋났다. 여기 모아두고, 값은 전부 globals.css의 시맨틱 토큰을 참조한다.
 * 팔레트 이름(zinc-500 같은 것)을 화면 코드에 다시 쓰지 않는다 — 그러면
 * 디자인 컨셉을 바꿀 때 또 전 화면을 뒤져야 한다.
 *
 * ── 앱처럼 보이게 하는 규칙 (W12.5)
 *
 * 웹 폼처럼 보이던 것을 앱 컨트롤로 바꿨다. 요점은 네 가지다.
 *
 * 1. **누를 자리는 44px 이상.** 손가락 기준이다. 글자 크기가 아니라 min-h로
 *    잡아야 짧은 라벨("★")도 같은 크기로 눌린다.
 * 2. **누르면 반응한다.** hover는 마우스에만 있다. 손가락에는 눌리는 순간의
 *    축소(active:scale)가 유일한 피드백이다.
 * 3. **테두리보다 면.** 흰 바탕에 얇은 테두리를 두른 입력칸은 웹 폼으로 읽힌다.
 *    바탕색을 한 단 낮춘 면으로 채우고 테두리는 포커스에서만 세운다.
 * 4. **밑줄 링크를 쓰지 않는다.** 문서의 관습이다. 보조 동작도 눌리는 자리
 *    (여백 있는 알약)로 둔다.
 */

/**
 * 눌리는 것 전부의 공통 규칙.
 *
 * transition에 all을 쓰지 않는다 — 색·그림자·변형만 움직여야 레이아웃이
 * 흔들리지 않는다.
 */
const tappable =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 select-none " +
  "transition-[background-color,color,box-shadow,transform,opacity] duration-150 " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

/** 페이지 바깥 틀. 본문 폭은 화면마다 다르므로 여기 넣지 않는다. */
export const pageShell = "flex flex-1 justify-center bg-background px-5 py-10";

export const card = "rounded-2xl border border-border bg-card p-4";

/**
 * 폭은 넣지 않는다. 호출부가 w-full / w-24 를 붙인다 — 여기에 w-full을 박으면
 * 좁게 쓰려는 곳(인용 위치, 진행 값)에서 덮어쓰기 싸움이 난다.
 *
 * 평소에는 테두리 없는 면이고, 포커스에서만 테두리와 링이 선다. 자리가
 * 흔들리지 않게 테두리는 늘 있되 평소엔 투명이다.
 */
export const input =
  "min-h-11 rounded-xl border border-transparent bg-secondary px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 outline-none " +
  "transition-[background-color,border-color,box-shadow] duration-150 " +
  "focus:border-ring/60 focus:bg-card focus:ring-4 focus:ring-ring/15";

export const label = "block text-sm font-medium text-foreground";

export const hint = "mt-1 text-xs text-muted-foreground";

/** 네이티브 체크박스. 앱처럼 크고, 색은 토큰을 따라간다. */
export const checkbox = "size-5 shrink-0 cursor-pointer accent-primary";

export const buttonPrimary =
  `${tappable} min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold ` +
  "text-primary-foreground shadow-sm hover:bg-primary/90";

export const buttonSecondary =
  `${tappable} min-h-11 rounded-xl bg-secondary px-4 text-sm font-medium ` +
  "text-secondary-foreground hover:bg-accent";

/** 본문 흐름을 끊지 않는 보조 동작. 밑줄 대신 눌리면 바탕이 깔린다. */
export const quietLink =
  `${tappable} min-h-9 rounded-lg px-2.5 text-sm text-muted-foreground ` +
  "hover:bg-secondary hover:text-foreground";

export const dangerLink = `${tappable} min-h-9 rounded-lg px-2.5 text-sm text-destructive hover:bg-destructive/10`;

/**
 * 세그먼티드 컨트롤 (테마 선택, 서재 상태 탭).
 *
 * 트랙 위에 알약 하나가 얹힌 형태다. 밑줄 탭은 웹 문서의 것이고, 알약은
 * 모바일 앱의 것이다. 트랙에 가로 스크롤을 허용해 좁은 화면에서 줄이 접히지
 * 않게 한다 — 탭이 두 줄이 되면 그 순간 앱이 아니라 페이지로 보인다.
 */
export const segmentTrack =
  "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-secondary p-1 " +
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export const segmentItem =
  `${tappable} min-h-9 shrink-0 rounded-full px-3.5 text-sm whitespace-nowrap ` +
  "text-muted-foreground hover:text-foreground";

/*
 * 골라둔 칸. bg-card가 아니라 bg-elevated다 — 다크에서는 card가 트랙(secondary)
 * 보다 어두워서, 고른 칸이 오히려 가라앉아 보인다. elevated는 세 테마 모두에서
 * 트랙보다 위에 있다.
 */
export const segmentItemActive =
  `${tappable} min-h-9 shrink-0 rounded-full bg-elevated px-3.5 text-sm font-medium ` +
  "whitespace-nowrap text-foreground shadow-sm";

export const errorText = "text-sm text-destructive";

/** 진행률·페이지·날짜처럼 자리가 흔들리면 안 되는 숫자. */
export const numeric = "font-mono text-xs text-muted-foreground";
