import type { Metadata } from "next";

export const metadata: Metadata = { title: "오프라인 · book-reader" };

/**
 * 네트워크가 없고 캐시에도 없는 화면일 때 서비스워커가 대신 보여준다.
 *
 * 로그인을 요구하지 않는다 — 오프라인이면 세션을 확인할 방법도 없다.
 * (proxy.ts의 PUBLIC_PATHS에 넣어둔 이유다.)
 */
export default function OfflinePage() {
  return (
    <div className="bg-background flex flex-1 items-center justify-center px-6 py-16">
      <main id="main" className="w-full max-w-sm text-center">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">연결이 끊겼습니다</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          이미 열어본 화면은 오프라인에서도 볼 수 있습니다. 기록은 연결이 돌아온 뒤에 저장됩니다.
        </p>
      </main>
    </div>
  );
}
