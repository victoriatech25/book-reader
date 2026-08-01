import type { MetadataRoute } from "next";

/**
 * 웹 앱 매니페스트 (PRD §3.2 F16).
 *
 * "PC에서 기록하고 모바일에서 확인"(PRD §1.2)이 목표라, 모바일에서 홈 화면에
 * 얹었을 때 브라우저 껍데기 없이 뜨는 것이 핵심이다.
 *
 * 색은 globals.css의 "서재" 토큰과 같은 값이다 — 스플래시와 주소창이 앱과
 * 다른 색이면 얹은 뒤에 이질감이 든다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "book-reader — 독서 기록",
    short_name: "book-reader",
    description: "읽는 책의 진행 상태와 한 줄 소감을 기록하는 개인 독서 관리 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f7",
    theme_color: "#faf9f7",
    lang: "ko",
    orientation: "portrait",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
