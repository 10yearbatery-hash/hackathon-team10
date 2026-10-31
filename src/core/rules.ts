// 규칙 계산과 상태 변경. 모두 (state, ...) => 값 또는 새 state 인 순수 함수다.
// 규칙을 어기는 요청은 state를 그대로 돌려준다. 규칙 번호는 docs/prd.md 8장.
import {
  COIN_PER_MISSION,
  LAST_STAGE,
  STAGES_PER_CHAPTER,
  CHAPTERS,
  VIDEO_SECONDS,
  CUSTOM_ICONS,
  GIFT_ICONS,
  GIFT_LIMIT,
  GIFT_NAME_MAX,
  CUSTOM_MISSION_LIMIT,
  CUSTOM_NAME_MAX,
  allMissions,
  dateKey,
  missionDef,
  type AppState,
  type ProofKind,
  type MissionId,
  type MissionSetting,
  type Proof
} from "./model";

// ---------- 계산 값 ----------

/** R-06, R-08, R-09: 실패하지 않은 인증마다 10코인, 구매한 만큼 뺀다. 마이너스가 될 수 있다 */
export function coins(state: AppState): number {
  const earned = state.proofs.filter((p) => p.status !== "fail").length * COIN_PER_MISSION;
  const spent = state.purchases.reduce((sum, p) => sum + p.price, 0);
  return earned - spent;
}

/** R-01: 오늘 단계를 다 깨서 다음 단계가 자정을 기다리는 중인가 */
export function isResting(state: AppState, now: number): boolean {
  return state.restDate !== null && state.restDate === dateKey(now);
}

export type CardStatus = "todo" | "done" | "retry";

/** C2 미션 카드 상태. 지금 단계에서 실패하지 않은 인증이 있으면 완료, 실패만 있으면 다시 해보자 */
export function cardStatus(state: AppState, missionId: MissionId, stage = state.stage): CardStatus {
  const mine = state.proofs.filter((p) => p.stage === stage && p.missionId === missionId);
  if (mine.some((p) => p.status !== "fail")) return "done";
  if (mine.some((p) => p.status === "fail")) return "retry";
  return "todo";
}

export function stageCards(state: AppState, stage = state.stage) {
  return state.missions.map((m) => ({ ...missionDef(m.id, state.customMissions), seconds: m.seconds, status: cardStatus(state, m.id, stage) }));
}

export function doneCount(state: AppState, stage = state.stage): number {
  return stageCards(state, stage).filter((c) => c.status === "done").length;
}

export function chapterOf(stage: number): number {
  return Math.min(CHAPTERS.length, Math.floor((stage - 1) / STAGES_PER_CHAPTER) + 1);
}

export function chapterName(stage: number): string {
  return CHAPTERS[chapterOf(stage) - 1].name;
}

export function stepsToCastle(state: AppState): number {
  return LAST_STAGE - state.stage;
}

/** 5일마다 반짝 별, 10일마다 챕터 보물 (피그마 지도). 지금은 보여주기만 하고 따로 주지는 않는다 (ADR-013) */
export function stageReward(stage: number): "star" | "chest" | null {
  if (stage % 10 === 0) return "chest";
  if (stage % 5 === 0) return "star";
  return null;
}

/** C1 아래 카드: 가장 싼 선물까지 필요한 코인 (유저저니 C1, 가정) */
export function coinsToNextGift(state: AppState): { name: string; need: number } | null {
  if (state.gifts.length === 0) return null;
  const cheapest = [...state.gifts].sort((a, b) => a.price - b.price)[0];
  return { name: cheapest.name, need: Math.max(0, cheapest.price - coins(state)) };
}

/** 부모가 아직 성공·실패를 누르지 않은 인증. 오래된 것부터 */
export function pendingProofs(state: AppState): Proof[] {
  return state.proofs.filter((p) => p.status === "clear").sort((a, b) => a.at - b.at);
}

/** 아이가 아직 C8로 보지 못한 실패 */
export function unseenFails(state: AppState): Proof[] {
  return state.proofs.filter((p) => p.status === "fail" && !p.failSeen);
}

export function openPurchases(state: AppState) {
  return state.purchases.filter((p) => !p.given).sort((a, b) => a.at - b.at);
}

// ---------- 상태 변경 ----------

export function clampSeconds(value: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return VIDEO_SECONDS.default;
  return Math.min(VIDEO_SECONDS.max, Math.max(VIDEO_SECONDS.min, n));
}

/** F-12: 온보딩의 부모 설정을 저장한다. 미션은 1개로 시작한다 (R-14) */
export function finishSetup(state: AppState, input: { pin: string; childName: string; mission: MissionSetting }): AppState {
  const name = input.childName.trim().slice(0, 10);
  if (!/^\d{4}$/.test(input.pin) || !name) return state;
  return {
    ...state,
    pin: input.pin,
    childName: name,
    missions: [{ id: input.mission.id, seconds: clampSeconds(input.mission.seconds) }]
  };
}

export function completeOnboarding(state: AppState): AppState {
  return state.onboarded ? state : { ...state, onboarded: true };
}

export interface SubmitResult {
  state: AppState;
  proof: Proof | null;
  climbed: boolean;
}

/**
 * R-02, R-04, R-05: 인증을 제출하면 즉시 클리어. 오늘 단계의 미션을 모두 깨면 한 단계 올라가고 "내일 만나자"가 된다.
 * 쉬는 중이거나, 이미 완료한 미션이거나, 지금 미션 목록에 없는 미션이면 기록하지 않는다.
 */
export function submitProof(state: AppState, input: { id: string; missionId: MissionId; now: number; practice?: boolean }): SubmitResult {
  const setting = state.missions.find((m) => m.id === input.missionId);
  const practice = input.practice === true;
  const blocked =
    !setting ||
    state.proofs.some((p) => p.id === input.id) ||
    (!practice && (isResting(state, input.now) || cardStatus(state, input.missionId) === "done"));
  if (blocked) return { state, proof: null, climbed: false };

  const def = missionDef(input.missionId, state.customMissions);
  const proof: Proof = {
    id: input.id,
    missionId: def.id,
    missionName: def.name,
    kind: def.kind,
    // 연습 미션은 0단계로 기록해서 1일 미션 카드에 세지 않는다 (ADR-014)
    stage: practice ? 0 : state.stage,
    date: dateKey(input.now),
    at: input.now,
    status: "clear",
    failSeen: false,
    ...(practice ? { practice: true } : {})
  };
  let next: AppState = { ...state, proofs: [...state.proofs, proof] };
  if (practice) return { state: next, proof, climbed: false };
  const allDone = stageCards(next).every((c) => c.status === "done");
  const climbed = allDone && next.stage < LAST_STAGE;
  if (climbed) next = { ...next, stage: next.stage + 1, restDate: dateKey(input.now) };
  return { state: next, proof, climbed };
}

/**
 * R-07, R-08: 성공은 확정만 한다. 실패는 캐릭터를 한 단계 내리고(코인 -10은 계산으로 반영),
 * 그 미션을 지금 단계에서 "다시 해보자"로 다시 할 수 있게 쉬는 상태를 푼다.
 */
export function reviewProof(state: AppState, proofId: string, verdict: "ok" | "fail"): AppState {
  const target = state.proofs.find((p) => p.id === proofId);
  if (!target || target.status !== "clear") return state;
  if (verdict === "ok") return { ...state, proofs: state.proofs.map((p) => (p.id === proofId ? { ...p, status: verdict } : p)) };
  // 실패한 인증이 지금 단계의 것이면 아직 올라가지 않았으므로 내려가지 않는다 (가정, ADR-010).
  // 연습 미션(0단계)이 실패해도 단계는 그대로다 (ADR-014)
  const stage = !target.practice && target.stage < state.stage ? Math.max(1, state.stage - 1) : state.stage;
  const dropped = stage < state.stage;
  const proofs = state.proofs.map((p) => (p.id === proofId ? { ...p, status: verdict, dropped } : p));
  return { ...state, proofs, stage, restDate: null };
}

export function markFailsSeen(state: AppState): AppState {
  if (unseenFails(state).length === 0) return state;
  return { ...state, proofs: state.proofs.map((p) => (p.status === "fail" && !p.failSeen ? { ...p, failSeen: true } : p)) };
}

export type BuyResult = { state: AppState; ok: true; purchaseId: string } | { state: AppState; ok: false; reason: "short" | "missing" };

/** R-10: 코인이 가격 이상일 때만 산다. 사면 바로 빠진다 */
export function buyGift(state: AppState, input: { id: string; giftId: string; now: number }): BuyResult {
  const gift = state.gifts.find((g) => g.id === input.giftId);
  if (!gift || state.purchases.some((p) => p.id === input.id)) return { state, ok: false, reason: "missing" };
  if (coins(state) < gift.price) return { state, ok: false, reason: "short" };
  const purchase = { id: input.id, giftId: gift.id, name: gift.name, icon: gift.icon, price: gift.price, at: input.now, given: false };
  return { state: { ...state, purchases: [...state.purchases, purchase] }, ok: true, purchaseId: input.id };
}

/** R-11: 부모가 "줬어요"를 누르면 완료 */
export function giveGift(state: AppState, purchaseId: string): AppState {
  if (!state.purchases.some((p) => p.id === purchaseId && !p.given)) return state;
  return { ...state, purchases: state.purchases.map((p) => (p.id === purchaseId ? { ...p, given: true } : p)) };
}

export function giftIsValid(input: { name: string; price: number }): boolean {
  const price = Number(input.price);
  return input.name.trim().length > 0 && Number.isInteger(price) && price >= 10 && price <= 99999;
}

/**
 * R-12, ADR-019: 부모가 선물 목록을 통째로 저장한다. 고치기, 더하기, 지우기를 한 번에 한다.
 * 1~12개, 이름과 가격(10 이상)이 맞아야 하고, 하나라도 틀리면 저장하지 않는다. 이미 산 선물 기록은 그대로 남는다
 */
export function saveGifts(state: AppState, gifts: { id: string; name: string; price: number; icon?: string }[]): AppState {
  if (gifts.length === 0 || gifts.length > GIFT_LIMIT || !gifts.every(giftIsValid)) return state;
  if (new Set(gifts.map((g) => g.id)).size !== gifts.length) return state;
  return {
    ...state,
    gifts: gifts.map((g) => {
      const before = state.gifts.find((x) => x.id === g.id);
      const icon = g.icon && GIFT_ICONS.includes(g.icon) ? g.icon : (before?.icon ?? GIFT_ICONS[0]);
      return { id: g.id, name: g.name.trim().slice(0, GIFT_NAME_MAX), icon, price: Number(g.price) };
    })
  };
}

/** F-34, R-14: 무료는 미션 1개. 구독하면 여러 개. 빈 목록은 저장하지 않는다 */
export function saveMissions(state: AppState, missions: MissionSetting[]): AppState {
  const known = allMissions(state);
  const unique = missions.filter((m, i) => missions.findIndex((x) => x.id === m.id) === i && known.some((d) => d.id === m.id));
  if (unique.length === 0) return state;
  if (!state.subscribed && unique.length > 1) return state;
  return { ...state, missions: unique.map((m) => ({ id: m.id, seconds: clampSeconds(m.seconds) })) };
}

// ---------- 부모가 직접 만드는 미션 (ADR-018) ----------

/** 이름이 쓸 수 없으면 이유를, 괜찮으면 null */
export function customMissionError(state: AppState, name: string): string | null {
  const n = name.trim();
  if (n.length === 0) return "미션 이름을 적어 주세요";
  if (n.length > CUSTOM_NAME_MAX) return `미션 이름은 ${CUSTOM_NAME_MAX}자까지 쓸 수 있어요`;
  if (allMissions(state).some((m) => m.name === n)) return "같은 이름의 미션이 이미 있어요";
  if ((state.customMissions ?? []).length >= CUSTOM_MISSION_LIMIT) return `직접 만든 미션은 ${CUSTOM_MISSION_LIMIT}개까지예요`;
  return null;
}

export type AddMissionResult = { ok: true; state: AppState } | { ok: false; error: string; state: AppState };

/** 새 미션을 미션 목록(고를 수 있는 것)에 더한다. 지금 할 미션으로 넣는 건 saveMissions가 한다 */
export function addCustomMission(state: AppState, input: { id: string; name: string; icon: string; kind: ProofKind }): AddMissionResult {
  const error = customMissionError(state, input.name);
  if (error) return { ok: false, error, state };
  if (allMissions(state).some((m) => m.id === input.id)) return { ok: false, error: "잠시 후 다시 시도해 주세요", state };
  const name = input.name.trim();
  const icon = CUSTOM_ICONS.includes(input.icon) ? input.icon : CUSTOM_ICONS[0];
  const def = { id: input.id, name, icon, kind: input.kind, cheer: name };
  return { ok: true, state: { ...state, customMissions: [...(state.customMissions ?? []), def] } };
}

/** 직접 만든 미션을 지운다. 지금 하고 있는 미션이면 지우지 않는다. 예전 인증 기록은 남는다 */
export function removeCustomMission(state: AppState, id: string): AppState {
  const list = state.customMissions ?? [];
  if (!list.some((m) => m.id === id) || state.missions.some((m) => m.id === id)) return state;
  return { ...state, customMissions: list.filter((m) => m.id !== id) };
}

/** F-36, ADR-008: 가짜 결제를 마치면 구독 상태가 켜진다 */
export function subscribe(state: AppState): AppState {
  return state.subscribed ? state : { ...state, subscribed: true };
}
