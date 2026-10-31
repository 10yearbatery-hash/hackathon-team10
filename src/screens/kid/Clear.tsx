// C4 + C5 미션 클리어 연출 (O9도 같은 화면). 사용자가 보낸 참고 영상(미션클리어.mp4)의 순서를 따른다.
//  0.0s 펭귄이 뛰어 들어오고 금빛 반짝이 고리가 빙글 돈다
//  1.1s 머리 위로 "+10"이 튀어나온다
//  1.6s 동전이 분수처럼 터져 바닥에 떨어지고 통통 튄다
//  3.0s 동전이 코인 칩으로 날아 들어가며 숫자가 올라간다. 펭귄이 신나서 깡충, 양옆에서 폭죽과 색종이
//  4.6s 머리 위에 금별이 뜨고, 아래에서 "잘했어!" 카드와 확인 버튼이 올라온다
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { COIN_PER_MISSION } from "../../core/model";
import { coins } from "../../core/rules";
import { go } from "../../app/router";
import { handoff, useAppState } from "../../app/store";
import { sfx } from "../../platform/sound";
import { Actor, nick } from "../../ui/parts";

type Beat = 0 | 1 | 2 | 3 | 4;
const BEATS: [Beat, number][] = [
  [1, 1100],
  [2, 1600],
  [3, 3000],
  [4, 4600]
];

/** 분수처럼 튀는 동전 12개의 궤적 (가로 이동, 최고 높이, 바닥 높이, 늦게 출발) */
const COINS = Array.from({ length: 12 }, (_, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  const k = Math.floor(i / 2);
  return { x: side * (40 + k * 26), peak: 120 + ((i * 37) % 60), floor: 238 + ((i * 13) % 26), delay: (i % 6) * 0.05, spin: 0.35 + (i % 3) * 0.1 };
});

const SPARKS = Array.from({ length: 16 }, (_, i) => i);
const FIREWORK_COLORS = ["#ff6b6b", "#ffd166", "#4cc9f0", "#7ae582", "#c77dff"];

function Firework({ x, y, delay, color }: { x: string; y: string; delay: number; color: string }) {
  return (
    <span className="fw" style={{ left: x, top: y, animationDelay: `${delay}s`, ["--c" as string]: color } as CSSProperties}>
      {Array.from({ length: 12 }, (_, i) => (
        <i key={i} style={{ transform: `rotate(${i * 30}deg)` }}>
          <b style={{ animationDelay: `${delay}s` }} />
        </i>
      ))}
    </span>
  );
}

export default function Clear({ proofId }: { proofId: string }) {
  const state = useAppState();
  const info = handoff.lastSubmit?.proofId === proofId ? handoff.lastSubmit : null;
  const total = coins(state);
  const [beat, setBeat] = useState<Beat>(0);
  const [shown, setShown] = useState(total - COIN_PER_MISSION);
  const chipRef = useRef<HTMLSpanElement>(null);
  const fountainRef = useRef<HTMLDivElement>(null);
  const [toChip, setToChip] = useState({ x: 120, y: -260 });

  // 동전이 날아갈 코인 칩의 위치 (동전 분수 출발점 기준)
  useLayoutEffect(() => {
    if (beat !== 2) return;
    const chip = chipRef.current?.getBoundingClientRect();
    const origin = fountainRef.current?.getBoundingClientRect();
    if (chip && origin) setToChip({ x: chip.left + chip.width / 2 - origin.left, y: chip.top + chip.height / 2 - origin.top });
  }, [beat]);

  useEffect(() => {
    if (!info) {
      go("/home", { replace: true });
      return;
    }
    sfx.clear();
    const timers = BEATS.map(([b, ms]) => window.setTimeout(() => setBeat(b), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (beat === 1) sfx.coin();
    if (beat === 2) sfx.shutter();
    if (beat === 4) sfx.climb();
    if (beat !== 3) return;
    // 동전이 칩으로 들어가는 동안 숫자가 하나씩 올라간다
    let n = total - COIN_PER_MISSION;
    const step = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n % 3 === 0) sfx.tap();
      if (n >= total) window.clearInterval(step);
    }, 70);
    return () => window.clearInterval(step);
  }, [beat, total]);

  function ok() {
    if (!info) return;
    sfx.tap();
    handoff.lastSubmit = null;
    if (info.first) handoff.firstClear = true;
    if (info.first) {
      // 연습 미션은 단계를 올리지 않는다. 홈에서 1일 발판과 "이제부터는 혼자서!"를 보여준다 (ADR-014)
    } else if (info.climbed) {
      handoff.climbFrom = info.from;
    } else {
      handoff.openSheet = true;
    }
    go("/home", { replace: true });
  }

  if (!info) return null;

  return (
    <section className={`screen clear-show beat-${beat}`} data-testid="screen-clear">
      <div className="clear-light" aria-hidden="true" />

      <div className="clear-chip">
        <span ref={chipRef} className={`v3-coin ${beat >= 3 ? "filling" : ""}`} data-testid="clear-coins">
          <i aria-hidden="true">●</i>
          <b>{shown}</b>
        </span>
      </div>

      <div className="clear-stage" data-testid="clear-joy">
        {/* 금빛 반짝이 고리 */}
        <div className="spark-ring" aria-hidden="true">
          {SPARKS.map((i) => (
            <span key={i} style={{ transform: `rotate(${i * 22.5}deg) translateY(-118px)`, animationDelay: `${(i % 4) * 0.15}s` }}>
              ✦
            </span>
          ))}
        </div>

        {/* 폭죽 */}
        {beat >= 3 && (
          <div className="fireworks" aria-hidden="true">
            <Firework x="12%" y="18%" delay={0} color={FIREWORK_COLORS[0]} />
            <Firework x="84%" y="14%" delay={0.25} color={FIREWORK_COLORS[2]} />
            <Firework x="22%" y="44%" delay={0.55} color={FIREWORK_COLORS[3]} />
            <Firework x="78%" y="42%" delay={0.8} color={FIREWORK_COLORS[4]} />
            <Firework x="50%" y="6%" delay={1.05} color={FIREWORK_COLORS[1]} />
          </div>
        )}

        {/* 펭귄 */}
        <div className={`clear-hero ${beat >= 3 ? "party" : ""}`}>
          <Actor variant={beat >= 3 ? "party" : "land"} size={170} />
        </div>

        {/* +10 */}
        {beat >= 1 && (
          <p className="plus-ten" data-testid="earned">
            +{COIN_PER_MISSION}
          </p>
        )}

        {/* 동전 분수 → 바닥 → 칩으로 */}
        {beat >= 2 && (
          <div
            ref={fountainRef}
            className={`coin-fountain ${beat >= 3 ? "collect" : ""}`}
            style={{ ["--chip-x" as string]: `${toChip.x}px`, ["--chip-y" as string]: `${toChip.y}px` } as CSSProperties}
            aria-hidden="true"
          >
            {COINS.map((c, i) => (
              <span
                key={i}
                className="cf-x"
                style={{ ["--x" as string]: `${c.x}px`, ["--peak" as string]: `${-c.peak}px`, ["--floor" as string]: `${c.floor}px`, animationDelay: `${c.delay}s`, ["--i" as string]: i } as CSSProperties}
              >
                <span className="cf-y" style={{ animationDelay: `${c.delay}s` }}>
                  <span className="cf-coin" style={{ animationDuration: `${c.spin}s` }} />
                </span>
              </span>
            ))}
          </div>
        )}

        {/* 금별 */}
        {beat >= 4 && (
          <div className="gold-star" aria-hidden="true">
            <span className="star-rays" />
            <img src="./map/star-special.svg" alt="" />
          </div>
        )}
      </div>

      {beat >= 3 && (
        <div className="confetti-rain" aria-hidden="true">
          {Array.from({ length: 36 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 29) % 100}%`,
                background: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
                animationDelay: `${(i % 9) * 0.12}s`,
                animationDuration: `${2.2 + (i % 5) * 0.35}s`,
                width: i % 3 === 0 ? 6 : 9,
                height: i % 3 === 0 ? 12 : 7
              }}
            />
          ))}
        </div>
      )}

      <div className={`clear-panel ${beat >= 4 ? "show" : ""}`}>
        <h1 className="v3-title">잘했어!</h1>
        <p className="v3-sub">
          {nick(state.childName)}의 작은 성공을 축하해! 부모님께 기록을 보냈어.
        </p>
        <div className="v3-card">
          <b>{info.first ? "연습 미션 끝!" : info.climbed ? "다음 단계로 한 걸음!" : "조금씩 모아서 선물을 골라 봐!"}</b>
          <small>{info.first ? "이제 1일 미션을 혼자 해볼까?" : info.climbed ? "오늘은 여기서 쉬고, 자정에 다음 단계가 열려." : "다음 미션도 천천히 함께 해보자!"}</small>
        </div>
        <button className="btn btn-blue btn-xl" onClick={ok} disabled={beat < 4} data-testid="clear-ok">
          확인
        </button>
      </div>
    </section>
  );
}
