import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/*
 * 폰트.
 *
 * 한글 본문·제목은 globals.css의 --font-body / --font-display 가 시스템 폰트
 * 스택으로 정의한다. next/font/google 은 한글 서브셋을 제공하지 않아서
 * (구글이 한글을 동적 서브셋으로 서빙한다) 여기서 받아봐야 라틴 글자만
 * 웹폰트가 되고 한글은 폴백으로 갈라진다 — 오히려 더 나쁘다.
 *
 * 숫자는 다르다. 진행률·페이지·날짜는 전부 라틴 글리프라 웹폰트가 온전히
 * 적용되고, 자리가 흔들리면 목록이 덜컹거리므로 고정폭을 쓴다.
 */
const numeric = IBM_Plex_Mono({
  variable: "--font-numeric",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * 첫 페인트 전에 테마 클래스를 붙인다. 이 스크립트가 없으면 라이트로 그려진
 * 뒤 다크로 뒤집혀 깜빡인다. .light / .dark 중 하나를 항상 붙이므로
 * globals.css의 prefers-color-scheme 폴백은 JS가 꺼졌을 때만 걸린다.
 *
 * 토글 UI는 W11에서 붙인다. localStorage의 theme 키를 미리 읽어두어 그때
 * 값을 쓰기만 하면 되도록 했다.
 */
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.add(t)}catch(e){document.documentElement.classList.add("light")}})()`;

export const metadata: Metadata = {
  title: "book-reader",
  description: "읽은 책의 진행 상태와 한 줄 소감을 기록하는 개인 독서 관리 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${numeric.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
