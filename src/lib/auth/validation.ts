import { z } from "zod";

/** 로그인 폼. 메시지는 그대로 사용자에게 노출된다. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "이메일을 입력하세요.")
    .pipe(z.email("이메일 형식이 올바르지 않습니다.")),
});

export type LoginInput = z.infer<typeof loginSchema>;
