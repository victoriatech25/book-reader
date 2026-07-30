# 독서 기록 관리 웹앱

읽는 책의 진행 상태와 시간을 기록하고, 완독 후 한 줄 소감을 남기며, 쌓인 기록을 분야·태그별로 되돌아보는 개인 독서 관리 앱.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/PRD.md](docs/PRD.md) | 기획서 — 목표, 데이터 모델, 기능 명세, 화면 설계, 기술 아키텍처 |
| [docs/WORKPLAN.md](docs/WORKPLAN.md) | 작업계획서 — 작업 단위(W), 검증 레벨(V), 컨펌 게이트(G), 실행 규약 |

## 기술 스택

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth + Storage, RLS)
- Recharts · React Hook Form + Zod
- Vitest · Playwright
- Vercel 배포

## 현재 상태

기획 완료. 구현은 [작업계획서](docs/WORKPLAN.md) W0(저장소·툴체인 셋업)부터 시작한다.

## 개발

```bash
pnpm install
pnpm dev
```

환경변수는 `.env.example`을 `.env.local`로 복사해 채운다. `.env.local`은 커밋하지 않는다.
