// 앱 상태와 기본 데이터. React와 브라우저 기능 없이 순수 TypeScript로 둔다 (ADR-002).

export type MissionId = "brush" | "wash" | "vitamin" | "book" | "pack";
export type ProofKind = "video" | "photo";
/** clear = 제출 직후, ok = 부모 성공, fail = 부모 실패 (서비스기획 12장) */
export type ProofStatus = "clear" | "ok" | "fail";

export interface MissionDef {
  id: MissionId;
  name: string;
  icon: string;
  kind: ProofKind;
}

export interface MissionSetting {
  id: MissionId;
  /** 영상 미션의 촬영 길이(초). 사진 미션은 쓰지 않는다 */
  seconds: number;
}

export interface Proof {
  id: string;
  missionId: MissionId;
  missionName: string;
  kind: ProofKind;
  stage: number;
  date: string;
  at: number;
  status: ProofStatus;
  /** 실패를 아이가 C8 화면에서 봤는지 */
  failSeen: boolean;
}

export interface Gift {
  id: string;
  name: string;
  icon: string;
  price: number;
}

export interface Purchase {
  id: string;
  giftId: string;
  name: string;
  icon: string;
  price: number;
  at: number;
  given: boolean;
}

export interface AppState {
  version: 1;
  onboarded: boolean;
  pin: string;
  childName: string;
  subscribed: boolean;
  missions: MissionSetting[];
  /** 캐릭터가 서 있는 단계 (1~100) */
  stage: number;
  /** 이 날짜(YYYY-MM-DD)에 단계를 다 깨서 지금 단계는 "내일 만나자". 날짜가 바뀌면 열린다 */
  restDate: string | null;
  proofs: Proof[];
  gifts: Gift[];
  purchases: Purchase[];
}

export const COIN_PER_MISSION = 10;
export const LAST_STAGE = 100;
export const STAGES_PER_CHAPTER = 10;
export const FREE_STAGE_LIMIT = 20;
export const VIDEO_SECONDS = { min: 5, max: 30, default: 15 };

export const MISSIONS: MissionDef[] = [
  { id: "brush", name: "양치하기", icon: "🪥", kind: "video" },
  { id: "wash", name: "손씻기", icon: "🧼", kind: "video" },
  { id: "vitamin", name: "비타민 먹기", icon: "💊", kind: "photo" },
  { id: "book", name: "책읽기", icon: "📚", kind: "photo" },
  { id: "pack", name: "준비물 챙기기", icon: "🎒", kind: "photo" }
];

export const DEFAULT_GIFTS: Gift[] = [
  { id: "g-movie", name: "가족 영화 보기", icon: "🎬", price: 50 },
  { id: "g-dinner", name: "저녁 메뉴 고르기", icon: "🍽️", price: 100 },
  { id: "g-play", name: "특별 놀이 20분", icon: "🧩", price: 150 },
  { id: "g-park", name: "주말 공원 고르기", icon: "🌲", price: 200 }
];

/** 장 이름은 아직 정하지 않았다 (PRD R-03 미정). 1장만 피그마 이름을 쓴다 */
export const CHAPTER_NAMES = ["눈꽃 마을", "얼음 숲", "오로라 언덕", "별빛 호수", "눈보라 골짜기", "수정 동굴", "구름 다리", "북극 바다", "보라 성문", "공주님의 성"];

export function missionDef(id: MissionId): MissionDef {
  const def = MISSIONS.find((m) => m.id === id);
  if (!def) throw new Error(`unknown mission ${id}`);
  return def;
}

export function emptyState(): AppState {
  return {
    version: 1,
    onboarded: false,
    pin: "",
    childName: "",
    subscribed: false,
    missions: [],
    stage: 1,
    restDate: null,
    proofs: [],
    gifts: DEFAULT_GIFTS.map((g) => ({ ...g })),
    purchases: []
  };
}

/** 기기의 현지 날짜 (R-01: 기준은 현지 자정) */
export function dateKey(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
