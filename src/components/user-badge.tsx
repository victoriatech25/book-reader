import { quietLink } from "./ui/styles";

/** 로그인한 사용자 표시 + 로그아웃. 표현만 담당하는 순수 컴포넌트. */
export function UserBadge({ email }: { email: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {/*
        globals.css가 한글 목록을 위해 overflow-wrap: anywhere 를 걸어둔다.
        그대로 두면 좁은 화면에서 긴 주소가 밀어내며 "로그아웃"이 단어 중간에
        잘린다. 주소는 줄이고 버튼은 붙어 있게 한다.
      */}
      <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">{email}</span>
      <form action="/auth/signout" method="post" className="shrink-0">
        <button type="submit" className={`${quietLink} text-xs whitespace-nowrap`}>
          로그아웃
        </button>
      </form>
    </div>
  );
}
