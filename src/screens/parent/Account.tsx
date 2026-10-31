// P8 계정 (ADR-017). 부모가 이메일과 비밀번호로 로그인하면 진행 기록과 인증 사진·영상을 서버에 저장한다.
// 로그인은 선택이다. 하지 않아도 앱은 폰 안 저장만으로 그대로 동작한다.
import { useState } from "react";
import { go } from "../../app/router";
import { join, login, logout, pushNow, useSync, type SyncView } from "../../app/sync";
import { sfx } from "../../platform/sound";
import { TopBar } from "../../ui/parts";

function statusText(v: SyncView): string {
  if (v.status === "syncing") return "저장하는 중...";
  if (v.status === "error") return "저장하지 못했어요. 인터넷 연결을 확인해 주세요";
  if (v.status === "saved" && v.savedAt) {
    const d = new Date(v.savedAt);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}에 저장했어요`;
  }
  return "저장할 준비가 됐어요";
}

export default function Account() {
  const sync = useSync();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(kind: "login" | "join") {
    if (busy) return;
    if (!email.includes("@")) return setMsg({ ok: false, text: "이메일 주소를 확인해 주세요" });
    if (password.length < 6) return setMsg({ ok: false, text: "비밀번호는 6자 이상으로 해 주세요" });
    setBusy(true);
    setMsg(null);
    const r = kind === "login" ? await login(email, password) : await join(email, password);
    setBusy(false);
    if (!r.ok) {
      sfx.soft();
      return setMsg({ ok: false, text: r.error });
    }
    sfx.tap();
    setPassword("");
    if (r.needsConfirm) setMsg({ ok: true, text: "가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요" });
  }

  return (
    <section className="screen parent" data-testid="screen-account">
      <TopBar title="계정과 기록 저장" onBack={() => go("/parent")} tone="parent" />
      <div className="scroll-body parent-body">
        {!sync.enabled && (
          <div className="manage-card">
            <div className="grow">
              <b>서버가 연결되지 않았어요</b>
              <p className="muted">지금은 이 폰 안에만 저장돼요.</p>
            </div>
          </div>
        )}

        {sync.enabled && sync.user && (
          <>
            <div className="manage-card account-card" data-testid="account-in">
              <div className="grow">
                <small className="muted">로그인한 계정</small>
                <b data-testid="account-email">{sync.user.email}</b>
                <p className={sync.status === "error" ? "error" : "hint ok"} data-testid="sync-status">
                  {statusText(sync)}
                </p>
              </div>
            </div>
            <p className="muted account-note">단계, 코인, 미션, 선물, 인증 사진·영상이 이 계정에 저장돼요. 다른 폰에서 같은 계정으로 로그인하면 이어서 할 수 있어요.</p>
            <div className="account-actions">
              <button className="btn btn-purple btn-lg" onClick={() => void pushNow()} disabled={sync.status === "syncing"} data-testid="sync-now">
                지금 저장하기
              </button>
              <button className="btn btn-ghost btn-lg" onClick={() => void logout()} data-testid="logout">
                로그아웃
              </button>
            </div>
          </>
        )}

        {sync.enabled && !sync.user && (
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run("login");
            }}
          >
            <p className="muted account-note">로그인하면 기록이 서버에 저장돼서 폰을 바꿔도 이어서 할 수 있어요. 이미 기록이 있는 계정이면 그 기록을 불러와요.</p>
            <label className="account-label">
              이메일
              <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="account-email-input" />
            </label>
            <label className="account-label">
              비밀번호 (6자 이상)
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="account-password-input"
              />
            </label>
            {msg && (
              <p className={msg.ok ? "hint ok" : "error"} data-testid="account-msg">
                {msg.text}
              </p>
            )}
            <div className="account-actions">
              <button type="submit" className="btn btn-purple btn-lg" disabled={busy} data-testid="login">
                {busy ? "잠시만요..." : "로그인"}
              </button>
              <button type="button" className="btn btn-ghost btn-lg" disabled={busy} onClick={() => void run("join")} data-testid="join">
                처음이에요, 가입하기
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
