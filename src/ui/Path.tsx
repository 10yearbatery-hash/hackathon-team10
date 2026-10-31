// 1~100단계 세로 S자 눈길 (ADR-009). 아래가 1단계, 위 끝에 공주님의 성이 있다.
import { useEffect, useState } from "react";
import { LAST_STAGE } from "../core/model";
import { Hero } from "./parts";
import { Icon } from "./icons";

export const GAP = 96;
export const TOP_PAD = 300;
export const BOTTOM_PAD = 320;
export const PATH_HEIGHT = TOP_PAD + (LAST_STAGE - 1) * GAP + BOTTOM_PAD;

export function stageY(stage: number): number {
  return TOP_PAD + (LAST_STAGE - stage) * GAP;
}

export function stageX(stage: number, width: number): number {
  const amp = Math.min(110, width * 0.28);
  return width / 2 + amp * Math.sin((stage - 1) * 0.78);
}

/** 점들을 부드러운 곡선으로 잇는다 (Catmull-Rom을 베지어로) */
function roadPath(width: number): string {
  const pts = Array.from({ length: LAST_STAGE }, (_, i) => [stageX(i + 1, width), stageY(i + 1)]);
  pts.unshift([stageX(1, width), stageY(1) + 120]);
  pts.push([width / 2, stageY(LAST_STAGE) - 150]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export type NodeState = "done" | "now" | "rest" | "locked";

export function nodeState(stage: number, current: number, resting: boolean): NodeState {
  if (stage < current) return "done";
  if (stage === current) return resting ? "rest" : "now";
  return "locked";
}

interface Props {
  width: number;
  current: number;
  resting: boolean;
  onTap?: (stage: number) => void;
  /** 이 단계에서 지금 단계로 걸어 올라가는 연출 (C6) */
  climbFrom?: number | null;
  shakeStage?: number | null;
  showHero?: boolean;
}

export function Path({ width, current, resting, onTap, climbFrom = null, shakeStage = null, showHero = true }: Props) {
  const [heroStage, setHeroStage] = useState(climbFrom ?? current);
  const [hopping, setHopping] = useState(false);

  useEffect(() => {
    if (climbFrom == null || climbFrom === current) {
      setHeroStage(current);
      return;
    }
    setHeroStage(climbFrom);
    const t1 = window.setTimeout(() => {
      setHopping(true);
      setHeroStage(current);
    }, 700);
    const t2 = window.setTimeout(() => setHopping(false), 2000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [climbFrom, current]);

  return (
    <div className="path" style={{ height: PATH_HEIGHT, width }}>
      <div className="castle" style={{ top: stageY(LAST_STAGE) - 270 }}>
        <div className="castle-bubble">
          <img src="./char/heroine.png" alt="분홍 펭귄 공주" />
        </div>
        <div className="castle-label">공주님의 성</div>
      </div>
      <svg className="road" width={width} height={PATH_HEIGHT} aria-hidden="true">
        <path d={roadPath(width)} className="road-edge" />
        <path d={roadPath(width)} className="road-snow" />
      </svg>
      {Array.from({ length: LAST_STAGE }, (_, i) => {
        const stage = i + 1;
        const st = nodeState(stage, current, resting);
        const label = st === "now" ? `${stage}단계, 지금` : st === "rest" ? `${stage}단계, 내일 만나자` : st === "done" ? `${stage}단계, 완료` : `${stage}단계, 잠김`;
        return (
          <button
            key={stage}
            className={`node node-${st} ${shakeStage === stage ? "shake" : ""}`}
            style={{ left: stageX(stage, width), top: stageY(stage) }}
            onClick={() => onTap?.(stage)}
            aria-label={label}
            data-testid={`stage-${stage}`}
            data-state={st}
          >
            {st === "rest" ? <Icon name="moon" size={22} /> : st === "locked" && stage > current + 1 ? <Icon name="lock" size={18} /> : stage}
            {st === "now" && <span className="node-glow" aria-hidden="true" />}
          </button>
        );
      })}
      {showHero && (
        <div
          className={`path-hero ${hopping ? "hopping" : ""}`}
          style={{ left: stageX(heroStage, width), top: stageY(heroStage) }}
          data-testid="path-hero"
          data-stage={heroStage}
        >
          <Hero pose={resting && !hopping ? "thumbs" : "wave"} size={resting && !hopping ? 64 : 58} />
          {resting && !hopping && <span className="zzz">Zz</span>}
        </div>
      )}
    </div>
  );
}
