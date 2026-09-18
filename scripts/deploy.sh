#!/usr/bin/env bash
#
# 서버에서 도는 배포 스크립트.
#
#   사용법: deploy.sh <이미지태그>
#
# 이 파일은 저장소가 원본이고, 서버의 /home/ubuntu/book-reader/deploy.sh 로 복사해 둔다.
# 이미지는 ghcr 에서 받는다 — 서버에서 빌드하지 않는다(디스크 여유가 없다).
set -euo pipefail

TAG="${1:?이미지 태그를 넘기세요}"
IMAGE="ghcr.io/victoriatech25/book-reader:${TAG}"

DIR="/home/ubuntu/book-reader"
ENV_FILE="${DIR}/.env"
CONTAINER="book-reader"
PORT=3100

echo "=== 배포 시작: ${TAG} ==="

[ -f "$ENV_FILE" ] || { echo "환경파일이 없습니다: $ENV_FILE"; exit 1; }

# ghcr 은 비공개라 인증이 필요하다. 토큰(read:packages PAT)은 서버에만 둔다.
# dcshop 과 같은 계정이므로 그쪽 토큰을 그대로 쓴다.
GHCR_DIR="/home/ubuntu/dcshop"
if [ -f "${GHCR_DIR}/.ghcr-token" ]; then
  echo "--- ghcr 로그인"
  docker login ghcr.io -u "$(cat "${GHCR_DIR}/.ghcr-user")" \
    --password-stdin < "${GHCR_DIR}/.ghcr-token" >/dev/null
fi

echo "--- 이미지 받기"
docker pull "$IMAGE"

# 이전 컨테이너는 되돌릴 수 있도록 이름만 바꿔 남겨 둔다.
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "--- 이전 컨테이너 정리"
  docker rm -f "${CONTAINER}-previous" 2>/dev/null || true
  docker stop "$CONTAINER" >/dev/null
  docker rename "$CONTAINER" "${CONTAINER}-previous"
fi

echo "--- 기동"
docker run -d --name "$CONTAINER" --restart unless-stopped \
  -p "127.0.0.1:${PORT}:3000" \
  --env-file "$ENV_FILE" \
  -e NODE_ENV=production -e PORT=3000 -e TZ=Asia/Seoul \
  "$IMAGE"

# 로그인 화면은 인증 없이 열리는 경로라 상태 확인에 쓴다.
echo "--- 상태 확인"
ok=0
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/reader/login"; then
    ok=1
    break
  fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  echo "!! /reader/login 이 응답하지 않습니다. 최근 로그:"
  docker logs --tail 50 "$CONTAINER" || true
  echo "!! 이전 컨테이너로 되돌립니다."
  docker rm -f "$CONTAINER"
  if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER}-previous"; then
    docker rename "${CONTAINER}-previous" "$CONTAINER"
    docker start "$CONTAINER"
    echo "되돌렸습니다."
  fi
  exit 1
fi

# nginx 를 지난 경로도 확인한다. 여기까지 200 이면 CloudFront 만 남는다.
code=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: victoria-tech.com" http://127.0.0.1/reader/login)
echo "nginx 경유: $code"

echo "--- 정리"
docker rm -f "${CONTAINER}-previous" 2>/dev/null || true
docker image prune -af >/dev/null 2>&1 || true
df -h / | tail -1

echo "=== 배포 완료: ${TAG} ==="
docker ps --filter "name=${CONTAINER}" --format '{{.Names}} | {{.Image}} | {{.Status}}'
