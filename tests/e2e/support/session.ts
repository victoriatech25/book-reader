import type { Page } from "@playwright/test";

import { issueMagicLinkTokenHash } from "./supabase-admin";

/**
 * 실제 로그인 경로를 그대로 통과한다.
 * 쿠키를 손으로 심지 않으므로 /auth/confirm 의 세션 생성 로직도 함께 검증된다.
 */
export async function loginAs(page: Page, email: string, next = "/"): Promise<void> {
  const tokenHash = await issueMagicLinkTokenHash(email);
  await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=${next}`);
}
