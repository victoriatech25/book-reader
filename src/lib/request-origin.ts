/**
 * 요청이 실제로 도착한 공개 origin 을 돌려준다.
 *
 * 컨테이너 안에서 Next 는 `request.url` 을 자기 바인딩 주소(`http://0.0.0.0:3000`)로
 * 만든다. 그것으로 리다이렉트를 만들면 브라우저가 `0.0.0.0:3000` 으로 가서
 * 열리지 않는다(실제로 겪었다). 프록시(nginx)가 넘겨주는 `Host` 와
 * `X-Forwarded-Proto` 를 우선하고, 없을 때만 `request.url` 로 돌아간다.
 */
export function requestOrigin(request: Request): string {
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return new URL(request.url).origin;

  // 여러 프록시를 거치면 "https, http" 처럼 쉼표로 이어진다. 첫 값이 바깥쪽이다.
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    new URL(request.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}
