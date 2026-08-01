/**
 * 서비스워커 — 오프라인 읽기 (PRD §3.2 F16).
 *
 * 캐시를 둘로 나눈다.
 *
 *   static — 빌드 산출물(/_next/static)과 아이콘. 내용이 해시로 구분되므로
 *            한 번 받으면 그대로 써도 된다.
 *   pages  — 방문했던 화면. 오프라인에서 다시 볼 수 있게 한다.
 *
 * 인증·데이터 경로(api, auth)는 절대 캐시하지 않는다. 카카오 검색 프록시와 인증
 * 경로가 여기 걸리면 남의 세션으로 받은 응답이 남을 수 있다. 다른 도메인
 * (Supabase·표지 이미지)도 손대지 않는다.
 *
 * pages 캐시는 로그인한 사람의 화면이다. 로그아웃할 때 앱이 메시지를 보내
 * 지운다(components/user-badge.tsx). 한 기기를 나눠 쓸 때 이전 사람의 서재가
 * 오프라인으로 보이면 안 된다.
 */

const VERSION = "v1";
const STATIC_CACHE = `book-reader-static-${VERSION}`;
const PAGE_CACHE = `book-reader-pages-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** 앱이 로그아웃할 때 보낸다. 방문 기록을 지운다. */
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 우리 도메인이 아니면 손대지 않는다 (Supabase·카카오 표지 이미지).
  if (url.origin !== self.location.origin) return;

  // 인증·데이터 경로는 항상 네트워크로. 캐시에 남기지 않는다.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (isStaticAsset(url)) {
    // 해시가 붙은 산출물이라 한 번 받으면 바뀌지 않는다.
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    // 화면은 항상 최신을 먼저 시도한다. 오프라인일 때만 캐시를 꺼낸다 —
    // 반대로 하면 방금 기록한 진행률이 안 보인다.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match(OFFLINE_URL))),
    );
  }
});
