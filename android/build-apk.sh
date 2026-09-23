#!/usr/bin/env bash
# 독서대 안드로이드 앱(TWA) 서명 APK 빌드.
#
#   android/build-apk.sh           → android/reader.apk
#
# bubblewrap build 는 SDK에 옛 `tools/` 폴더가 없으면 "androidSdk isn't correct"로
# 멈춘다. 그래서 프로젝트 생성만 bubblewrap(update)에 맡기고, 빌드·정렬·서명은
# Gradle과 build-tools로 직접 한다.
#
# 필요한 것 (커밋하지 않는다 — .gitignore):
#   android/android.keystore   서명 키. 잃어버리면 같은 앱으로 업데이트 설치가 안 된다.
#   android/.keystore.env      BUBBLEWRAP_KEYSTORE_PASSWORD / BUBBLEWRAP_KEY_PASSWORD
set -euo pipefail

cd "$(dirname "$0")"

# Android Gradle Plugin 은 JDK 17 이상이 필요하다. 시스템 JAVA_HOME 이 더 낮을 수
# 있으므로 Android Studio 내장 JBR 을 기본으로 쓰고, ANDROID_JAVA_HOME 으로 바꿀 수 있다.
JAVA_HOME="${ANDROID_JAVA_HOME:-/c/Program Files/Android/Android Studio/jbr}"
: "${ANDROID_HOME:?ANDROID_HOME 이 필요합니다}"
export JAVA_HOME

[ -f android.keystore ] || { echo "android.keystore 가 없습니다" >&2; exit 1; }
[ -f .keystore.env ] || { echo ".keystore.env 가 없습니다" >&2; exit 1; }
set -a; . ./.keystore.env; set +a

# 가장 높은 버전의 build-tools 를 쓴다.
BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"

./gradlew assembleRelease --no-daemon -q

UNSIGNED=app/build/outputs/apk/release/app-release-unsigned.apk
ALIGNED=app/build/outputs/apk/release/app-release-aligned.apk

"$BT/zipalign" -f -p 4 "$UNSIGNED" "$ALIGNED"
"$JAVA_HOME/bin/java" -jar "$BT/lib/apksigner.jar" sign \
  --ks android.keystore --ks-key-alias reader \
  --ks-pass env:BUBBLEWRAP_KEYSTORE_PASSWORD --key-pass env:BUBBLEWRAP_KEY_PASSWORD \
  --out reader.apk "$ALIGNED"
"$JAVA_HOME/bin/java" -jar "$BT/lib/apksigner.jar" verify reader.apk

echo "완료: android/reader.apk"
