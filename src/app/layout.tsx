import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/service-worker";

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
 * 사용자가 직접 고른 테마만 클래스로 박는다.
 *
 * 아무것도 안 골랐으면(=시스템) 클래스를 붙이지 않는다. 그러면 globals.css의
 * prefers-color-scheme 규칙이 그대로 먹어서, OS 설정이 바뀌면 JS 없이 CSS가
 * 알아서 따라간다 — matchMedia 리스너를 두고 클래스를 갈아끼우는 것보다
 * 움직이는 부품이 적고, JS가 꺼져 있어도 동작한다.
 *
 * 인라인으로 두는 이유는 첫 페인트 전에 실행되어야 하기 때문이다. 나중에
 * 붙이면 라이트로 그려진 뒤 다크로 뒤집혀 깜빡인다.
 */
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.classList.add(t)}}catch(e){}})()`;

export const metadata: Metadata = {
  title: "독서대",
  description: "읽은 책의 진행 상태와 한 줄 소감을 기록하는 개인 독서 관리 앱",
  // 홈 화면에 얹었을 때 iOS가 브라우저 껍데기 없이 띄우도록 한다.
  appleWebApp: { capable: true, title: "독서대", statusBarStyle: "default" },
};

/**
 * 주소창·상태바 색. 라이트/다크 각각 배경과 같은 값이라야 화면이 이어져 보인다.
 * globals.css의 --background와 같은 색이다.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1a18" },
  ],
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
      <body className="flex min-h-full flex-col">
        {/*
          키보드로 들어온 사람이 화면마다 반복되는 네비게이션을 매번 지나치지
          않도록 한다. 평소에는 감춰져 있다가 탭으로 포커스가 오면 나타난다.
        */}
        <a
          href="#main"
          className="bg-card text-foreground border-border focus:ring-ring/50 sr-only rounded-md border px-4 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:ring-2"
        >
          본문 바로가기
        </a>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
