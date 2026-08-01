import { categoryColor } from "@/lib/taxonomy/category";
import { barRatios, donutSlices } from "@/lib/stats/chart";
import type { CategoryShare, MonthlyCount } from "@/lib/stats/aggregate";

/*
 * 차트는 전부 서버에서 렌더되는 SVG다. 클라이언트 JS가 0이고, 라이브러리를
 * 넣지 않았다. 각도·비율 계산은 lib/stats/chart.ts의 순수 함수가 한다.
 */

/** 분야 분포 도넛 (PRD §3.1 F9). */
export function CategoryDonut({ shares, size = 160 }: { shares: CategoryShare[]; size?: number }) {
  const slices = donutSlices(
    shares.map((share) => share.count),
    { size, thickness: 26 },
  );

  if (slices.length === 0) {
    return <p className="text-muted-foreground text-sm">완독한 책이 아직 없습니다.</p>;
  }

  const total = shares.reduce((sum, share) => sum + share.count, 0);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`분야 분포. 전체 ${total}권. ${shares
          .map((share) => `${share.name} ${share.count}권`)
          .join(", ")}`}
        className="shrink-0"
      >
        {slices.map((slice, index) =>
          slice.path === "" ? null : (
            <path
              key={shares[index].id ?? "none"}
              d={slice.path}
              fill={categoryColor(shares[index].color, shares[index].sortOrder)}
            />
          ),
        )}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground font-mono text-lg"
        >
          {total}권
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {shares.map((share, index) => (
          <li key={share.id ?? "none"} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor(share.color, share.sortOrder) }}
            />
            <span className="text-foreground min-w-0 flex-1 truncate">{share.name}</span>
            <span className="text-muted-foreground shrink-0 font-mono text-xs">
              {share.count}권 · {slices[index].percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 월별 완독 추이 막대 (PRD §3.1 F9). */
export function MonthlyBars({ months }: { months: MonthlyCount[] }) {
  const ratios = barRatios(months.map((entry) => entry.count));
  const total = months.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <div
      role="img"
      aria-label={
        total === 0
          ? "월별 완독 추이. 완독한 책이 없습니다."
          : `월별 완독 추이. ${months
              .filter((entry) => entry.count > 0)
              .map((entry) => `${entry.month}월 ${entry.count}권`)
              .join(", ")}`
      }
      // items-end를 주면 열이 콘텐츠 높이로 줄어들어 안쪽 flex-1 트랙이
      // 높이를 못 받는다. 열은 늘어나야 하고, 막대만 아래에 붙는다.
      className="flex h-32 items-stretch gap-1.5"
    >
      {months.map((entry, index) => (
        <div key={entry.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-muted-foreground font-mono text-[0.6875rem]">
            {entry.count > 0 ? entry.count : ""}
          </span>
          <div className="bg-muted flex w-full flex-1 items-end rounded-sm">
            <div
              className="bg-chart-1 w-full rounded-sm transition-[height]"
              // 값이 있는데 막대가 안 보이면 0과 구분이 안 된다. 최소 높이를 준다.
              style={{ height: entry.count > 0 ? `${Math.max(8, ratios[index] * 100)}%` : "0%" }}
            />
          </div>
          <span className="text-muted-foreground font-mono text-[0.6875rem]">{entry.month}</span>
        </div>
      ))}
    </div>
  );
}

/** 목표 게이지. */
export function GoalGauge({ percent, label }: { percent: number; label: string }) {
  return (
    <div>
      <div
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
