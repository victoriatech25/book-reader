# AWS EC2 배포 — `victoria-tech.com/reader`

작성 2026-09-18. **실제로 확인한 구성에 맞춰 쓴다.** 새 인스턴스·인증서·CloudFront 를 만들지 않는다.

## 1. 구성

```text
브라우저
  │ https
  ▼
Route53 (victoria-tech.com)
  └─ victoria-tech.com / www ─→ CloudFront E1LVX4HU2ZI7MU (TLS, 기존 배포 공용)
                                   │ http :80
                                   ▼
                     EC2 i-0939aa0c7a548c785 (c7i-flex.large, x86_64, Ubuntu 24.04)
                          nginx :80  sites-enabled/default
                           ├─ /            → 127.0.0.1:3001  홈페이지 (PM2)
                           ├─ /ebook /pdf  → /var/www/…      정적 PWA
                           └─ /reader      → 127.0.0.1:3100  **독서대 (docker)**
                          dcshop.victoria-tech.com → 127.0.0.1:5000
```

- 앱은 `basePath: "/reader"`, `output: "standalone"` 으로 빌드한다 (`next.config.ts`).
- 컨테이너 안은 3000, 호스트에는 `127.0.0.1:3100` 으로만 게시한다. 3000·3001·5000 은 다른 앱이 쓴다.
- TLS 는 CloudFront 가 맡는다. **certbot 을 쓰지 않는다.**
- CloudFront 기본 동작이 모든 경로를 nginx 로 넘기므로 CloudFront 쪽 변경은 없다.
- 데이터·인증은 Supabase(원격) 그대로.

## 2. 이미지는 ghcr 에서 받는다

서버 디스크가 9GB 에 여유 2GB 남짓이라 **서버에서 빌드하지 않는다.** dcshop·subtrack 과 같은 방식이다.

```bash
# 로컬(Mac)에서. 인스턴스가 Intel 이므로 반드시 linux/amd64.
docker login ghcr.io -u victoriatech25            # write:packages PAT
TAG=$(git rev-parse --short HEAD)
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=… \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
  -t ghcr.io/victoriatech25/book-reader:$TAG --push .
```

`NEXT_PUBLIC_*` 는 빌드 시점에 번들에 박히므로 build-arg 로 넘긴다. 공개 가능한 값이다.

## 3. 서버 준비 (최초 1회)

```
/home/ubuntu/book-reader/
  .env         # 아래 참조. 권한 600
  deploy.sh    # 저장소 scripts/deploy.sh 복사본
```

`.env` (런타임):

```ini
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
KAKAO_REST_API_KEY=…
```

`SUPABASE_SERVICE_ROLE_KEY` 는 **넣지 않는다.** 런타임이 쓰지 않는다.

**비밀값은 SSM 명령으로 보내지 않는다.** 명령 이력에 평문으로 남는다. 고정 IP 에서 `scp` 로 올린다.

ghcr 은 비공개라 서버가 받을 때 인증이 필요하다. 같은 계정이므로 `/home/ubuntu/dcshop/.ghcr-user`·`.ghcr-token`(read:packages) 을 재사용한다 — `deploy.sh` 가 그렇게 되어 있다.

## 4. nginx

저장소 `nginx/reader.conf` 를 `/etc/nginx/snippets/reader.conf` 에 두고, `sites-enabled/default` 의 `server_name victoria-tech.com www.victoria-tech.com;` 블록 안(`location /` 앞)에 한 줄 넣는다.

```nginx
    include /etc/nginx/snippets/reader.conf;
```

```bash
sudo cp /etc/nginx/sites-enabled/default /etc/nginx/backups/default.$(date +%Y%m%d%H%M)  # sites-enabled 안에 두지 않는다
sudo nginx -t && sudo systemctl reload nginx
```

## 5. 배포

서버에는 SSM 으로 지시만 보낸다. SSH 22 는 고정 IP 두 개로만 열려 있다.

```bash
aws ssm send-command --instance-ids i-0939aa0c7a548c785 \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["sudo -u ubuntu bash /home/ubuntu/book-reader/deploy.sh <태그>"]'
```

`deploy.sh` 는 pull → 이전 컨테이너 보존 → 기동 → `/reader/login` 응답 확인 → 실패 시 되돌림 → 이미지 정리 순서로 돈다.

되돌리기: 이전 태그로 `deploy.sh <이전태그>` 를 다시 돌린다.

## 6. 외부 서비스 설정 (서브패스로 바뀌었으므로 반드시)

### Supabase — Authentication → URL Configuration
- Site URL: `https://victoria-tech.com/reader`
- Redirect URLs 에 추가: `https://victoria-tech.com/reader/**`

목록에 없으면 매직링크가 Site URL 로 갈아끼워져 엉뚱한 곳에 세션이 생긴다 (`src/lib/auth/redirect-to.ts` 주석 참조).

### 카카오 개발자 콘솔 — 앱 설정 → 플랫폼 → Web
- 사이트 도메인에 `https://victoria-tech.com` 추가.

## 7. 확인

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://victoria-tech.com/reader/login      # 200
curl -s -o /dev/null -w "%{http_code}\n" https://victoria-tech.com/reader            # 307 → /reader/login (미로그인)
curl -s https://victoria-tech.com/reader/manifest.webmanifest | head -c 200
```

## 8. 첫 배포에서 겪은 것 (2026-09-19)

| 증상 | 원인 | 조치 |
|---|---|---|
| Google 로그인 후 Vercel 404 | Supabase Redirect URLs 에 새 주소가 없어 Site URL 로 갈아끼움 | §6 설정 |
| `/auth/confirm` 에서 502 | 세션 쿠키 `Set-Cookie` 가 nginx 기본 프록시 버퍼(4k) 초과 | `reader.conf` 버퍼 32k |
| `http://0.0.0.0:3000/reader/` 로 리다이렉트 | 컨테이너 안 `request.url` 이 바인딩 주소 | `src/lib/request-origin.ts` — `Host`·`X-Forwarded-Proto` 우선 |
| 리다이렉트가 `http://` | CloudFront→nginx 가 평문이라 `$scheme` 이 http | `reader.conf` 에서 `X-Forwarded-Proto https` 고정 |
