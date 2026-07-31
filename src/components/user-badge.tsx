import { quietLink } from "./ui/styles";

/** 로그인한 사용자 표시 + 로그아웃. 표현만 담당하는 순수 컴포넌트. */
export function UserBadge({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground font-mono text-xs">{email}</span>
      <form action="/auth/signout" method="post">
        <button type="submit" className={`${quietLink} text-xs`}>
          로그아웃
        </button>
      </form>
    </div>
  );
}
