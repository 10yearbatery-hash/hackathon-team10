// O1~O7 온보딩. 처음 한 번만 거친다 (유저저니 2장)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MISSIONS, VIDEO_SECONDS, type MissionId } from "../../core/model";
import { clampSeconds, finishSetup } from "../../core/rules";
import { go } from "../../app/router";
import { handoff, update } from "../../app/store";
import { sfx, unlockSound } from "../../platform/sound";
import { Icon } from "../../ui/icons";
import { MAP_W, MapPath, scrollFor, TOTAL_H } from "../../ui/MapPath";
import { Actor, Hero, nick, PinPad } from "../../ui/parts";
import { msUntilReveal } from "../../ui/Splash";

/** 부모 설정 중인 값. O7에서 한 번에 저장한다 */
const draft = { pin: "", childName: "" };

function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 47) % 100}%`, animationDelay: `${(i % 7) * 0.9}s`, animationDuration: `${6 + (i % 5)}s`, width: 4 + (i % 3) * 3, height: 4 + (i % 3) * 3 }} />
      ))}
    </div>
  );
}

// ---------- O1 시작 (환영 → 펭귄 인사) ----------
const GREETING = ["안녕! 나는 파란 펭귄이야.", "공주를 구하러 같이 가 줄래?"];

/** 글자를 하나씩 보여준다. 다 쓰면 onDone */
function useTypewriter(lines: string[], run: boolean, onDone: () => void) {
  const full = lines.join("\n");
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return setN(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= full.length) {
        window.clearInterval(t);
        onDone();
      }
    }, 55);
    return () => window.clearInterval(t);
  }, [run]);
  return full.slice(0, n);
}

export function Start() {
  const [step, setStep] = useState<"welcome" | "greet">("welcome");
  // 스플래시가 걷히는 순간에 등장 연출이 시작되게 그때까지 그리지 않는다
  const [revealed, setRevealed] = useState(msUntilReveal() === 0);
  useEffect(() => {
    if (revealed) return;
    const t = window.setTimeout(() => setRevealed(true), msUntilReveal());
    return () => window.clearTimeout(t);
  }, [revealed]);
  const [typed, setTyped] = useState(false);
  const text = useTypewriter(GREETING, step === "greet", () => {
    setTyped(true);
    sfx.coin();
  });

  return (
    <section className={`screen start-v2 step-${step}`} data-testid="screen-start">
      <Snow />
      {!revealed ? null : step === "welcome" ? (
        <>
          <div className="welcome-body">
            <div className="welcome-hero">
              <Actor variant="idle" size={190} />
            </div>
            <h1 className="welcome-logo">펭귄 모험</h1>
            <p className="welcome-sub">매일 작은 습관으로 공주를 구하러 가요!</p>
          </div>
          <div className="bottom-cta welcome-cta">
            <button
              className="btn btn-blue btn-xl"
              data-testid="start"
              onClick={() => {
                unlockSound();
                sfx.tap();
                setStep("greet");
              }}
            >
              시작하기
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="greet-back" onClick={() => { setTyped(false); setStep("welcome"); }} aria-label="뒤로">
            <Icon name="left" size={26} />
          </button>
          <div className="greet-body">
            <div className="greet-bubble" data-testid="greet-bubble">
              {text}
              <span className="caret" aria-hidden="true" />
            </div>
            <div className="greet-hero">
              <Actor variant="hop-in" size={170} talking={!typed} className={typed ? "cheer" : ""} />
            </div>
          </div>
          <div className="bottom-cta">
            <button
              className={`btn btn-xl ${typed ? "btn-blue" : "btn-ghost"}`}
              disabled={!typed}
              onClick={() => {
                sfx.tap();
                go("/intro");
              }}
              data-testid="greet-next"
            >
              계속하기
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- O2 온보딩 영상 ----------
export function Intro() {
  const ref = useRef<HTMLVideoElement>(null);
  const [needTap, setNeedTap] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.play().catch(() => {
      // 소리 있는 자동 재생이 막히면 한 번 더 누르게 한다
      setNeedTap(true);
    });
  }, []);

  return (
    <section className="screen intro" data-testid="screen-intro">
      <video
        ref={ref}
        className="intro-video"
        src="./media/intro.mp4"
        playsInline
        preload="auto"
        onEnded={() => go("/descent", { replace: true })}
        onError={() => go("/descent", { replace: true })}
        data-testid="intro-video"
      />
      {needTap && (
        <button
          className="btn btn-blue intro-tap"
          onClick={() => {
            setNeedTap(false);
            void ref.current?.play();
          }}
        >
          <Icon name="play" size={20} /> 영상 보기
        </button>
      )}
    </section>
  );
}

// ---------- O3 하강 연출 ----------
export function Descent() {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [done, setDone] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const scale = el.clientWidth / MAP_W;
    setWidth(el.clientWidth);
    // 피그마 지도는 1일이 맨 위, 100일(마법성)이 맨 아래다. 성에서 시작해 1일까지 올라온다
    const from = TOTAL_H * scale - el.clientHeight;
    const target = Math.max(0, scrollFor(1, scale, el.clientHeight));
    el.scrollTop = from;
    const start = performance.now() + 900;
    const duration = 5600;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - start) / duration));
      const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      el.scrollTop = from + (target - from) * ease;
      if (k < 1) raf = requestAnimationFrame(step);
      else setDone(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (done) sfx.climb();
  }, [done]);

  return (
    <section className="screen kid descent" data-testid="screen-descent">
      <div className="path-scroll no-scroll" ref={box}>
        <MapPath width={width} current={1} resting={false} />
      </div>
      <div className={`descent-line ${done ? "show" : ""}`} data-testid="descent-line">
        <p>공주를 구하러 가자!</p>
        <button className="btn btn-blue btn-lg" onClick={() => go("/handoff", { replace: true })} data-testid="descent-next" disabled={!done}>
          좋아! <Icon name="right" size={22} />
        </button>
      </div>
    </section>
  );
}

// ---------- O4 부모님께 폰 넘기기 ----------
export function HandToParent() {
  return (
    <section className="screen kid center-screen" data-testid="screen-handoff">
      <Snow />
      <Hero pose="wave" size={170} />
      <h1 className="jua big-title">엄마 아빠를 불러 주세요!</h1>
      <p className="muted">처음 한 번만 부모님이 설정해요</p>
      <div className="bottom-cta">
        <button className="btn btn-blue btn-xl" onClick={() => go("/setup/pin")} data-testid="parent-came">
          부모님이 왔어요
        </button>
      </div>
    </section>
  );
}

function SetupHead({ step }: { step: number }) {
  return (
    <header className="setup-head">
      <span>부모님 설정</span>
      <b>({step}/3)</b>
      <div className="setup-bar">
        <i style={{ width: `${(step / 3) * 100}%` }} />
      </div>
    </header>
  );
}

// ---------- O5 PIN 만들기 ----------
export function SetupPin() {
  const [first, setFirst] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [error, setError] = useState("");

  function done(pin: string) {
    if (first === null) {
      setFirst(pin);
      setError("");
      return;
    }
    if (pin !== first) {
      sfx.wrong();
      setFirst(null);
      setShake((n) => n + 1);
      setError("두 번 누른 숫자가 달라요. 처음부터 다시 눌러 주세요");
      return;
    }
    draft.pin = pin;
    go("/setup/name");
  }

  return (
    <section className="screen parent setup" data-testid="screen-setup-pin">
      <SetupHead step={1} />
      <h1 className="setup-title">{first === null ? "부모님만 아는 비밀번호\n4자리를 만들어 주세요" : "한 번 더 눌러 주세요"}</h1>
      <p className="error" data-testid="pin-error">{error}</p>
      <PinPad onDone={done} shake={shake} testPrefix="ob-key" />
    </section>
  );
}

// ---------- O6 아이 이름 ----------
export function SetupName() {
  const [name, setName] = useState(draft.childName);
  const ok = name.trim().length > 0;

  useEffect(() => {
    if (!draft.pin) go("/setup/pin", { replace: true });
  }, []);

  return (
    <section className="screen parent setup" data-testid="screen-setup-name">
      <SetupHead step={2} />
      <h1 className="setup-title">아이 이름을 알려 주세요</h1>
      <input
        className="field"
        value={name}
        maxLength={10}
        placeholder="예: 하늘"
        onChange={(e) => setName(e.target.value)}
        data-testid="child-name"
        autoFocus
      />
      <p className="hint">상점의 "{nick(name.trim() || "하늘")}의 코인"처럼 쓰여요</p>
      <div className="bottom-cta">
        <button
          className="btn btn-purple btn-lg"
          disabled={!ok}
          onClick={() => {
            draft.childName = name.trim();
            go("/setup/mission");
          }}
          data-testid="name-next"
        >
          다음
        </button>
      </div>
    </section>
  );
}

export function SecondsStepper({ value, onChange, testId }: { value: number; onChange: (n: number) => void; testId?: string }) {
  return (
    <div className="stepper" data-testid={testId}>
      <span>영상 길이</span>
      <button aria-label="5초 줄이기" onClick={() => onChange(clampSeconds(value - 5))} disabled={value <= VIDEO_SECONDS.min}>
        −
      </button>
      <b data-testid={testId ? `${testId}-value` : undefined}>{value}</b>
      <span>초</span>
      <button aria-label="5초 늘리기" onClick={() => onChange(clampSeconds(value + 5))} disabled={value >= VIDEO_SECONDS.max}>
        +
      </button>
    </div>
  );
}

// ---------- O7 미션 고르기 ----------
export function SetupMission() {
  const [picked, setPicked] = useState<MissionId>("brush");
  const [seconds, setSeconds] = useState(VIDEO_SECONDS.default);

  useEffect(() => {
    if (!draft.pin || !draft.childName) go("/setup/pin", { replace: true });
  }, []);

  function choose() {
    const changed = update((s) => finishSetup(s, { pin: draft.pin, childName: draft.childName, mission: { id: picked, seconds } }));
    if (!changed) return;
    sfx.tap();
    handoff.parentOk = false;
    go(`/first/${picked}`);
  }

  return (
    <section className="screen parent setup" data-testid="screen-setup-mission">
      <SetupHead step={3} />
      <h1 className="setup-title">처음엔 미션 1개를 골라요</h1>
      <div className="mission-pick" role="radiogroup">
        {MISSIONS.map((m) => (
          <div key={m.id} className={`pick-row ${picked === m.id ? "on" : ""}`}>
            <label data-testid={`pick-${m.id}`}>
              <input type="radio" name="mission" checked={picked === m.id} onChange={() => setPicked(m.id)} />
              <span className="pick-icon">{m.icon}</span>
              <span className="pick-name">{m.name}</span>
              <span className={`badge ${m.kind}`}>{m.kind === "video" ? "영상" : "사진"}</span>
            </label>
            {picked === m.id && m.kind === "video" && <SecondsStepper value={seconds} onChange={setSeconds} testId="seconds" />}
          </div>
        ))}
        <button
          className="pick-row locked-row"
          onClick={() => {
            handoff.subscribeBack = "/setup/mission";
            go("/subscribe");
          }}
          data-testid="more-missions"
        >
          <Icon name="lock" size={20} />
          <span>
            <b>미션 더 추가하기</b>
            <small>구독하면 더 할 수 있어요</small>
          </span>
          <Icon name="right" size={20} />
        </button>
      </div>
      <div className="bottom-cta">
        <button className="btn btn-purple btn-lg" onClick={choose} data-testid="mission-choose">
          선택
        </button>
      </div>
    </section>
  );
}
