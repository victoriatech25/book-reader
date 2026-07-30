const NEXT_STEPS = [
  { id: "U1", label: "외부 서비스 준비 (Supabase · 카카오 키 발급)" },
  { id: "W2", label: "DB 스키마 · 마이그레이션" },
  { id: "W3", label: "인증 · 세션" },
];

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <main className="w-full max-w-xl">
        <p className="font-mono text-xs tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
          W0 · 툴체인 셋업 완료
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          book-reader
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          읽은 책의 진행 상태와 한 줄 소감을 기록하는 개인 독서 관리 앱.
        </p>

        <h2 className="mt-10 text-sm font-medium text-zinc-900 dark:text-zinc-100">다음 작업</h2>
        <ol className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {NEXT_STEPS.map((step) => (
            <li key={step.id} className="flex items-baseline gap-3 py-2.5">
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{step.id}</span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{step.label}</span>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          기획은 <code className="font-mono">docs/PRD.md</code>, 작업 단위는{" "}
          <code className="font-mono">docs/WORKPLAN.md</code>를 참고한다.
        </p>
      </main>
    </div>
  );
}
