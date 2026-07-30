/**
 * 카카오 책 검색 API 실응답 확인용 프로브.
 *
 * 두 가지를 눈으로 보기 위해 존재한다.
 *   1) 키가 살아 있고 검색이 실제로 동작하는가 (W4 DoD의 "실제 쿼리 1회")
 *   2) 응답에 페이지수 필드가 있는가 (PRD §6.1의 전제 검증)
 *
 *   node scripts/probe-kakao.mjs [검색어]
 */

import { readFileSync } from "node:fs";

const raw = readFileSync(".env.local", "utf8");
const apiKey = raw
  .split(/\r?\n/)
  .find((line) => /^\s*KAKAO_REST_API_KEY\s*=/.test(line))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim();

if (!apiKey) {
  console.error("KAKAO_REST_API_KEY 가 .env.local 에 없습니다.");
  process.exit(1);
}

const query = process.argv[2] ?? "사피엔스";
const url = new URL("https://dapi.kakao.com/v3/search/book");
url.searchParams.set("query", query);
url.searchParams.set("size", "3");

const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
console.log(`GET /v3/search/book?query=${query} → ${res.status} ${res.statusText}`);

if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}

const json = await res.json();
console.log(`meta: ${JSON.stringify(json.meta)}`);

const [first] = json.documents;
if (!first) {
  console.log("검색 결과 없음");
  process.exit(0);
}

console.log(`\n응답 문서가 가진 필드 (${Object.keys(first).length}개):`);
console.log(`  ${Object.keys(first).sort().join(", ")}`);

// 페이지수로 쓸 만한 필드가 있는지 이름 기준으로 훑는다.
const pageLike = Object.keys(first).filter((k) => /page|pages|쪽|면수/i.test(k));
console.log(
  `\n페이지수 후보 필드: ${pageLike.length > 0 ? pageLike.join(", ") : "없음 — 사용자 입력 필요 (PRD §6.2)"}`,
);

console.log("\n첫 번째 결과:");
for (const key of ["title", "authors", "translators", "publisher", "datetime", "isbn", "status"]) {
  console.log(`  ${key.padEnd(12)} ${JSON.stringify(first[key])}`);
}
console.log(`  thumbnail    ${first.thumbnail ? "있음" : "없음"}`);
