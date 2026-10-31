// 여러 화면이 함께 쓰는 조각: 코인 칩, 캐릭터, 아래 탭, 키패드, 팝업
import { useEffect, useState, type ReactNode } from "react";
import { go } from "../app/router";
import { handoff } from "../app/store";
import { sfx } from "../platform/sound";
import { Icon, type IconName } from "./icons";

export type Pose = "wave" | "cheer" | "thumbs";
const POSE_SRC: Record<Pose, string> = {
  wave: "./char/hero_wave.png",
  cheer: "./char/hero_cheer.png",
  thumbs: "./char/hero_thumbs.png"
};

/** 파란 펭귄. 가만히 있지 않고 숨 쉬듯 움직인다 (ADR-004) */
export function Hero({ pose = "wave", size = 120, motion = "breathe", className = "" }: { pose?: Pose; size?: number; motion?: "breathe" | "jump" | "none"; className?: string }) {
  return <img className={`hero hero-${motion} ${className}`} src={POSE_SRC[pose]} alt="파란 펭귄" style={{ width: size }} draggable={false} />;
}

export function CoinChip({ value, testId = "coin-chip" }: { value: number; testId?: string }) {
  return (
    <span className="coin-chip" data-testid={testId}>
      <Icon name="coin" size={18} />
      <b>{value.toLocaleString("ko-KR")}</b>
    </span>
  );
}

const TABS: { id: "home" | "shop" | "parent"; label: string; icon: IconName; path: string }[] = [
  { id: "home", label: "홈", icon: "house", path: "/home" },
  { id: "shop", label: "상점", icon: "gift", path: "/shop" },
  { id: "parent", label: "부모", icon: "parent", path: "/parent/pin" }
];

/** F-02: 아래 탭 홈 / 상점 / 부모 */
export function TabBar({ active }: { active: "home" | "shop" | "parent" }) {
  return (
    <nav className="tabbar" aria-label="아래 탭">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab ${active === t.id ? "on" : ""}`}
          data-testid={`tab-${t.id}`}
          aria-current={active === t.id ? "page" : undefined}
          onClick={() => {
            if (active === t.id) return;
            sfx.tap();
            if (t.id !== "parent") handoff.parentOk = false;
            go(t.id === "parent" && handoff.parentOk ? "/parent" : t.path);
          }}
        >
          <Icon name={t.icon} size={24} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function TopBar({ title, onBack, right, tone = "kid" }: { title: string; onBack?: () => void; right?: ReactNode; tone?: "kid" | "parent" }) {
  return (
    <header className={`topbar topbar-${tone}`}>
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="뒤로" data-testid="back">
          <Icon name="left" size={24} />
        </button>
      ) : (
        <span className="icon-btn-space" />
      )}
      <h1>{title}</h1>
      <span className="topbar-right">{right}</span>
    </header>
  );
}

/** PIN 키패드. 4자리를 다 누르면 onDone. shake가 바뀌면 칸이 흔들린다 */
export function PinPad({ onDone, shake, testPrefix = "key" }: { onDone: (pin: string) => void; shake: number; testPrefix?: string }) {
  const [digits, setDigits] = useState("");
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (shake === 0) return;
    setShaking(true);
    setDigits("");
    const t = window.setTimeout(() => setShaking(false), 450);
    return () => window.clearTimeout(t);
  }, [shake]);

  function press(d: string) {
    sfx.tap();
    if (digits.length >= 4) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      window.setTimeout(() => {
        setDigits("");
        onDone(next);
      }, 120);
    }
  }

  return (
    <div className="pinpad">
      <div className={`pin-dots ${shaking ? "shake" : ""}`} data-testid="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < digits.length ? "on" : ""} />
        ))}
      </div>
      <div className="keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "<"].map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : k === "<" ? (
            <button key={i} className="key key-del" aria-label="지우기" onClick={() => setDigits((d) => d.slice(0, -1))} data-testid={`${testPrefix}-del`}>
              <Icon name="back" size={26} />
            </button>
          ) : (
            <button key={i} className="key" onClick={() => press(k)} data-testid={`${testPrefix}-${k}`}>
              {k}
            </button>
          )
        )}
      </div>
    </div>
  );
}

export function Modal({ children, onClose, testId }: { children: ReactNode; onClose?: () => void; testId?: string }) {
  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} data-testid={testId}>
        {children}
      </div>
    </div>
  );
}

/** 클리어 화면의 반짝이 */
export function Confetti({ count = 18 }: { count?: number }) {
  const colors = ["#ffd769", "#ff8f8f", "#3d9ce8", "#bfeede", "#c4a8ff"];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 53) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 6) * 0.12}s`,
            animationDuration: `${1.6 + (i % 5) * 0.25}s`,
            transform: `rotate(${i * 37}deg)`
          }}
        />
      ))}
    </div>
  );
}

/** 받침이 있는 이름은 "하늘이", 없는 이름은 "민지"처럼 부르는 이름 */
export function nick(name: string): string {
  const last = name.charCodeAt(name.length - 1);
  const hangul = last >= 0xac00 && last <= 0xd7a3;
  return hangul && (last - 0xac00) % 28 !== 0 ? `${name}이` : name;
}
