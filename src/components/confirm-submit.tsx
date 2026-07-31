"use client";

import { useRef } from "react";

import { buttonSecondary } from "./ui/styles";

/**
 * 되돌릴 수 없는 제출 앞에 확인을 한 번 받는다.
 *
 * 감싸는 form 안에 놓고 쓴다. 다이얼로그는 showModal()로 최상위 레이어에
 * 올라가지만 DOM 상으로는 form 안에 남아 있어서, 안쪽 submit 버튼이 바깥
 * form을 그대로 제출한다.
 *
 * 책 삭제는 FK cascade로 readings·progress_logs·notes까지 함께 지운다.
 * 실사용 데이터가 쌓이기 시작한 뒤로는 클릭 한 번에 사라지면 안 된다.
 */
export function ConfirmSubmit({
  label,
  title,
  description,
  confirmLabel,
  triggerClassName,
  triggerAriaLabel,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  triggerClassName: string;
  triggerAriaLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label={triggerAriaLabel}
        onClick={() => dialogRef.current?.showModal()}
        className={triggerClassName}
      >
        {label}
      </button>

      <dialog
        ref={dialogRef}
        aria-label={title}
        className="border-border bg-card text-card-foreground m-auto w-[min(24rem,calc(100vw-2rem))] rounded-lg border p-5 backdrop:bg-black/40"
      >
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-2 text-sm">{description}</p>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="submit"
            className="bg-destructive rounded-md px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={buttonSecondary}
          >
            취소
          </button>
        </div>
      </dialog>
    </>
  );
}
