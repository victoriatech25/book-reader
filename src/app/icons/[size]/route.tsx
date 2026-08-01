import { ImageResponse } from "next/og";

/**
 * 앱 아이콘 (PRD §3.2 F16).
 *
 * 이미지 파일을 저장소에 넣지 않고 코드로 그린다. Next에 들어 있는
 * ImageResponse를 쓰므로 새 의존성이 없고, 디자인 토큰이 바뀌면 색만 고치면
 * 된다. 매니페스트가 참조할 수 있게 경로를 고정한다(/icons/192, /icons/512).
 *
 * 글자를 쓰지 않는다 — ImageResponse의 기본 폰트에는 한글이 없어서 "책"을
 * 그리려면 폰트 파일을 반입해야 한다. 도형만으로 책등을 표현한다.
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
      <div
        style={{
          width: inner,
          height: inner * 0.78,
          display: "flex",
          background: "#faf9f7",
          borderRadius: size * 0.03,
          overflow: "hidden",
        }}
      >
        {/* 책등 */}
        <div style={{ width: inner * 0.12, height: "100%", background: "#b4654a" }} />
        {/* 책장 — 가운데 접힌 선 */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ width: size * 0.012, height: "100%", background: "#e6e2db" }} />
        </div>
      </div>
    </div>,
    { width: size, height: size },
  );
}
