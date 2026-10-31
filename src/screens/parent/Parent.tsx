// P1~P7 부모 영역. 아이 영역과 다른 보라색 분위기로 "지금 부모 화면"이 보이게 한다 (PRD 10장)
import { useEffect, useState } from "react";
import { MISSIONS, missionDef, type MissionId, type MissionSetting } from "../../core/model";
import { giftIsValid, giveGift, openPurchases, pendingProofs, reviewProof, saveGifts, saveMissions, subscribe } from "../../core/rules";
import { go } from "../../app/router";
import { handoff, resetApp, update, useAppState } from "../../app/store";
import { sfx } from "../../platform/sound";
import { loadMedia, logout, useSync } from "../../app/sync";
import { Icon } from "../../ui/icons";
import { Hero, Modal, nick, PinPad, TabBar, TopBar } from "../../ui/parts";
import { SecondsStepper } from "../onboarding/Onboarding";

function toKid() {
  handoff.parentOk = false;
  go("/home");
}

function timeText(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return same ? `오늘 ${hm}` : `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm}`;
}

// ---------- P1 PIN ----------
export function ParentPin() {
  const state = useAppState();
  const [shake, setShake] = useState(0);
  const [error, setError] = useState("");

  function done(pin: string) {
    if (pin === state.pin) {
      handoff.parentOk = true;
      go("/parent", { replace: true });
      return;
    }
    sfx.wrong();
    setShake((n) => n + 1);
    setError("비밀번호가 달라요. 다시 눌러 주세요");
  }

  return (
    <section className="screen parent" data-testid="screen-parent-pin">
      <TopBar title="부모님 확인" onBack={toKid} tone="parent" />
      <div className="pin-body">
        <h2 className="setup-title">비밀번호를 입력하세요</h2>
        <p className="error" data-testid="pin-error">{error}</p>
        <PinPad onDone={done} shake={shake} />
      </div>
    </section>
  );
}

// ---------- P2 부모 홈 ----------
export function ParentHome() {
  const state = useAppState();
  const pending = pendingProofs(state);
  const bought = openPurchases(state);
  const [askReset, setAskReset] = useState(false);
  const sync = useSync();

  return (
    <section className="screen parent" data-testid="screen-parent-home">
      <header className="parent-head">
        <div>
          <p className="eyebrow-p">부모 영역</p>
          <h1>{nick(state.childName)} 부모님</h1>
        </div>
        <button className="btn btn-outline-p btn-sm" onClick={toKid} data-testid="to-kid">
          아이 화면으로
        </button>
      </header>

      <div className="scroll-body parent-body">
        <div className={`task-card ${pending.length ? "has" : ""}`} data-testid="task-proofs">
          <div className="task-icon">{pending.length ? "!" : "✓"}</div>
          <div className="grow">
            <b>{pending.length ? `확인할 인증 ${pending.length}건` : "확인할 인증이 없어요"}</b>
            {pending.length > 0 && <small>{[...new Set(pending.map((p) => p.missionName))].join(", ")}</small>}
          </div>
          {pending.length > 0 && (
            <button className="btn btn-purple btn-sm" onClick={() => go("/parent/review")} data-testid="go-review">
              확인하기
            </button>
          )}
        </div>

        <div className={`task-card ${bought.length ? "has" : ""}`} data-testid="task-gifts">
          <div className="task-icon gift">
            <Icon name="gift" size={20} />
          </div>
          <div className="grow">
            <b>{bought.length ? `구매한 선물 ${bought.length}개` : "구매한 선물이 없어요"}</b>
            {bought.length > 0 && <small>{bought.map((p) => p.name).join(", ")}</small>}
          </div>
          {bought.length > 0 && (
            <button className="btn btn-purple btn-sm" onClick={() => go("/parent/gifts")} data-testid="go-gifts">
              확인하기
            </button>
          )}
        </div>

        <div className="stat-row">
          <div className="stat">
            <small>지금 단계</small>
            <b data-testid="parent-stage">{state.stage}</b>
            <span>/100</span>
          </div>
          <div className="stat">
            <small>미션</small>
            <b>{state.missions.length}</b>
            <span>개</span>
          </div>
        </div>

        <div className="menu-grid">
          <button className="menu-card" onClick={() => go("/parent/missions")} data-testid="go-missions">
            <span>🎯</span>
            <b>미션 관리</b>
          </button>
          <button className="menu-card" onClick={() => go("/parent/shop")} data-testid="go-gift-edit">
            <span>🎁</span>
            <b>선물 관리</b>
          </button>
        </div>
        <button
          className="menu-wide"
          onClick={() => {
            handoff.subscribeBack = "/parent";
            go("/subscribe");
          }}
          data-testid="go-subscribe"
        >
          <Icon name="star" size={20} />
          <b>구독 안내</b>
          <small>{state.subscribed ? "구독 중" : "미션 추가, 21단계 이후"}</small>
          <Icon name="right" size={18} />
        </button>

        {sync.enabled && (
          <button className="menu-wide" onClick={() => go("/parent/account")} data-testid="go-account">
            <Icon name="parent" size={20} />
            <b>계정과 기록 저장</b>
            <small data-testid="account-summary">{sync.user ? sync.user.email : "로그인하면 서버에 저장"}</small>
            <Icon name="right" size={18} />
          </button>
        )}

        <button className="reset-link" onClick={() => setAskReset(true)} data-testid="reset">
          시연용: 처음 상태로 되돌리기
        </button>
      </div>

      {askReset && (
        <Modal onClose={() => setAskReset(false)} testId="reset-confirm">
          <h2>처음 상태로 되돌릴까요?</h2>
          <p className="muted">
            이 폰의 단계, 코인, 인증 사진·영상, 설정이 모두 지워지고 시작 화면으로 가요.{sync.user && " 로그아웃되고, 계정에 저장된 기록은 남아 있어요."}
          </p>
          <div className="row gap">
            <button className="btn btn-ghost grow" onClick={() => setAskReset(false)}>
              취소
            </button>
            <button
              className="btn btn-red grow"
              onClick={async () => {
                // 계정 기록은 지우지 않는다. 로그아웃한 뒤 이 폰만 처음 상태로 돌린다
                if (sync.user) await logout();
                await resetApp();
                handoff.parentOk = false;
                go("/start", { replace: true });
              }}
              data-testid="reset-ok"
            >
              되돌리기
            </button>
          </div>
        </Modal>
      )}

      <TabBar active="parent" />
    </section>
  );
}

// ---------- P3 인증 확인 ----------
function ProofMedia({ id, kind }: { id: string; kind: "video" | "photo" }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [info, setInfo] = useState("");
  const [broken, setBroken] = useState(false);
  const [tries, setTries] = useState(0);
  const sync = useSync();

  useEffect(() => {
    let alive = true;
    let made = "";
    setUrl(null);
    setMissing(false);
    setBroken(false);
    loadMedia(id)
      .then((blob) => {
        if (!alive) return;
        if (!blob) return setMissing(true);
        setInfo(`${blob.type || "형식 모름"}, ${Math.round(blob.size / 1024)}KB`);
        if (blob.size === 0) return setBroken(true);
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, tries]);

  if (missing)
    return (
      <div className="media-box empty media-missing" data-testid="proof-missing">
        <b>이 폰에는 사진·영상이 없어요</b>
        <small>
          {sync.enabled && !sync.user
            ? "다른 폰에서 찍었다면 두 폰 모두 같은 계정으로 로그인하면 볼 수 있어요."
            : "다른 폰에서 찍었다면 그 폰이 인터넷에 연결되어 올리고 나면 보여요."}
        </small>
        <button className="btn btn-ghost btn-sm" onClick={() => setTries((t) => t + 1)} data-testid="proof-retry">
          다시 불러오기
        </button>
      </div>
    );
  if (broken)
    return (
      <div className="media-box empty" data-testid="proof-broken">
        이 브라우저에서 재생할 수 없는 영상이에요 ({info})
      </div>
    );
  if (!url) return <div className="media-box empty">불러오는 중...</div>;
  return kind === "video" ? (
    <video
      className="media-box"
      src={url}
      controls
      autoPlay
      muted
      loop
      playsInline
      onError={() => setBroken(true)}
      onLoadedMetadata={(e) => {
        // 브라우저 녹화(webm)는 길이 정보가 없어 재생 막대가 멈춘다. 끝까지 한 번 찾아가 길이를 알아낸 뒤 처음으로 돌린다
        const v = e.currentTarget;
        if (v.duration !== Infinity) return;
        v.currentTime = 1e101;
        v.addEventListener("durationchange", () => (v.currentTime = 0), { once: true });
      }}
      data-testid="proof-media"
    />
  ) : (
    <img className="media-box" src={url} alt="인증 사진" data-testid="proof-media" />
  );
}

export function Review() {
  const state = useAppState();
  const queue = pendingProofs(state);
  const [total] = useState(queue.length);
  const [askFail, setAskFail] = useState(false);
  const proof = queue[0];

  useEffect(() => {
    if (!proof) go("/parent", { replace: true });
  }, [proof]);

  if (!proof) return null;
  const index = total - queue.length + 1;

  function decide(verdict: "ok" | "fail") {
    sfx.tap();
    setAskFail(false);
    update((s) => reviewProof(s, proof.id, verdict));
  }

  return (
    <section className="screen parent" data-testid="screen-review">
      <TopBar title="인증 확인" onBack={() => go("/parent")} tone="parent" right={<span className="count" data-testid="review-count">{index}/{Math.max(total, index)}</span>} />
      <div className="scroll-body parent-body">
        <div className="row between review-meta">
          <b data-testid="review-mission">
            {missionDef(proof.missionId).icon} {proof.missionName}
          </b>
          <span className="muted">
            {proof.stage}단계 · {timeText(proof.at)}
          </span>
        </div>
        <ProofMedia id={proof.id} kind={proof.kind} />
        <div className="row gap">
          <button className="btn btn-outline-red btn-lg grow" onClick={() => setAskFail(true)} data-testid="fail">
            실패
          </button>
          <button className="btn btn-purple btn-lg grow" onClick={() => decide("ok")} data-testid="ok">
            성공
          </button>
        </div>
        <p className="hint center">실패하면 캐릭터가 한 단계 내려가고 코인 10이 빠져요</p>
      </div>
      {askFail && (
        <Modal onClose={() => setAskFail(false)} testId="fail-confirm">
          <h2>정말 실패로 할까요?</h2>
          <p className="muted">아이 화면에 "다시 해보자"가 나오고, 같은 미션을 다시 할 수 있어요.</p>
          <div className="row gap">
            <button className="btn btn-ghost grow" onClick={() => setAskFail(false)}>
              취소
            </button>
            <button className="btn btn-red grow" onClick={() => decide("fail")} data-testid="fail-ok">
              실패로 하기
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

// ---------- P4 구매한 선물 ----------
export function BoughtGifts() {
  const state = useAppState();
  const list = openPurchases(state);
  return (
    <section className="screen parent" data-testid="screen-bought">
      <TopBar title="구매한 선물" onBack={() => go("/parent")} tone="parent" />
      <div className="scroll-body parent-body">
        {list.length === 0 && <p className="empty-card">구매한 선물이 없어요</p>}
        {list.map((p) => (
          <div key={p.id} className="task-card has" data-testid={`bought-${p.id}`}>
            <span className="task-emoji">{p.icon}</span>
            <div className="grow">
              <b>{p.name}</b>
              <small>
                {nick(state.childName)}가 {timeText(p.at)}에 샀어요 · {p.price}코인
              </small>
            </div>
            <button className="btn btn-purple btn-sm" onClick={() => update((s) => giveGift(s, p.id))} data-testid="give">
              줬어요
            </button>
          </div>
        ))}
        <p className="hint">줬어요를 누르면 목록에서 사라져요</p>
      </div>
    </section>
  );
}

// ---------- P5 미션 관리 ----------
export function MissionManage() {
  const state = useAppState();
  const [list, setList] = useState<MissionSetting[]>(state.missions);
  const [picker, setPicker] = useState<{ replace: MissionId | null } | null>(null);
  const [saved, setSaved] = useState(false);

  function choose(id: MissionId) {
    setList((l) => {
      if (picker?.replace) return l.map((m) => (m.id === picker.replace ? { id, seconds: m.seconds } : m));
      return [...l, { id, seconds: 15 }];
    });
    setPicker(null);
    setSaved(false);
  }

  function save() {
    if (update((s) => saveMissions(s, list))) sfx.coin();
    setSaved(true);
  }

  const unused = MISSIONS.filter((m) => !list.some((x) => x.id === m.id));

  return (
    <section className="screen parent" data-testid="screen-missions">
      <TopBar title="미션 관리" onBack={() => go("/parent")} tone="parent" />
      <div className="scroll-body parent-body">
        {list.map((m) => {
          const def = missionDef(m.id);
          return (
            <div key={m.id} className="manage-card" data-testid={`manage-${m.id}`}>
              <div className="row between">
                <b>
                  <span className="pick-icon">{def.icon}</span> {def.name}
                </b>
                <span className={`badge ${def.kind}`}>{def.kind === "video" ? "영상" : "사진"}</span>
              </div>
              {def.kind === "video" && (
                <SecondsStepper
                  value={m.seconds}
                  testId={`seconds-${m.id}`}
                  onChange={(n) => {
                    setSaved(false);
                    setList((l) => l.map((x) => (x.id === m.id ? { ...x, seconds: n } : x)));
                  }}
                />
              )}
              <div className="row gap">
                <button className="btn btn-outline-p btn-sm" onClick={() => setPicker({ replace: m.id })} disabled={unused.length === 0} data-testid="swap">
                  미션 바꾸기
                </button>
                {state.subscribed && (
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={list.length <= 1}
                    onClick={() => {
                      setSaved(false);
                      setList((l) => l.filter((x) => x.id !== m.id));
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {state.subscribed ? (
          <button className="menu-wide" onClick={() => setPicker({ replace: null })} disabled={unused.length === 0} data-testid="add-mission">
            <span>＋</span>
            <b>미션 추가하기</b>
            <small>한 단계에 미션이 늘어나요</small>
          </button>
        ) : (
          <button
            className="menu-wide locked"
            onClick={() => {
              handoff.subscribeBack = "/parent/missions";
              go("/subscribe");
            }}
            data-testid="more-missions"
          >
            <Icon name="lock" size={18} />
            <b>미션 더 추가하기</b>
            <small>구독하면 할 수 있어요</small>
          </button>
        )}
        <p className="hint">바꾼 미션은 지금 단계의 미션 목록에 바로 반영돼요. 이미 한 인증은 그대로 남아요.</p>
      </div>
      <div className="bottom-cta parent-cta">
        <button className="btn btn-purple btn-lg" onClick={save} data-testid="save-missions">
          {saved ? "저장했어요" : "저장"}
        </button>
      </div>
      {picker && (
        <Modal onClose={() => setPicker(null)} testId="mission-picker">
          <h2>{picker.replace ? "어떤 미션으로 바꿀까요?" : "추가할 미션을 골라요"}</h2>
          <div className="picker-list">
            {unused.map((m) => (
              <button key={m.id} className="pick-row" onClick={() => choose(m.id)} data-testid={`picker-${m.id}`}>
                <span className="pick-icon">{m.icon}</span>
                <span className="pick-name">{m.name}</span>
                <span className={`badge ${m.kind}`}>{m.kind === "video" ? "영상" : "사진"}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}

// ---------- P6 선물 관리 ----------
export function GiftManage() {
  const state = useAppState();
  const [rows, setRows] = useState(state.gifts.map((g) => ({ id: g.id, icon: g.icon, name: g.name, price: String(g.price) })));
  const [msg, setMsg] = useState("");

  function save() {
    const data = rows.map((r) => ({ id: r.id, name: r.name, price: Number(r.price) }));
    if (!data.every(giftIsValid)) {
      setMsg("이름을 쓰고, 가격은 10 이상의 숫자로 적어 주세요");
      return;
    }
    update((s) => saveGifts(s, data));
    sfx.coin();
    setMsg("저장했어요");
  }

  return (
    <section className="screen parent" data-testid="screen-gift-edit">
      <TopBar title="선물 관리" onBack={() => go("/parent")} tone="parent" />
      <div className="scroll-body parent-body">
        {rows.map((r, i) => {
          const bad = !giftIsValid({ name: r.name, price: Number(r.price) });
          return (
            <div key={r.id} className={`manage-card gift-edit ${bad ? "bad" : ""}`}>
              <span className="task-emoji">{r.icon}</span>
              <div className="grow">
                <label>
                  이름
                  <input
                    className="field"
                    value={r.name}
                    maxLength={16}
                    onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))}
                    data-testid={`gift-name-${i}`}
                  />
                </label>
                <label>
                  가격
                  <span className="price-input">
                    <input
                      className="field"
                      inputMode="numeric"
                      value={r.price}
                      onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, price: e.target.value.replace(/[^0-9]/g, "") } : y)))}
                      data-testid={`gift-price-${i}`}
                    />
                    코인
                  </span>
                </label>
              </div>
            </div>
          );
        })}
        <p className={msg === "저장했어요" ? "hint ok" : "error"} data-testid="gift-msg">
          {msg}
        </p>
      </div>
      <div className="bottom-cta parent-cta">
        <button className="btn btn-purple btn-lg" onClick={save} data-testid="save-gifts">
          저장
        </button>
      </div>
    </section>
  );
}

// ---------- P7 구독 안내 (가짜 결제) ----------
export function Subscribe() {
  const state = useAppState();
  const [step, setStep] = useState<"info" | "pay" | "done">(state.subscribed ? "done" : "info");
  const back = () => go(handoff.subscribeBack || "/parent");

  return (
    <section className="screen parent" data-testid="screen-subscribe">
      <TopBar title="구독 안내" onBack={back} tone="parent" />
      <div className="scroll-body parent-body sub-body">
        {step === "info" && (
          <>
            <div className="sub-hero">
              <Hero pose="cheer" size={130} motion="breathe" />
              <span className="sub-star">
                <Icon name="star" size={34} />
              </span>
            </div>
            <h2 className="sub-title">더 많은 모험을 떠나요!</h2>
            <ul className="benefits">
              <li>
                <Icon name="check" size={18} stroke={3} /> 미션 더 추가하기
              </li>
              <li>
                <Icon name="check" size={18} stroke={3} /> 21단계 이후 계속 가기
              </li>
            </ul>
            <p className="sub-price">
              월 <b>9,900</b>원
            </p>
            <button className="btn btn-purple btn-lg" onClick={() => setStep("pay")} data-testid="sub-start">
              구독하기
            </button>
            <p className="hint center">이번 버전은 시연용 화면이에요. 실제로 결제되지 않아요.</p>
          </>
        )}
        {step === "pay" && (
          <div className="fake-pay" data-testid="fake-pay">
            <p className="eyebrow-p">결제 (시연용)</p>
            <h2>빙하루 월 구독</h2>
            <div className="pay-card">
              <span>카드</span>
              <b>•••• •••• •••• 1234</b>
            </div>
            <div className="row between pay-line">
              <span>결제 금액</span>
              <b>월 9,900원</b>
            </div>
            <button
              className="btn btn-purple btn-lg"
              onClick={() => {
                update(subscribe);
                sfx.clear();
                setStep("done");
              }}
              data-testid="pay"
            >
              결제하기
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => setStep("info")}>
              취소
            </button>
          </div>
        )}
        {step === "done" && (
          <div className="sub-done" data-testid="sub-done">
            <Hero pose="thumbs" size={130} motion="jump" />
            <h2 className="sub-title">구독이 시작됐어요</h2>
            <p className="muted">이제 미션을 더 추가하고 21단계 이후에도 계속 갈 수 있어요.</p>
            <button className="btn btn-purple btn-lg" onClick={back} data-testid="sub-back">
              돌아가기
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
