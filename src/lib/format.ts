/**
 * 날짜 표시. 앱은 개인용이고 profiles.timezone 기본값이 Asia/Seoul이므로
 * 서울 기준으로 고정한다. 서버·클라이언트가 같은 문자열을 만들어야
 * 하이드레이션 불일치가 나지 않는다.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return DATE_FORMAT.format(date);
}

const YEAR_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
});

/**
 * 연도만 뽑는다. 서재의 연도 필터가 쓴다.
 *
 * new Date().getFullYear()를 쓰면 실행 환경의 시간대를 따라가서, 12월 31일
 * 밤에 완독한 책이 서버와 브라우저에서 다른 해로 잡힌다. 표시와 같은
 * 서울 기준으로 고정한다.
 */
export function yearOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return YEAR_FORMAT.format(date);
}
