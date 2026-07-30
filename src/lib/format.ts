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

/** 진행률(%). target이 없거나 0이면 0으로 본다. */
export function progressPercent(current: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}
