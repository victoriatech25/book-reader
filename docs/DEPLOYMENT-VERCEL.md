# Vercel 배포 체크리스트

> 실제 Vercel 프로젝트 연결과 공개 배포는 G5 승인 뒤에 한다. 이 문서는 U14 준비와 W14 검증의 정본이다.

## 1. 현재 배포 전제

- GitHub 저장소: `victoriatech25/book-reader`
- 프로덕션 브랜치: `main`
- 프레임워크: Next.js (Vercel 자동 감지)
- 패키지 관리자: `package.json`의 `packageManager`에 고정된 pnpm
- 빌드 명령: `pnpm build`
- DB·인증: 외부 Supabase 프로젝트
- 별도 `vercel.json`은 필요 없다. 함수 지역은 Supabase 지역을 확인한 뒤 Vercel 프로젝트 설정에서 선택한다.

Vercel Git 연동 뒤에는 `main` 푸시가 프로덕션 배포를, 다른 브랜치 푸시가 Preview 배포를 자동으로 만든다.

## 2. Vercel 런타임 환경변수

Production과 Preview에 아래 3개만 등록한다.

| 이름                            | 공개 여부 | 용도                                          |
| ------------------------------- | --------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | 공개      | Supabase Project URL                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개      | Supabase Publishable key (`sb_publishable_…`) |
| `KAKAO_REST_API_KEY`            | 비공개    | 서버의 카카오 책 검색 프록시                  |

다음 값은 Vercel에 등록하지 않는다.

- `SUPABASE_SERVICE_ROLE_KEY`: RLS를 우회하는 관리자 키다. 앱 런타임은 사용하지 않고 로컬 RLS·E2E 검증에서만 쓴다.
- `NEXT_PUBLIC_SITE_URL`: 현재 앱은 로그인 요청 시 브라우저의 `window.location.origin`으로 콜백 URL을 만들므로 사용하지 않는다.

환경변수를 바꾼 뒤에는 기존 배포에 소급 적용되지 않으므로 새 배포를 실행한다. 값은 `.env.local`에서 복사하되 화면·로그·커밋에 노출하지 않는다.

## 3. 함수 지역

Vercel 함수의 기본 지역은 미국 동부(`iad1`)다. Supabase Dashboard에서 프로젝트 지역을 확인하고 가능한 한 같은 Vercel Function Region을 고른다.

- Supabase가 Seoul이면 Vercel `icn1`을 선택한다.
- 지역을 모르는 상태에서 `vercel.json`에 임의로 고정하지 않는다.
- 위치: Vercel Project → Settings → Functions → Function Regions

이 앱의 동적 화면과 서버 액션은 Supabase 왕복이 많아서 사용자 위치보다 DB 위치에 함수를 맞추는 것이 우선이다. 정적 자산은 Vercel CDN이 가까운 엣지에서 제공한다.

## 4. Supabase Auth URL

Supabase Dashboard → Authentication → URL Configuration에서 설정한다.

### Production

- Site URL: `https://<production-domain>`
- Redirect URL: `https://<production-domain>/auth/confirm`

### Local·Preview

- Local: `http://localhost:3000/**`
- Preview를 실제 로그인 테스트에 쓸 때만: `https://*-<vercel-team-or-account-slug>.vercel.app/**`

프로덕션은 가능한 한 정확한 도메인과 콜백 경로만 허용한다. Preview 와일드카드는 팀·계정 slug를 정확히 제한하고, Preview 로그인이 필요 없으면 추가하지 않는다.

## 5. 프로젝트 가져오기

1. Vercel에서 **New Project**를 열고 GitHub의 `victoriatech25/book-reader`를 선택한다.
2. Framework Preset이 Next.js인지 확인한다.
3. Root Directory는 저장소 루트(`.`)로 둔다.
4. Production Branch는 `main`으로 둔다.
5. §2의 환경변수 3개를 Production에 입력한다. Preview를 쓸 경우 Preview에도 별도로 입력한다.
6. §3의 함수 지역을 선택한다.
7. Supabase Auth URL을 §4대로 설정한다.
8. G5 승인 뒤 첫 배포를 실행한다.

저장소를 가져오는 즉시 초기 배포가 시작될 수 있으므로 환경변수와 Supabase URL 설정을 Deploy 버튼보다 먼저 끝낸다.

## 6. W14 프로덕션 검증

배포 URL을 받은 뒤 다음 순서로 확인한다.

1. `https://<domain>/login`이 열리고 HTTPS가 정상이다.
2. 실제 이메일로 매직링크를 요청하고 같은 배포 도메인의 `/auth/confirm`으로 돌아온다.
3. 카카오 검색 → 책 등록 → 읽기 시작 → 진행 기록 → 완독 → 소감 저장을 수행한다.
4. `/library`, `/settings`, 홈 통계와 백업 JSON·CSV 다운로드를 확인한다.
5. 매니페스트, 192/512 아이콘, 서비스워커와 모바일 홈 화면 추가를 확인한다.
6. 배포 환경 전체 E2E를 실행한다.

```bash
PLAYWRIGHT_BASE_URL=https://<production-domain> pnpm test:e2e
```

E2E는 로컬 `.env.local`의 서비스 키로 임시 테스트 사용자를 만들고 끝날 때 정리한다. 서비스 키를 Vercel에 올리는 것은 아니다.

## 7. 운영과 롤백

- 배포 직후 Vercel Runtime Logs에서 인증·카카오 프록시 오류가 없는지 확인한다.
- 첫 실사용 전 Vercel의 지출 한도와 알림을 설정한다.
- 문제가 있으면 Vercel Deployments에서 직전 정상 배포로 롤백한다.
- 서비스워커 변경 뒤에는 `public/sw.js`의 `VERSION`을 올려 이전 캐시를 정리한다.
- 도메인을 바꾸면 Vercel만 고치지 말고 Supabase Site URL·Redirect URLs도 함께 바꾼다.
