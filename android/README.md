# 독서대 안드로이드 앱 (TWA)

배포된 `https://victoria-tech.com/reader/` 를 Chrome 엔진으로 띄우는 Trusted Web Activity 껍데기다.
화면과 로직은 전부 서버에 있고, APK 에는 아이콘·스플래시·시작 주소만 들어 있다.
웹을 배포하면 앱도 그대로 새 버전이 된다 — APK 를 다시 만들 일은 아이콘·이름·주소가 바뀔 때뿐이다.

Capacitor(WebView) 대신 TWA 를 쓴 이유: WebView 안에서는 Google OAuth 가 막히고(disallowed_useragent),
매직링크는 Chrome 에서 열려 세션이 앱으로 들어오지 않는다. TWA 는 Chrome 과 쿠키를 공유하므로
두 로그인 방식이 그대로 동작한다.

## 빌드

```bash
android/build-apk.sh
```

결과: `android/reader.apk` (서명됨). JDK 17 이상(기본: Android Studio 내장 JBR)과 `ANDROID_HOME` 이 필요하다.

## 설치 (USB 디버깅 켠 폰)

```bash
adb install -r android/reader.apk
```

폰에 Chrome 이 설치되어 있어야 한다.

## 서명 키

`android.keystore` 와 비밀번호 파일 `.keystore.env` 는 커밋하지 않는다(.gitignore).
**잃어버리면 같은 앱 위에 업데이트 설치를 할 수 없다** — 따로 백업해 둔다.

키를 새로 만들면 SHA-256 지문을 다음 두 곳에서 함께 바꾼다.

- `android/assetlinks.json`
- `nginx/reader.conf` 의 `/.well-known/assetlinks.json` 블록

```bash
keytool -list -v -keystore android/android.keystore -alias reader
```

## 주소창 없이 띄우기 (Digital Asset Links)

TWA 는 도메인 루트의 `https://victoria-tech.com/.well-known/assetlinks.json` 이 이 앱의 서명 지문을
가리킬 때만 전체 화면으로 뜬다. 없으면 Custom Tab 처럼 위에 주소창이 보인다(기능은 동작한다).
`nginx/reader.conf` 에 이 응답이 들어 있으므로 서버의 snippet 을 갱신하고 nginx 를 reload 하면 된다.

## 프로젝트 재생성

`twa-manifest.json` 을 고친 뒤:

```bash
cd android && npx @bubblewrap/cli update --skipVersionUpgrade
```

`bubblewrap build` 는 SDK 에 옛 `tools/` 폴더가 없으면 실패하므로 빌드는 `build-apk.sh` 로 한다.
Bubblewrap 은 `~/.bubblewrap/config.json` 의 `jdkPath`·`androidSdkPath` 를 쓴다.
