// 화면과 규칙을 잇는 상태 보관. 변경은 core/rules.ts의 순수 함수로만 한다.
import { useSyncExternalStore } from "react";
import type { AppState } from "../core/model";
import { emptyState } from "../core/model";
import { loadState, resetAll, saveState } from "../platform/storage";

let state: AppState = loadState();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

/** 새 상태를 저장한다. 변화가 없으면 false */
export function commit(next: AppState): boolean {
  if (next === state) return false;
  state = next;
  saveState(state);
  emit();
  return true;
}

export function update(fn: (s: AppState) => AppState): boolean {
  return commit(fn(state));
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
}

export async function resetApp(): Promise<void> {
  await resetAll();
  state = emptyState();
  emit();
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- 화면 사이에 잠깐 넘기는 값 (저장하지 않음) ----------

export const handoff: {
  /** 홈에서 캐릭터가 이 단계에서 걸어 올라가는 연출 (C6) */
  climbFrom: number | null;
  /** 온보딩 첫 미션(O8~O9)을 막 끝냈다 */
  firstClear: boolean;
  /** 클리어 화면이 보여줄 직전 제출 결과 */
  lastSubmit: { proofId: string; climbed: boolean; from: number; first: boolean } | null;
  /** 홈에 돌아오면 단계 팝업(C2)을 바로 연다 */
  openSheet: boolean;
  /** 이번에 PIN을 통과했다. 아이 영역으로 나가면 다시 잠근다 (ADR-007) */
  parentOk: boolean;
  /** 구독 안내(P7)를 닫으면 돌아갈 곳 */
  subscribeBack: string;
} = {
  climbFrom: null,
  firstClear: false,
  lastSubmit: null,
  openSheet: false,
  parentOk: false,
  subscribeBack: "/parent"
};
