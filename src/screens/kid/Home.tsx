// C1 홈(100일 구출 지도), C2 단계 팝업(DAY 미션 카드), C6 내일 또 만나자, C8 다시 해보자
// 디자인: 피그마 "02A 채택 스테이지 UI", "02F 스테이지별 미션 화면", "V3/C6", "V3/C8"
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CHAPTERS, STAGES_PER_CHAPTER } from "../../core/model";
import { coins, coinsToNextGift, doneCount, isResting, markFailsSeen, stageCards, stageReward, unseenFails } from "../../core/rules";
import { go } from "../../app/router";
import { handoff, update, useAppState } from "../../app/store";
import { sfx } from "../../platform/sound";
import { MAP_H, MAP_W, MapPath, scrollFor } from "../../ui/MapPath";
import { Hero, KidTabBar, nick } from "../../ui/parts";

const pad3 = (n: number) => String(n).padStart(3, "0");

export default function Home() {
  const state = useAppState();
  const resting = isResting(state, Date.now());
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MAP_W);
  const [viewChapter, setViewChapter] = useState(Math.floor((state.stage - 1) / STAGES_PER_CHAPTER));
  const [sheet, setSheet] = useState(handoff.openSheet);
  const [toast, setToast] = useState("");
  const [shakeStage, setShakeStage] = useState<number | null>(null);
  const [climbFrom] = useState(handoff.climbFrom);
  const [firstBanner, setFirstBanner] = useState(false);
  const fails = unseenFails(state);
  const next = coinsToNextGift(state);
  const wallet = coins(state);

  useLayoutEffect(() => {
    handoff.openSheet = false;
    const el = box.current;
    if (!el) return;
    const w = el.clientWidth;
    setWidth(w);
    el.scrollTop = scrollFor(climbFrom ?? state.stage, w / MAP_W, el.clientHeight);
  }, []);

  useEffect(() => {
    if (climbFrom == null) return;
    handoff.climbFrom = null;
    const el = box.current;
    const t1 = window.setTimeout(() => sfx.climb(), 700);
    const t2 = window.setTimeout(() => el?.scrollTo({ top: scrollFor(state.stage, el.clientWidth / MAP_W, el.clientHeight), behavior: "smooth" }), 700);
    return () => [t1, t2].forEach((t) => window.clearTimeout(t));
  }, []);

  // 온보딩 연습 미션을 막 끝냈다 (ADR-014)
  useEffect(() => {
    if (!handoff.firstClear) return;
    handoff.firstClear = false;
    const t = window.setTimeout(() => setFirstBanner(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  function onScroll() {
    const el = box.current;
    if (!el) return;
    const chapterH = MAP_H * (el.clientWidth / MAP_W);
    const mid = el.scrollTop + el.clientHeight * 0.4;
    setViewChapter(Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(mid / chapterH))));
  }

  function tapStage(stage: number) {
    if (stage === state.stage && !resting) {
      sfx.tap();
      setSheet(true);
    } else if (stage === state.stage && resting) {
      sfx.soft();
      setToast("오늘은 다 했어! 내일 또 만나자 🌙");
    } else if (stage > state.stage) {
      sfx.wrong();
      setShakeStage(stage);
      window.setTimeout(() => setShakeStage(null), 500);
      setToast("아직 열리지 않았어!");
    } else {
      setToast(`${stage}일은 벌써 지나왔어!`);
    }
  }

  const cards = stageCards(state);
  const done = doneCount(state);
  const reward = stageReward(state.stage);
  const firstTodo = cards.find((c) => c.status !== "done");
  const chapter = CHAPTERS[viewChapter];
  const firstMission = cards[0];

  return (
    <section className="screen kid map-home" data-testid="screen-home">
      <header className="map-head">
        <div className="map-head-top">
          <span className="app-name">펭귄 모험</span>
          <span className="coin-pill" data-testid="coin-chip">
            <i aria-hidden="true" />
            {wallet.toLocaleString("ko-KR")}
          </span>
        </div>
        <h1 className="map-title" data-testid="chapter-title">
          {viewChapter + 1}장 {chapter.name}
        </h1>
        <p className="map-left" data-testid="castle-left">
          공주님 성까지 {100 - state.stage}칸 남았어요!
        </p>
      </header>

      <div className="path-scroll" ref={box} onScroll={onScroll}>
        <MapPath width={width} current={state.stage} resting={resting} onTap={tapStage} climbFrom={climbFrom} shakeStage={shakeStage} />
      </div>

      <div className="map-foot">
        {resting ? (
          <div className="next-card rest" data-testid="rest-pill">
            <span aria-hidden="true">🌙</span>
            <div>
              <b>내일 또 만나자!</b>
              <small>오늘은 여기서 쉬고, 자정에 다음 단계가 열려.</small>
            </div>
          </div>
        ) : (
          next && (
            <div className="next-card" data-testid="next-gift">
              <span aria-hidden="true">🎁</span>
              <p>{next.need > 0 ? `다음 선물까지 코인 ${next.need}개 더 모아봐요` : `${next.name}, 지금 고를 수 있어요!`}</p>
            </div>
          )
        )}
        <KidTabBar active="home" />
      </div>

      {toast && (
        <div className="toast" role="status" data-testid="toast">
          {toast}
        </div>
      )}

      {firstBanner && (
        <div className="banner-overlay" data-testid="first-banner" onClick={() => setFirstBanner(false)}>
          <div className="banner-card">
            <Hero pose="thumbs" size={110} motion="jump" />
            <p className="jua">이제부터는 혼자서!</p>
            <small>{state.stage}일 발판을 눌러 오늘의 미션을 해 봐!</small>
            <button className="btn btn-blue btn-lg" onClick={() => setFirstBanner(false)} data-testid="first-banner-ok">
              좋아!
            </button>
          </div>
        </div>
      )}

      {sheet && (
        <div className="day-back" onClick={() => setSheet(false)} data-testid="sheet-back">
          <div className="day-card" onClick={(e) => e.stopPropagation()} data-testid="stage-sheet" role="dialog" aria-modal="true">
            <button className="day-close" onClick={() => setSheet(false)} aria-label="닫기">
              ×
            </button>
            <span className="day-badge">DAY {pad3(state.stage)}</span>
            <div className="day-hero">
              <img src="./map/popup-hero.png" alt="" />
              {reward && <img className="day-star" src={reward === "star" ? "./map/star-special.svg" : "./map/star-magic.svg"} alt="" />}
            </div>
            <h2>{reward === "star" ? "반짝 별이 기다리고 있어!" : reward === "chest" ? "한 지역을 더 건너왔어!" : `오늘도 같이 ${firstMission?.cheer ?? "해보자"}!`}</h2>
            <p className="day-sub">
              {reward === "star" ? "5일의 꾸준함을 모아 별을 받아요." : reward === "chest" ? "오늘의 미션을 끝내면 다음 지역이 열려요." : `네가 해내면 친구에게 한 걸음 가까워져요.`}
            </p>
            <ul className="day-list">
              {cards.map((c, i) => (
                <li key={c.id} data-testid={`mission-${c.id}`} data-status={c.status} className={`st-${c.status}`}>
                  <span className="day-no">{String(i + 1).padStart(2, "0")}</span>
                  <span className="day-name">
                    {c.icon} {c.name}
                    <small>{c.kind === "video" ? `영상 ${c.seconds}초` : "사진"}</small>
                  </span>
                  {c.status === "done" ? (
                    <span className="day-done">✓ 완료</span>
                  ) : (
                    <button className="day-go" onClick={() => go(`/capture/${c.id}`)} data-testid={`go-${c.id}`}>
                      {c.status === "retry" ? "다시 해보자" : "하러 가기"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {reward && <div className={`day-reward ${reward}`}>{reward === "star" ? "반짝 별 1개 + 5일 응원 배지" : "보물 상자 + 다음 지역 입장"}</div>}
            <button className="day-main" disabled={!firstTodo} onClick={() => firstTodo && go(`/capture/${firstTodo.id}`)} data-testid="day-start">
              {firstTodo?.status === "retry" ? "다시 찍으러 가기" : "미션 시작하기"}
            </button>
            <p className="day-count" data-testid="sheet-count">
              오늘 {done} / {cards.length} 완료
            </p>
          </div>
        </div>
      )}

      {fails.length > 0 && (
        <div className="v3 retry-v3" data-testid="retry-screen">
          <h1 className="v3-title">다시 해보자!</h1>
          <p className="v3-sub">괜찮아. 한 번 더 찍어볼까?</p>
          <div className="v3-hero">
            <Hero pose="thumbs" size={150} motion="jump" />
            <p>{nick(state.childName)}가 다시 해볼 수 있게 응원할게!</p>
          </div>
          {fails.some((f) => f.dropped) && (
            <p className="retry-steps">
              {state.stage + 1}단계 → {state.stage}단계
            </p>
          )}
          <div className="v3-card">
            <b>
              코인 <span data-testid="retry-coins">-{fails.length * 10}</span>
            </b>
            <small>{fails.some((f) => f.dropped) ? "퀘스트를 올바르게 하지 않았어!" : "부모님이 한 번 더 해보자고 하셨어."}</small>
          </div>
          <div className="v3-actions">
            <button
              className="btn btn-blue btn-lg"
              onClick={() => {
                const missionId = fails[0].missionId;
                update(markFailsSeen);
                go(`/capture/${missionId}`);
              }}
              data-testid="retry-now"
            >
              다시 찍기
            </button>
            <button className="btn btn-white btn-lg" onClick={() => update(markFailsSeen)} data-testid="retry-later">
              나중에 할래
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
