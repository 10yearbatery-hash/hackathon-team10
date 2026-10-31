// C1 홈(길), C2 단계 팝업, C8 다시 해보자
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { chapterName, chapterOf, coins, coinsToNextGift, doneCount, isResting, markFailsSeen, stageCards, stepsToCastle, unseenFails } from "../../core/rules";
import { go } from "../../app/router";
import { handoff, update, useAppState } from "../../app/store";
import { sfx } from "../../platform/sound";
import { Icon } from "../../ui/icons";
import { Path, stageY } from "../../ui/Path";
import { CoinChip, Hero, TabBar } from "../../ui/parts";

export default function Home() {
  const state = useAppState();
  const now = Date.now();
  const resting = isResting(state, now);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
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
    setWidth(el.clientWidth);
    const focus = climbFrom ?? state.stage;
    el.scrollTop = stageY(focus) - el.clientHeight * 0.6;
  }, []);

  useEffect(() => {
    if (climbFrom == null) return;
    handoff.climbFrom = null;
    const el = box.current;
    const t1 = window.setTimeout(() => sfx.climb(), 700);
    const t2 = window.setTimeout(() => el?.scrollTo({ top: stageY(state.stage) - el.clientHeight * 0.6, behavior: "smooth" }), 700);
    let t3 = 0;
    if (handoff.firstClear) {
      handoff.firstClear = false;
      t3 = window.setTimeout(() => setFirstBanner(true), 2100);
    }
    return () => [t1, t2, t3].forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  function tapStage(stage: number) {
    if (stage === state.stage && !resting) {
      sfx.tap();
      setSheet(true);
    } else if (stage === state.stage && resting) {
      sfx.soft();
      setToast("오늘은 다 했어! 내일 만나자 🌙");
    } else if (stage > state.stage) {
      sfx.wrong();
      setShakeStage(stage);
      window.setTimeout(() => setShakeStage(null), 500);
      setToast("아직이야!");
    } else {
      setToast(`${stage}단계는 벌써 지나왔어!`);
    }
  }

  const cards = stageCards(state);
  const done = doneCount(state);

  return (
    <section className="screen kid home" data-testid="screen-home">
      <header className="home-head">
        <div className="row between">
          <span className="app-name">펭귄 모험</span>
          <CoinChip value={wallet} />
        </div>
        <p className="chapter-no">{chapterOf(state.stage)}장</p>
        <h1 className="chapter-name jua">{chapterName(state.stage)}</h1>
        <p className="castle-left" data-testid="castle-left">공주님 성까지 {stepsToCastle(state)}칸 남았어요!</p>
      </header>

      <div className="path-scroll" ref={box}>
        <Path width={width} current={state.stage} resting={resting} onTap={tapStage} climbFrom={climbFrom} shakeStage={shakeStage} />
      </div>

      {next && (
        <div className="next-gift card" data-testid="next-gift">
          <span className="gift-badge">
            <Icon name="gift" size={22} />
          </span>
          <div className="grow">
            <small>다음 선물 · {next.name}</small>
            <b>{next.need > 0 ? `코인 ${next.need}개만 더 모으면 돼요!` : "지금 고를 수 있어요!"}</b>
          </div>
          {resting && (
            <span className="rest-pill" data-testid="rest-pill">
              <Icon name="moon" size={14} /> 내일 만나자
            </span>
          )}
        </div>
      )}

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
            <small>내일 2단계에서 만나자</small>
            <button className="btn btn-blue btn-lg" onClick={() => setFirstBanner(false)} data-testid="first-banner-ok">
              좋아!
            </button>
          </div>
        </div>
      )}

      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(false)} data-testid="sheet-back">
          <div className="sheet" onClick={(e) => e.stopPropagation()} data-testid="stage-sheet">
            <div className="sheet-grip" />
            <h2>
              <b>{state.stage}단계</b> 오늘의 미션
            </h2>
            <ul className="mission-cards">
              {cards.map((c) => (
                <li key={c.id} className={`mission-card st-${c.status}`} data-testid={`mission-${c.id}`} data-status={c.status}>
                  <span className="mission-icon">{c.icon}</span>
                  <div className="grow">
                    <b>{c.name}</b>
                    <small>
                      <Icon name={c.kind === "video" ? "video" : "camera"} size={13} /> {c.kind === "video" ? `영상 ${c.seconds}초` : "사진"}
                      {c.status === "retry" && <em> · 다시 해보자</em>}
                    </small>
                  </div>
                  {c.status === "done" ? (
                    <span className="done-mark" aria-label="완료">
                      <Icon name="check" size={22} stroke={3} />
                    </span>
                  ) : (
                    <button className="btn btn-blue btn-sm" onClick={() => go(`/capture/${c.id}`)} data-testid={`go-${c.id}`}>
                      하러 가기
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="sheet-count" data-testid="sheet-count">
              오늘 {done} / {cards.length} 완료
            </p>
          </div>
        </div>
      )}

      {fails.length > 0 && (
        <div className="retry-screen" data-testid="retry-screen">
          <Hero pose="thumbs" size={150} motion="jump" />
          <h1 className="jua">다시 해보자!</h1>
          <p>한 번 더 찍어볼까?</p>
          <div className="step-down">
            <span className="node-chip">{state.stage + 1}단계</span>
            <Icon name="right" size={20} />
            <span className="node-chip now">{state.stage}단계</span>
          </div>
          <p className="muted">
            한 단계 내려왔어요 · 코인 <b data-testid="retry-coins">-{fails.length * 10}</b>
          </p>
          <div className="row gap">
            <button
              className="btn btn-blue btn-lg grow"
              onClick={() => {
                const missionId = fails[0].missionId;
                update(markFailsSeen);
                go(`/capture/${missionId}`);
              }}
              data-testid="retry-now"
            >
              다시 찍기
            </button>
            <button className="btn btn-ghost btn-lg grow" onClick={() => update(markFailsSeen)} data-testid="retry-later">
              나중에
            </button>
          </div>
        </div>
      )}

      <TabBar active="home" />
    </section>
  );
}
