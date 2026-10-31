// 100일 구출 지도 (피그마 "02A 채택 스테이지 UI", "02B 스테이지 지도 원본").
// 10개 장의 그림 지도를 위에서 아래로 이어 붙인다. 1장 1단계가 맨 위, 10장 100단계가 맨 아래다.
// 모든 좌표는 피그마의 390 x 1460 지도 한 장 기준이고, 화면 폭에 맞춰 통째로 확대·축소한다.
import { useEffect, useState } from "react";
import { CHAPTERS, LAST_STAGE, STAGES_PER_CHAPTER, type StoneKind } from "../core/model";
import { stageReward } from "../core/rules";

export const MAP_W = 390;
export const MAP_H = 1460;
const STONE_W = 84;
const STONE_H = 90;

/** 한 장 안 10개 발판의 왼쪽 위 좌표. 모든 장이 같다 */
const STONES: [number, number][] = [
  [177, 225],
  [236, 336],
  [256, 447],
  [210, 558],
  [132, 669],
  [96, 780],
  [128, 891],
  [211, 1002],
  [259, 1113],
  [212, 1224]
];

const STONE_SRC: Record<StoneKind, string> = {
  ice: "./map/stone-ice.svg",
  frost: "./map/stone-frost.svg",
  melt: "./map/stone-melt.svg",
  purple: "./map/stone-purple.svg"
};

/** 2장 지도에는 발자국 길이 없다 */
const HAS_FOOTPRINTS = [true, false, true, true, true, true, true, true, true, true];

export type NodeState = "done" | "now" | "rest" | "locked";

export function nodeState(stage: number, current: number, resting: boolean): NodeState {
  if (stage < current) return "done";
  if (stage === current) return resting ? "rest" : "now";
  return "locked";
}

/** 지도 전체(10장) 기준 발판 왼쪽 위 좌표 (확대 전) */
export function stonePos(stage: number): { x: number; y: number } {
  const ch = Math.floor((stage - 1) / STAGES_PER_CHAPTER);
  const [x, y] = STONES[(stage - 1) % STAGES_PER_CHAPTER];
  return { x, y: ch * MAP_H + y };
}

/** 이 단계 발판이 화면 세로 가운데쯤 오도록 하는 스크롤 값 (확대 후) */
export function scrollFor(stage: number, scale: number, viewH: number): number {
  return (stonePos(stage).y + STONE_H / 2) * scale - viewH * 0.55;
}

export const TOTAL_H = MAP_H * CHAPTERS.length;

interface Props {
  width: number;
  current: number;
  resting: boolean;
  onTap?: (stage: number) => void;
  climbFrom?: number | null;
  shakeStage?: number | null;
  showHero?: boolean;
}

export function MapPath({ width, current, resting, onTap, climbFrom = null, shakeStage = null, showHero = true }: Props) {
  const scale = width / MAP_W;
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

  const hero = stonePos(heroStage);

  return (
    <div className="map" style={{ width, height: TOTAL_H * scale }}>
      <div className="map-inner" style={{ width: MAP_W, height: TOTAL_H, transform: `scale(${scale})` }}>
        {CHAPTERS.map((ch, i) => (
          <section key={i} className="map-chapter" style={{ top: i * MAP_H }} aria-label={`${i + 1}장 ${ch.name}`} data-testid={`chapter-${i + 1}`}>
            <img className="map-bg" src={`./map/ch${i + 1}.jpg`} alt="" draggable={false} />
            {HAS_FOOTPRINTS[i] && <img className="map-steps" src={`./map/path-${i + 1}.svg`} alt="" draggable={false} />}
            <div className="map-say" style={{ color: ch.sayColor }}>
              {ch.says.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="map-reward" style={{ left: 224, top: 684, color: ch.labelColor }}>
              <b>반짝 별 선물</b>
              <small>{i * 10 + 5}일의 약속</small>
            </div>
            <div className="map-reward" style={{ left: 100, top: 1239, color: ch.labelColor }}>
              <b>{i === CHAPTERS.length - 1 ? "구출의 날!" : "챕터 보물"}</b>
              <small>{i * 10 + 10}일의 약속</small>
            </div>
            <div className="map-next" style={{ color: ch.labelColor }}>
              <b>{ch.next}</b>
              {i === CHAPTERS.length - 1 && <small>100번째 미션으로 마법을 풀어주세요.</small>}
            </div>
          </section>
        ))}

        {Array.from({ length: LAST_STAGE }, (_, k) => {
          const stage = k + 1;
          const { x, y } = stonePos(stage);
          const st = nodeState(stage, current, resting);
          const reward = stageReward(stage);
          const kind = CHAPTERS[Math.floor(k / STAGES_PER_CHAPTER)].stone;
          const src = reward === "star" ? "./map/stone-star.svg" : reward === "chest" ? "./map/stone-chest.svg" : STONE_SRC[kind];
          const label = st === "now" ? `${stage}일, 오늘` : st === "rest" ? `${stage}일, 내일 만나자` : st === "done" ? `${stage}일, 완료` : `${stage}일, 아직 잠김`;
          return (
            <button
              key={stage}
              className={`stone stone-${st} ${shakeStage === stage ? "shake" : ""}`}
              style={{ left: x, top: y, width: STONE_W, height: STONE_H }}
              onClick={() => onTap?.(stage)}
              aria-label={label}
              data-testid={`stage-${stage}`}
              data-state={st}
            >
              {st === "now" && <span className="stone-glow" aria-hidden="true" />}
              <img className="stone-img" src={src} alt="" draggable={false} />
              {reward ? (
                <img className="stone-star" src={reward === "star" ? "./map/star-gold.svg" : "./map/star-magic.svg"} alt="" />
              ) : (
                <span className="stone-no">{stage}</span>
              )}
              <span className="stone-day">{stage}일</span>
              {st === "done" && <span className="stone-badge done">✓</span>}
              {st === "rest" && <span className="stone-badge rest">☾</span>}
            </button>
          );
        })}

        {showHero && (
          <div
            className={`map-hero ${hopping ? "hopping" : ""} ${resting && !hopping ? "resting" : ""}`}
            style={{ left: hero.x + STONE_W / 2, top: hero.y + 18 }}
            data-testid="path-hero"
            data-stage={heroStage}
          >
            <span className="map-hero-shadow" aria-hidden="true" />
            <img src="./map/hero-go.png" alt="파란 펭귄" draggable={false} />
            {resting && !hopping && <span className="zzz">Zz</span>}
          </div>
        )}
      </div>
    </div>
  );
}
