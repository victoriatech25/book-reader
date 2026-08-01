"use client";

import { useActionState } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { deleteGoalAction, setGoalAction } from "@/app/settings/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonSecondary, errorText, input } from "@/components/ui/styles";
import {
  formatMinutes,
  GOAL_METRIC_LABEL,
  GOAL_PERIOD_LABEL,
  type GoalMetric,
  type GoalPeriod,
  type GoalProgress,
} from "@/lib/stats/aggregate";

import { GoalGauge } from "./charts";

export type GoalCardData = {
  id: string;
  period: GoalPeriod;
  metric: GoalMetric;
  target: number;
  progress: GoalProgress;
};

function amount(value: number, metric: GoalMetric): string {
  return metric === "books" ? `${value}권` : formatMinutes(value);
}

/** 세워둔 목표 하나. 게이지와 남은 양을 보여준다 (PRD §3.1 F10). */
function GoalRow({ goal }: { goal: GoalCardData }) {
  const label = `${GOAL_PERIOD_LABEL[goal.period]} ${GOAL_METRIC_LABEL[goal.metric]} 목표`;

  return (
    <li className="border-border border-b py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-foreground text-sm font-medium">{label}</span>
        <span className="text-muted-foreground font-mono text-xs">
          {amount(goal.progress.achieved, goal.metric)} / {amount(goal.target, goal.metric)}
        </span>
      </div>

      <div className="mt-2">
        <GoalGauge percent={goal.progress.percent} label={`${label} 달성률`} />
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground text-xs">
          {goal.progress.reached
            ? "목표를 채웠습니다."
            : `${amount(goal.progress.remaining, goal.metric)} 남았습니다.`}
        </span>

        <form action={deleteGoalAction}>
          <input type="hidden" name="goal_id" value={goal.id} />
          <ConfirmSubmit
            label="목표 삭제"
            triggerAriaLabel={`${label} 삭제`}
            triggerClassName="text-muted-foreground hover:text-destructive text-xs transition-colors"
            title={`${label}를 지울까요?`}
            description="읽은 기록은 그대로 남고 목표만 사라집니다."
            confirmLabel="삭제"
          />
        </form>
      </div>
    </li>
  );
}

export function GoalCard({ goals }: { goals: GoalCardData[] }) {
  const [state, formAction, pending] = useActionState(setGoalAction, ACTION_IDLE);

  return (
    <section>
      <h2 className="text-foreground text-sm font-medium">목표</h2>

      {goals.length > 0 ? (
        <ul className="mt-2">
          {goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm">
          아직 목표가 없습니다. 아래에서 세워보세요.
        </p>
      )}

      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
        <select
          name="period"
          aria-label="목표 기간"
          defaultValue="year"
          className={`${input} py-1`}
        >
          <option value="year">연간</option>
          <option value="month">월간</option>
        </select>

        <select
          name="metric"
          aria-label="목표 지표"
          defaultValue="books"
          className={`${input} py-1`}
        >
          <option value="books">권수</option>
          <option value="minutes">시간(분)</option>
        </select>

        <input
          name="target"
          type="number"
          min={1}
          aria-label="목표치"
          placeholder="목표치"
          className={`w-24 ${input} py-1`}
        />

        <button type="submit" disabled={pending} className={buttonSecondary}>
          {pending ? "저장 중..." : "목표 세우기"}
        </button>
      </form>

      {state.error && (
        <p role="alert" className={`mt-2 ${errorText} text-xs`}>
          {state.error}
        </p>
      )}
    </section>
  );
}
