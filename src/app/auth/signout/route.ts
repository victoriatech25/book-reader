import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/** 로그아웃. GET으로 열리면 링크 프리페치만으로 세션이 끊기므로 POST만 받는다. */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", new URL(request.url).origin), {
    status: 303,
  });
}
