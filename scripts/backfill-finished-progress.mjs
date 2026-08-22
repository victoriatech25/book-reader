import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]),
);

const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const secret = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.");
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("기존 완독(finished) 상태인 회차들의 진행률 보정 시작...");

  // status = 'finished' 인 모든 회차 조회
  const { data: readings, error } = await supabase
    .from("readings")
    .select("id, progress_unit, current_value, target_value, status, books(title)")
    .eq("status", "finished");

  if (error) {
    console.error("조회 실패:", error);
    process.exit(1);
  }

  console.log(`총 ${readings.length}개의 완독 레코드 확인.`);

  let updatedCount = 0;

  for (const r of readings) {
    const target = r.target_value ?? (r.progress_unit === "percent" ? 100 : r.current_value);

    // current_value가 target에 도달하지 않은 경우 업데이트
    if (r.current_value !== target) {
      const bookTitle = r.books?.title ?? r.id;
      console.log(`[보정] '${bookTitle}': ${r.current_value} -> ${target} (${r.progress_unit})`);

      const { error: updateErr } = await supabase
        .from("readings")
        .update({ current_value: target })
        .eq("id", r.id);

      if (updateErr) {
        console.error(`  -> 실패 (${r.id}):`, updateErr);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`\n보정 완료: 총 ${updatedCount}개 레코드 업데이트됨.`);
}

run();
