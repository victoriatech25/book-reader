# 독서 기록 관리 웹앱

읽는 책의 진행 상태와 시간을 기록하고, 완독 후 한 줄 소감을 남기며, 쌓인 기록을 분야·태그별로 되돌아보는 개인 독서 관리 앱.

## 문서

| 문서                                 | 내용                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| [docs/PRD.md](docs/PRD.md)           | 기획서 — 목표, 데이터 모델, 기능 명세, 화면 설계, 기술 아키텍처    |
| [docs/WORKPLAN.md](docs/WORKPLAN.md) | 작업계획서 — 작업 단위(W), 검증 레벨(V), 컨펌 게이트(G), 실행 규약 |
| [docs/STATUS.md](docs/STATUS.md)     | **현재 상태와 주의점** — 인수인계용. 새 세션은 여기부터 읽는다     |

## 기술 스택

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth + Storage, RLS)
- Recharts · React Hook Form + Zod
- Vitest · Playwright
- Vercel 배포

## 현재 상태

**W7까지 완료 — 핵심 루프(등록 → 진행 기록 → 완독 → 소감·인용구)가 동작한다.** G3 실사용 컨펌 대기 중이며, 분야·태그·통계는 그 이후다. 자세한 내용과 주의점은 [docs/STATUS.md](docs/STATUS.md).

## 개발

```bash
pnpm install
pnpm dev
```

환경변수는 `.env.example`을 `.env.local`로 복사해 채운다. `.env.local`은 커밋하지 않는다.

## 검증

```bash
pnpm verify       # typecheck + lint + 단위 테스트 + build (커밋 전)
pnpm verify:rls   # 실제 DB 왕복 + RLS 격리 검증
pnpm test:e2e     # Playwright E2E (프로덕션 빌드 대상)
```

`pnpm verify`만으로는 RLS가 뚫려도 알 수 없다. 스키마나 서버 액션을 건드렸으면 `pnpm verify:rls`를 함께 돌린다.
