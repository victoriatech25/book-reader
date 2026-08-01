"use client";

import { useEffect } from "react";

/**
 * 서비스워커 등록 (PRD §3.2 F16).
 *
 * 개발 중에는 등록하지 않는다. 캐시가 끼면 코드를 고쳐도 옛 화면이 뜨고,
 * 그걸 캐시 탓이라고 알아채기까지 한참 걸린다.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // 첫 화면이 그려진 뒤에 등록한다. 등록 자체가 첫 렌더와 대역폭을 다투지
    // 않게 한다.
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("[sw] 등록 실패", error);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

/**
 * 로그아웃할 때 방문 기록 캐시를 지운다.
 *
 * pages 캐시에는 로그인한 사람의 서재가 들어 있다. 한 기기를 나눠 쓸 때
 * 다음 사람이 오프라인으로 그걸 보면 안 된다.
 */
export async function clearPageCache(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  registration?.active?.postMessage("clear-pages");
}
