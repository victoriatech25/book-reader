/**
 * 서버 액션의 반환 형태.
 *
 * "use server" 파일은 async 함수만 export할 수 있어서 상수·타입은 여기 둔다.
 */
export type ActionState = { error: string | null };

export const ACTION_IDLE: ActionState = { error: null };
