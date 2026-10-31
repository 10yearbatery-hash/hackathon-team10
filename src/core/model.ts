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
  /** DAY 카드 제목 "오늘도 같이 ○○!" */
  cheer: string;
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
  /** 온보딩 연습 미션(O8). 단계 진행에는 세지 않는다 (ADR-014) */
  practice?: boolean;
  /** 실패 처리로 캐릭터가 실제로 한 단계 내려갔는가 (C8 문구용) */
  dropped?: boolean;
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
  { id: "brush", name: "양치하기", icon: "🦷", kind: "video", cheer: "양치하자" },
  { id: "wash", name: "손씻기", icon: "🧼", kind: "video", cheer: "손 씻자" },
  { id: "vitamin", name: "비타민 먹기", icon: "💊", kind: "photo", cheer: "비타민 먹자" },
  { id: "book", name: "책읽기", icon: "📚", kind: "photo", cheer: "책 읽자" },
  { id: "pack", name: "준비물 챙기기", icon: "🎒", kind: "photo", cheer: "준비물 챙기자" }
];

export const DEFAULT_GIFTS: Gift[] = [
  { id: "g-movie", name: "가족 영화 보기", icon: "🎬", price: 50 },
  { id: "g-dinner", name: "저녁 메뉴 고르기", icon: "🍽️", price: 100 },
  { id: "g-play", name: "특별 놀이 20분", icon: "🧩", price: 150 },
  { id: "g-park", name: "주말 공원 고르기", icon: "🌲", price: 200 }
];

export type StoneKind = "ice" | "frost" | "melt" | "purple";

export interface Chapter {
  name: string;
  /** 지도 위 파란 펭귄의 말 */
  says: string[];
  /** 지도 끝의 다음 목적지 안내 */
  next: string;
  stone: StoneKind;
  /** 말풍선 글자색과 보상 안내 글자색 */
  sayColor: string;
  labelColor: string;
}

/** 장 이름과 지도 문구는 피그마 "02B 스테이지 지도 원본"에서 가져왔다 (ADR-013) */
export const CHAPTERS: Chapter[] = [
  { name: "사랑이 넘쳤던 이글루 마을", says: ["내 공주를 납치해가다니..가만 안 둬.", "기다려! 내가 꼭 구하러 갈게."], next: "다음 목적지 · 반짝이는 눈꽃 들판", stone: "ice", sayColor: "#235ea0", labelColor: "#465d79" },
  { name: "반짝이는 눈꽃 들판", says: ["엇! 저건 북극여우 발자국아니야?", "저 발자국을 따라가면 공주를 구할 수 있겠군."], next: "다음 목적지 · 얼음 강의 징검다리", stone: "ice", sayColor: "#235ea0", labelColor: "#426183" },
  { name: "얼음 강의 징검다리", says: ["차가운 강도 우리 함께라면 버틸 수 있어!", "북극여우..기다려라!"], next: "다음 목적지 · 포근한 눈송이 숲", stone: "ice", sayColor: "#235ea0", labelColor: "#3f667f" },
  { name: "포근한 눈송이 숲", says: ["저거 반짝이는 거..여우의 발자국 아니야?", "얼른 따라잡으러 가자!"], next: "다음 목적지 · 오로라가 비친 호수", stone: "frost", sayColor: "#235ea0", labelColor: "#3d6b65" },
  { name: "오로라가 비친 호수", says: ["힘들었다..그래도 벌써 절반이나 왔어!", "조금만 더 힘내보는 거야~"], next: "다음 목적지 · 수정이 자라는 협곡", stone: "frost", sayColor: "#235ea0", labelColor: "#4f5686" },
  { name: "수정이 자라는 협곡", says: ["수정 안에 핑크색 깃털이 있잖아??", "방금 공주와 북극여우가 왔다갔나보군.."], next: "다음 목적지 · 보랏빛 바람의 언덕", stone: "melt", sayColor: "#7841ae", labelColor: "#65548f" },
  { name: "보랏빛 바람의 언덕", says: ["저기 봐, 성의 꼭대기가 보여!", "얼른 달려가자~!"], next: "다음 목적지 · 구름 위 얼음 다리", stone: "melt", sayColor: "#7841ae", labelColor: "#655080" },
  { name: "구름 위 얼음 다리", says: ["으악.. 눈이 많아서 미끄럽네.", "힘들지만 힘내서 가보자!"], next: "다음 목적지 · 비밀의 푸른 얼음 동굴", stone: "purple", sayColor: "#7841ae", labelColor: "#554b83" },
  { name: "비밀의 푸른 얼음 동굴", says: ["핑크 펭귄의 목소리가 들려!", "이 동굴만 지나면 성의 입구에 갈 수 있어."], next: "다음 목적지 · 보라빛 마법성", stone: "purple", sayColor: "#7841ae", labelColor: "#514474" },
  { name: "보라빛 마법성", says: ["이제 마지막 열 걸음.", "공주를 드디어 만날 수 있어!"], next: "마지막 문 너머에서 기다리고 있어요.", stone: "purple", sayColor: "#7841ae", labelColor: "#60487e" }
];

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
