import { NextResponse } from "next/server";

import { backupFileName, finishedCsv } from "@/lib/backup/csv";
import { collectBackup, finishedRowsFrom } from "@/lib/backup/collect";
import { seoulToday } from "@/lib/stats/aggregate";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * 백업 내려받기 (PRD §3.2 F15).
 *
 *   GET /api/backup            → 전체 JSON
 *   GET /api/backup?format=csv → 완독 목록 CSV
 *
 * 서버 액션이 아니라 라우트 핸들러인 이유는 파일 다운로드이기 때문이다.
 * Content-Disposition을 붙여야 브라우저가 저장 대화상자를 띄운다.
 *
 * 프록시가 미로그인 요청을 401로 막지만(/api/ 경로), 여기서도 세션을 확인한다.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." } },
      { status: 401 },
    );
  }

  const backup = await collectBackup(supabase);
  const today = seoulToday();
  const format = new URL(request.url).searchParams.get("format");

  if (format === "csv") {
    return new NextResponse(finishedCsv(finishedRowsFrom(backup)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(backupFileName("csv", today))}`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(backupFileName("json", today))}`,
      "Cache-Control": "no-store",
    },
  });
}
