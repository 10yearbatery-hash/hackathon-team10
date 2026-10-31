// C4 잘했어! → C5 코인을 받았어! (O9도 같은 화면). 디자인: 피그마 "V3/C4", "V3/C5"
import { useEffect, useState } from "react";
import { COIN_PER_MISSION } from "../../core/model";
import { coins } from "../../core/rules";
import { go } from "../../app/router";
import { handoff, useAppState } from "../../app/store";
import { sfx } from "../../platform/sound";
import { Confetti, Hero, nick } from "../../ui/parts";

export default function Clear({ proofId }: { proofId: string }) {
  const state = useAppState();
  const info = handoff.lastSubmit?.proofId === proofId ? handoff.lastSubmit : null;
  const [phase, setPhase] = useState<"joy" | "coin" | "landed">("joy");
  const total = coins(state);
  const [shown, setShown] = useState(total - COIN_PER_MISSION);

  useEffect(() => {
    if (!info) {
      go("/home", { replace: true });
      return;
    }
    sfx.clear();
    const t1 = window.setTimeout(() => setPhase("coin"), 2000);
    return () => window.clearTimeout(t1);
  }, []);

  // 코인이 칩으로 날아간 뒤 숫자가 올라간다
  useEffect(() => {
    if (phase !== "coin") return;
    const t = window.setTimeout(() => {
      sfx.coin();
      setPhase("landed");
      let n = total - COIN_PER_MISSION;
      const step = window.setInterval(() => {
        n += 1;
        setShown(n);
        if (n >= total) window.clearInterval(step);
      }, 45);
    }, 1100);
    return () => window.clearTimeout(t);
  }, [phase, total]);

  function ok() {
    if (!info) return;
    sfx.tap();
    handoff.lastSubmit = null;
    if (info.first) handoff.firstClear = true;
    if (info.climbed) {
      handoff.climbFrom = info.from;
    } else {
      handoff.openSheet = true;
    }
    go("/home", { replace: true });
  }

  if (!info) return null;

  return (
    <section className={`screen v3 clear-v3 phase-${phase}`} data-testid="screen-clear">
      {phase === "joy" ? (
        <div className="clear-body" data-testid="clear-joy">
          <Confetti />
          <h1 className="v3-title">잘했어!</h1>
          <p className="v3-sub">네가 직접 시작한 게 정말 멋져!</p>
          <div className="v3-hero big">
            <Hero pose="cheer" size={210} motion="jump" />
            <p>{nick(state.childName)}의 작은 성공을 축하해!</p>
          </div>
          <p className="clear-sent">부모님께 기록을 보냈어.</p>
        </div>
      ) : (
        <div className="clear-body" data-testid="clear-coin">
          <div className="v3-title-row">
            <h1 className="v3-title">코인을 받았어!</h1>
            <span className="v3-coin" data-testid="clear-coins">
              <i aria-hidden="true">●</i>
              <b>{shown}</b>
            </span>
          </div>
          <p className="v3-sub">오늘의 작은 성공이 쌓였어.</p>
          <div className="v3-hero">
            <Hero pose="thumbs" size={130} motion="breathe" />
          </div>
          <p className="earned-v3" data-testid="earned">
            +{COIN_PER_MISSION} 코인
          </p>
          <div className="coin-dots" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
          <div className="v3-card">
            <b>{info.climbed ? "다음 단계로 한 걸음!" : "조금씩 모아서 선물을 골라 봐!"}</b>
            <small>{info.climbed ? "오늘은 여기서 쉬고, 자정에 다음 단계가 열려." : "다음 미션도 천천히 함께 해보자!"}</small>
          </div>
          <div className="v3-actions">
            <button className="btn btn-blue btn-xl" onClick={ok} disabled={phase !== "landed"} data-testid="clear-ok">
              확인
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
