// 앱을 열 때 한 번 나오는 스플래시. 파란 화면에 펭귄이 뛰어올라 착지하고 한 번 더 깡충 뛴 뒤,
// 펭귄 자리에서 하얀 원이 바깥으로 퍼지며 다음 화면이 열린다.
import { useEffect, useState } from "react";
import { Actor } from "./parts";

const RISE_MS = 700;
const HOLD_MS = 1150;
const CLOSE_MS = 650;

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
      <div className="splash-stage">
        <Actor variant="splash" size={170} />
      </div>
      <p className="splash-logo">펭귄 모험</p>
      <span className="splash-burst" />
    </div>
  );
}
