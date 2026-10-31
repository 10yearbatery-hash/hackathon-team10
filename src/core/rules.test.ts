import { describe, expect, it } from "vitest";
import { emptyState, type AppState } from "./model";
import {
  buyGift,
  cardStatus,
  coins,
  finishSetup,
  giveGift,
  isResting,
  markFailsSeen,
  pendingProofs,
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
