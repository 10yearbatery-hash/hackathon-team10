import { describe, expect, it } from "vitest";
import { emptyState, GIFT_LIMIT, missionDef, upgradeState, type AppState } from "./model";
import {
  addCustomMission,
  buyGift,
  cardStatus,
  coins,
  finishSetup,
  giveGift,
  isResting,
  markFailsSeen,
  pendingProofs,
  removeCustomMission,
  reviewProof,
  saveGifts,
  saveMissions,
  submitProof,
  subscribe,
  unseenFails
} from "./rules";

const DAY1 = new Date(2026, 10, 1, 9, 0).getTime();
const DAY1_NIGHT = new Date(2026, 10, 1, 23, 59).getTime();
const DAY2 = new Date(2026, 10, 2, 0, 1).getTime();

function setup(mission: "brush" | "book" = "brush"): AppState {
  return finishSetup(emptyState(), { pin: "1234", childName: "하늘", mission: { id: mission, seconds: 15 } });
}

describe("온보딩 설정 (F-12)", () => {
  it("PIN 4자리와 이름이 있어야 저장한다", () => {
    const s = emptyState();
    expect(finishSetup(s, { pin: "12", childName: "하늘", mission: { id: "brush", seconds: 15 } })).toBe(s);
    expect(finishSetup(s, { pin: "1234", childName: "  ", mission: { id: "brush", seconds: 15 } })).toBe(s);
    const ok = setup();
    expect(ok.pin).toBe("1234");
    expect(ok.missions).toEqual([{ id: "brush", seconds: 15 }]);
  });

  it("영상 길이는 5~30초로 맞춘다", () => {
    const s = finishSetup(emptyState(), { pin: "1234", childName: "하늘", mission: { id: "brush", seconds: 99 } });
    expect(s.missions[0].seconds).toBe(30);
  });
});

describe("인증과 단계 (R-01, R-02, R-05, R-06)", () => {
  it("제출하면 바로 10코인, 미션을 다 깨면 한 단계 올라가고 쉰다", () => {
    const r = submitProof(setup(), { id: "p1", missionId: "brush", now: DAY1 });
    expect(r.climbed).toBe(true);
    expect(r.state.stage).toBe(2);
    expect(coins(r.state)).toBe(10);
    expect(isResting(r.state, DAY1_NIGHT)).toBe(true);
    expect(isResting(r.state, DAY2)).toBe(false);
  });

  it("쉬는 중에는 제출할 수 없고, 자정이 지나면 할 수 있다", () => {
    const s = submitProof(setup(), { id: "p1", missionId: "brush", now: DAY1 }).state;
    expect(submitProof(s, { id: "p2", missionId: "brush", now: DAY1_NIGHT }).proof).toBeNull();
    const next = submitProof(s, { id: "p2", missionId: "brush", now: DAY2 });
    expect(next.state.stage).toBe(3);
  });

  it("미션이 여러 개면 전부 깨야 오른다", () => {
    const s = saveMissions(subscribe(setup()), [
      { id: "brush", seconds: 10 },
      { id: "book", seconds: 15 }
    ]);
    const a = submitProof(s, { id: "p1", missionId: "brush", now: DAY1 });
    expect(a.climbed).toBe(false);
    expect(a.state.stage).toBe(1);
    expect(submitProof(a.state, { id: "p1b", missionId: "brush", now: DAY1 }).proof).toBeNull();
    const b = submitProof(a.state, { id: "p2", missionId: "book", now: DAY1 });
    expect(b.climbed).toBe(true);
    expect(coins(b.state)).toBe(20);
  });

  it("같은 id로 두 번 제출해도 한 번만 기록한다", () => {
    const s = saveMissions(subscribe(setup()), [
      { id: "brush", seconds: 10 },
      { id: "book", seconds: 15 }
    ]);
    const a = submitProof(s, { id: "p1", missionId: "brush", now: DAY1 }).state;
    expect(submitProof(a, { id: "p1", missionId: "book", now: DAY1 }).proof).toBeNull();
  });
});

describe("부모 확인 (R-07, R-08)", () => {
  it("성공은 변화가 없고 대기 목록에서 빠진다", () => {
    const s = submitProof(setup(), { id: "p1", missionId: "brush", now: DAY1 }).state;
    const ok = reviewProof(s, "p1", "ok");
    expect(ok.stage).toBe(2);
    expect(coins(ok)).toBe(10);
    expect(pendingProofs(ok)).toHaveLength(0);
  });

  it("실패하면 한 단계 내려가고 코인 10을 회수하고, 다시 해보자로 다시 할 수 있다", () => {
    const s = submitProof(setup(), { id: "p1", missionId: "brush", now: DAY1 }).state;
    const failed = reviewProof(s, "p1", "fail");
    expect(failed.stage).toBe(1);
    expect(coins(failed)).toBe(0);
    expect(isResting(failed, DAY1)).toBe(false);
    expect(cardStatus(failed, "brush")).toBe("retry");
    expect(unseenFails(failed)).toHaveLength(1);
    expect(unseenFails(markFailsSeen(failed))).toHaveLength(0);

    const again = submitProof(failed, { id: "p2", missionId: "brush", now: DAY1 });
    expect(again.climbed).toBe(true);
    expect(again.state.stage).toBe(2);
    expect(coins(again.state)).toBe(10);
  });

  it("이미 처리한 인증은 다시 처리하지 않는다", () => {
    const s = submitProof(setup(), { id: "p1", missionId: "brush", now: DAY1 }).state;
    const failed = reviewProof(s, "p1", "fail");
    expect(reviewProof(failed, "p1", "fail")).toBe(failed);
    expect(reviewProof(failed, "p1", "ok")).toBe(failed);
  });

  it("코인은 마이너스가 될 수 있다 (R-09)", () => {
    let s = setup();
    s = { ...s, gifts: s.gifts.map((g) => (g.id === "g-movie" ? { ...g, price: 10 } : g)) };
    s = submitProof(s, { id: "p1", missionId: "brush", now: DAY1 }).state;
    const bought = buyGift(s, { id: "b1", giftId: "g-movie", now: DAY1 });
    expect(bought.ok).toBe(true);
    const failed = reviewProof(bought.state, "p1", "fail");
    expect(coins(failed)).toBe(-10);
  });

  it("아직 올라가지 않은 지금 단계의 인증이 실패하면 내려가지 않는다", () => {
    const s = saveMissions(subscribe(setup()), [
      { id: "brush", seconds: 10 },
      { id: "book", seconds: 15 }
    ]);
    const a = submitProof(s, { id: "p1", missionId: "brush", now: DAY1 }).state;
    const failed = reviewProof(a, "p1", "fail");
    expect(failed.stage).toBe(1);
    expect(cardStatus(failed, "brush")).toBe("retry");
  });
});

describe("상점 (R-10, R-11, R-12)", () => {
  it("코인이 모자라면 사지 못한다", () => {
    const s = submitProof(setup(), { id: "p1", missionId: "brush", now: DAY1 }).state;
    const r = buyGift(s, { id: "b1", giftId: "g-movie", now: DAY1 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe("short");
  });

  it("사면 코인이 바로 빠지고, 줬어요로 완료된다", () => {
    let s = setup();
    for (let i = 0; i < 5; i++) s = submitProof(s, { id: `p${i}`, missionId: "brush", now: DAY1 + i * 86400000 }).state;
    expect(coins(s)).toBe(50);
    const r = buyGift(s, { id: "b1", giftId: "g-movie", now: DAY1 });
    expect(r.ok).toBe(true);
    expect(coins(r.state)).toBe(0);
    const given = giveGift(r.state, "b1");
    expect(given.purchases[0].given).toBe(true);
    expect(giveGift(given, "b1")).toBe(given);
  });

  it("선물 가격은 10 이상의 정수만 저장한다", () => {
    const s = setup();
    expect(saveGifts(s, [{ id: "g-movie", name: "영화", price: 5 }])).toBe(s);
    expect(saveGifts(s, [{ id: "g-movie", name: "", price: 50 }])).toBe(s);
    const ok = saveGifts(s, [{ id: "g-movie", name: "영화 보기", price: 70 }]);
    expect(ok.gifts[0]).toMatchObject({ name: "영화 보기", price: 70 });
  });
});

describe("미션 관리와 구독 (R-14)", () => {
  it("무료는 미션 1개만, 구독하면 여러 개", () => {
    const s = setup();
    const two = [
      { id: "brush" as const, seconds: 10 },
      { id: "book" as const, seconds: 15 }
    ];
    expect(saveMissions(s, two)).toBe(s);
    expect(saveMissions(s, [])).toBe(s);
    expect(saveMissions(subscribe(s), two).missions).toHaveLength(2);
    expect(saveMissions(s, [{ id: "wash", seconds: 20 }]).missions).toEqual([{ id: "wash", seconds: 20 }]);
  });
});

describe("온보딩 연습 미션 (ADR-014)", () => {
  it("연습 미션은 코인 10을 주지만 단계를 올리지 않고, 1일 미션은 그대로 할 수 있다", () => {
    const r = submitProof(setup(), { id: "t1", missionId: "brush", now: DAY1, practice: true });
    expect(r.climbed).toBe(false);
    expect(r.state.stage).toBe(1);
    expect(coins(r.state)).toBe(10);
    expect(isResting(r.state, DAY1)).toBe(false);
    expect(cardStatus(r.state, "brush")).toBe("todo");
    expect(pendingProofs(r.state)).toHaveLength(1);
    const day1 = submitProof(r.state, { id: "p1", missionId: "brush", now: DAY1 });
    expect(day1.climbed).toBe(true);
    expect(day1.state.stage).toBe(2);
    expect(coins(day1.state)).toBe(20);
  });

  it("연습 미션이 실패해도 단계는 그대로이고 코인만 돌려받는다", () => {
    const s = submitProof(setup(), { id: "t1", missionId: "brush", now: DAY1, practice: true }).state;
    const failed = reviewProof(s, "t1", "fail");
    expect(failed.stage).toBe(1);
    expect(coins(failed)).toBe(0);
    expect(failed.proofs[0].dropped).toBe(false);
    expect(cardStatus(failed, "brush")).toBe("todo");
  });

  it("1일 미션을 깨고 올라간 뒤 실패하면 한 단계 내려온다", () => {
    let s = submitProof(setup(), { id: "t1", missionId: "brush", now: DAY1, practice: true }).state;
    s = submitProof(s, { id: "p1", missionId: "brush", now: DAY1 }).state;
    const failed = reviewProof(s, "p1", "fail");
    expect(failed.stage).toBe(1);
    expect(failed.proofs.find((p) => p.id === "p1")?.dropped).toBe(true);
    expect(cardStatus(failed, "brush")).toBe("retry");
  });
});

describe("부모가 직접 만드는 미션 (ADR-018)", () => {
  it("이름을 확인하고 미션 목록에 더한다", () => {
    const s = setup();
    expect(addCustomMission(s, { id: "c-1", name: "  ", icon: "🛏️", kind: "photo" }).ok).toBe(false);
    expect(addCustomMission(s, { id: "c-1", name: "양치하기", icon: "🛏️", kind: "photo" }).ok).toBe(false);
    expect(addCustomMission(s, { id: "c-1", name: "가".repeat(13), icon: "🛏️", kind: "photo" }).ok).toBe(false);
    const r = addCustomMission(s, { id: "c-1", name: " 이불 개기 ", icon: "🛏️", kind: "photo" });
    expect(r.ok).toBe(true);
    expect(r.state.customMissions).toEqual([{ id: "c-1", name: "이불 개기", icon: "🛏️", kind: "photo", cheer: "이불 개기" }]);
  });

  it("만든 미션으로 바꾸면 인증과 코인이 기본 미션과 똑같이 된다", () => {
    const made = addCustomMission(setup(), { id: "c-1", name: "줄넘기", icon: "⚽", kind: "video" }).state;
    const s = saveMissions(made, [{ id: "c-1", seconds: 10 }]);
    expect(s.missions).toEqual([{ id: "c-1", seconds: 10 }]);
    expect(cardStatus(s, "c-1")).toBe("todo");
    const r = submitProof(s, { id: "p1", missionId: "c-1", now: DAY1 });
    expect(r.proof?.missionName).toBe("줄넘기");
    expect(r.proof?.kind).toBe("video");
    expect(r.state.stage).toBe(2);
    expect(coins(r.state)).toBe(10);
  });

  it("없는 미션으로는 바꿀 수 없다", () => {
    const s = setup();
    expect(saveMissions(s, [{ id: "c-none", seconds: 10 }])).toBe(s);
  });

  it("지금 하는 미션은 지울 수 없고, 지운 미션의 예전 인증은 기본 모양으로 보인다", () => {
    const made = addCustomMission(setup(), { id: "c-1", name: "줄넘기", icon: "⚽", kind: "photo" }).state;
    const using = saveMissions(made, [{ id: "c-1", seconds: 15 }]);
    expect(removeCustomMission(using, "c-1")).toBe(using);
    const back = saveMissions(using, [{ id: "brush", seconds: 15 }]);
    const removed = removeCustomMission(back, "c-1");
    expect(removed.customMissions).toEqual([]);
    expect(missionDef("c-1", removed.customMissions).icon).toBe("⭐");
  });

  it("예전에 저장한 상태(customMissions 없음)도 그대로 동작한다", () => {
    const old = { ...setup() } as AppState;
    delete old.customMissions;
    expect(addCustomMission(old, { id: "c-1", name: "물 마시기", icon: "🥛", kind: "photo" }).ok).toBe(true);
    expect(removeCustomMission(old, "c-1")).toBe(old);
  });
});

describe("선물 추가·삭제와 10코인 선물 (ADR-019)", () => {
  it("처음부터 10코인 선물이 있어 첫 미션 하나로 살 수 있다", () => {
    const s = submitProof(setup(), { id: "p1", missionId: "brush", now: DAY1 }).state;
    expect(s.gifts.find((g) => g.id === "g-hug")?.price).toBe(10);
    expect(buyGift(s, { id: "b1", giftId: "g-hug", now: DAY1 }).ok).toBe(true);
  });

  it("예전 상태에는 10코인 선물을 한 번만 넣고, 부모가 지운 뒤에는 다시 넣지 않는다", () => {
    const old = { ...setup(), gifts: setup().gifts.filter((g) => g.id !== "g-hug") } as AppState;
    delete old.giftSeed;
    const up = upgradeState(old);
    expect(up.gifts.filter((g) => g.id === "g-hug")).toHaveLength(1);
    const removed = saveGifts(up, up.gifts.filter((g) => g.id !== "g-hug"));
    expect(upgradeState(removed)).toBe(removed);
  });

  it("선물을 더하고 지우고 그림을 바꾼다", () => {
    const s = setup();
    const added = saveGifts(s, [...s.gifts, { id: "g-new", name: " 놀이터 30분 ", price: 30, icon: "🚲" }]);
    expect(added.gifts.at(-1)).toEqual({ id: "g-new", name: "놀이터 30분", icon: "🚲", price: 30 });
    const removed = saveGifts(added, added.gifts.filter((g) => g.id !== "g-movie"));
    expect(removed.gifts.some((g) => g.id === "g-movie")).toBe(false);
    expect(saveGifts(s, [{ id: "g-movie", name: "영화", price: 50, icon: "없는그림" }]).gifts[0].icon).toBe("🎬");
  });

  it("빈 목록, 한도 초과, 같은 id는 저장하지 않는다", () => {
    const s = setup();
    expect(saveGifts(s, [])).toBe(s);
    const many = Array.from({ length: GIFT_LIMIT + 1 }, (_, i) => ({ id: `g${i}`, name: `선물${i}`, price: 10 }));
    expect(saveGifts(s, many)).toBe(s);
    expect(saveGifts(s, [{ id: "a", name: "가", price: 10 }, { id: "a", name: "나", price: 10 }])).toBe(s);
  });

  it("선물을 지워도 이미 산 기록은 남는다", () => {
    let s = submitProof(setup(), { id: "p1", missionId: "brush", now: DAY1 }).state;
    s = buyGift(s, { id: "b1", giftId: "g-hug", now: DAY1 }).state;
    const removed = saveGifts(s, s.gifts.filter((g) => g.id !== "g-hug"));
    expect(removed.purchases).toHaveLength(1);
    expect(removed.purchases[0].name).toBe("꼭 안아 주기");
  });
});
