// C4 클리어 기쁨 → C5 코인 획득 (O9도 같은 화면)
import { useEffect, useState } from "react";
import { COIN_PER_MISSION } from "../../core/model";
import { coins } from "../../core/rules";
import { go } from "../../app/router";
import { handoff, useAppState } from "../../app/store";
import { sfx } from "../../platform/sound";
import { Confetti, CoinChip, Hero } from "../../ui/parts";

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
    const t1 = window.setTimeout(() => setPhase("coin"), 1900);
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
    <section className={`screen kid clear phase-${phase}`} data-testid="screen-clear">
      <div className="clear-top">
        <CoinChip value={shown} testId="clear-coins" />
      </div>
      {phase === "joy" ? (
        <div className="clear-joy" data-testid="clear-joy">
          <Confetti />
          <p className="eyebrow">멋진 한 걸음!</p>
          <h1 className="jua mega">잘했어!</h1>
          <Hero pose="cheer" size={220} motion="jump" />
        </div>
      ) : (
        <div className="clear-coin" data-testid="clear-coin">
          <Confetti count={10} />
          <Hero pose="thumbs" size={150} motion="breathe" />
          <div className="coin-burst" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="fly-coin" style={{ animationDelay: `${i * 0.09}s`, left: `${30 + i * 10}%` }}>
                ●
              </span>
            ))}
          </div>
          <div className="coin-card">
            <small>코인을 받았어요</small>
            <b data-testid="earned">+{COIN_PER_MISSION}</b>
          </div>
          <p className="muted">{info.climbed ? "다음 단계로 올라가자!" : "다음 미션도 해볼까?"}</p>
          <div className="bottom-cta">
            <button className="btn btn-blue btn-xl" onClick={ok} disabled={phase !== "landed"} data-testid="clear-ok">
              확인
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
