import { ImageResponse } from "next/og";

/**
 * 앱 아이콘 (PRD §3.2 F16).
 *
 * 이미지 파일을 저장소에 넣지 않고 코드로 그린다. Next에 들어 있는
 * ImageResponse를 쓰므로 새 의존성이 없고, 디자인 토큰이 바뀌면 색만 고치면
 * 된다. 매니페스트가 참조할 수 있게 경로를 고정한다(/icons/192, /icons/512).
 *
 * 글자를 쓰지 않는다 — ImageResponse의 기본 폰트에는 한글이 없어서 "책"을
 * 그리려면 폰트 파일을 반입해야 한다. 도형만으로 서가를 표현한다.
 *
 * 형상은 헤더의 BrandMark(서가)와 같다. 여기는 SVG path를 못 쓰므로(satori가
 * div 박스만 그린다) 책등을 박스로, 선반을 가로 막대로 쌓는다.
 */
const SIZES = [192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = Number(raw);

  if (!SIZES.includes(size as (typeof SIZES)[number])) {
    return new Response("Not found", { status: 404 });
  }

  // 마스커블 아이콘은 바깥 20%가 잘릴 수 있다. 안쪽 60%에만 그린다.
  const pad = size * 0.2;
  const inner = size - pad * 2;

  const PAPER = "#faf9f7";
  const TERRACOTTA = "#b4654a";

  const spine = (height: number, background: string) => ({
    width: inner * 0.15,
    height: inner * height,
    background,
    borderRadius: inner * 0.02,
  });

  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#2a2724",
      }}
    >
      <div style={{ width: inner, height: inner, display: "flex", flexDirection: "column" }}>
        {/* 책등 — 높이를 다르게 두어야 꽂아둔 것처럼 보인다 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: inner * 0.05,
          }}
        >
          <div style={spine(0.74, PAPER)} />
          <div style={spine(0.88, TERRACOTTA)} />
          <div style={spine(0.66, PAPER)} />
          {/* 기대어 선 책. satori의 회전축은 박스 중심이라, 기울어진 만큼
              아래로 내려앉는 것을 여백으로 되돌린다. */}
          <div
            style={{
              ...spine(0.68, PAPER),
              transform: "rotate(-13deg)",
              marginBottom: inner * 0.02,
              marginLeft: inner * 0.03,
            }}
          />
        </div>
        {/* 선반 */}
        <div
          style={{
            height: inner * 0.075,
            background: PAPER,
            borderRadius: inner * 0.04,
          }}
        />
      </div>
    </div>,
    { width: size, height: size },
  );
}
