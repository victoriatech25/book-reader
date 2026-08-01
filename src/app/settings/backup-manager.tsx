"use client";

import { useActionState } from "react";

import { ACTION_IDLE } from "@/app/books/action-state";
import { buttonSecondary, errorText, input, quietLink } from "@/components/ui/styles";
import { DUPLICATE_POLICIES, DUPLICATE_POLICY_LABEL } from "@/lib/backup/import-plan";

import { importBackupAction } from "./actions";

/**
 * 백업 내보내기·가져오기 (PRD §3.2 F15).
 *
 * 내보내기는 링크다 — 라우트 핸들러가 Content-Disposition을 붙여 내려준다.
 * 가져오기만 서버 액션이다.
 */
export function BackupManager() {
  const [state, formAction, pending] = useActionState(importBackupAction, ACTION_IDLE);

  return (
    <section>
      <h2 className="text-foreground text-base font-semibold">백업</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        기록 전체를 파일로 받아두고, 필요할 때 다시 얹습니다.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {/* download 속성이 있어야 브라우저가 새 탭 대신 저장으로 간다. */}
        <a href="/api/backup" download className={buttonSecondary}>
          전체 백업 내려받기 (JSON)
        </a>
        <a href="/api/backup?format=csv" download className={quietLink}>
          완독 목록 (CSV)
        </a>
      </div>

      <form action={formAction} className="border-border mt-6 rounded-md border p-4">
        <h3 className="text-foreground text-sm font-medium">백업 가져오기</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          지우고 덮어쓰지 않습니다. 지금 서재에 <strong>얹습니다.</strong>
        </p>

        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="backup-file" className="text-muted-foreground block text-xs">
              백업 파일 (.json)
            </label>
            <input
              id="backup-file"
              name="file"
              type="file"
              accept="application/json,.json"
              required
              className={`mt-1 w-full ${input} py-1.5 text-sm`}
            />
          </div>

          <div>
            <label htmlFor="backup-policy" className="text-muted-foreground block text-xs">
              이미 있는 책은
            </label>
            <select
              id="backup-policy"
              name="policy"
              defaultValue="skip"
              className={`mt-1 w-full ${input} py-1.5`}
            >
              {DUPLICATE_POLICIES.map((policy) => (
                <option key={policy} value={policy}>
                  {DUPLICATE_POLICY_LABEL[policy]}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={pending} className={buttonSecondary}>
            {pending ? "가져오는 중..." : "가져오기"}
          </button>
        </div>

        {state.error && (
          <p role="alert" className={`mt-3 ${errorText} text-xs`}>
            {state.error}
          </p>
        )}

        {state.message && (
          <p role="status" className="text-muted-foreground mt-3 text-xs">
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}
