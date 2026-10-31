// 앱을 열 때 한 번 나오는 스플래시. 파란 화면에 펭귄이 쑥 올라와 고개를 갸웃한 뒤,
// 화면이 펭귄 쪽으로 동그랗게 오므라들며 다음 화면이 드러난다.
import { useEffect, useState } from "react";

const RISE_MS = 650;
const HOLD_MS = 1150;
const CLOSE_MS = 600;

const REDUCED = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const SHOW_MS = REDUCED ? 600 : RISE_MS + HOLD_MS;

/** 스플래시가 오므라들기 시작하는 시각 (앱을 불러온 때 기준). 첫 화면이 이때 등장 연출을 시작한다 */
const revealAt = performance.now() + SHOW_MS;
export function msUntilReveal(): number {
  return Math.max(0, revealAt - performance.now());
}

export function Splash() {
  const [phase, setPhase] = useState<"in" | "close" | "gone">("in");

  useEffect(() => {
    const total = msUntilReveal();
    const t1 = window.setTimeout(() => setPhase("close"), total);
    const t2 = window.setTimeout(() => setPhase("gone"), total + CLOSE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <div className={`splash splash-${phase}`} aria-hidden="true" data-testid="splash">
      <div className="splash-hero">
        <img src="./char/hero_wave.png" alt="" draggable={false} />
      </div>
      <p className="splash-logo">펭귄 모험</p>
    </div>
  );
}
