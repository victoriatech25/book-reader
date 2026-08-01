/**
 * 서버 액션의 반환 형태.
 *
 * "use server" 파일은 async 함수만 export할 수 있어서 상수·타입은 여기 둔다.
 */
export type ActionState = {
  error: string | null;
  /**
   * 저장에 성공한 시각. 성공할 때마다 값이 바뀌므로 클라이언트가 "방금 저장됐다"를
   * 알아채고 입력을 비울 수 있다. 초기 상태(ACTION_IDLE)와도 구분된다.
   */
  savedAt?: number;
  /**
   * 성공했을 때 보여줄 문장. 대부분의 액션은 결과가 화면에 바로 보이므로
   * 필요 없지만, 백업 가져오기처럼 "몇 권이 들어왔는지"를 말해줘야 하는
   * 경우가 있다.
   */
  message?: string;
};

export const ACTION_IDLE: ActionState = { error: null };

export function actionSaved(message?: string): ActionState {
  return { error: null, savedAt: Date.now(), message };
}
