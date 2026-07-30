/** 로그인한 사용자 표시 + 로그아웃. 표현만 담당하는 순수 컴포넌트. */
export function UserBadge({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{email}</span>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
