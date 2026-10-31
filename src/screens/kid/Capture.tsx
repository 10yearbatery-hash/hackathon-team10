// C3 미션 촬영 (O8 첫 미션도 같은 화면). 위에 펭귄 영상, 아래에 카메라 (ADR-005)
import { useCallback, useEffect, useRef, useState } from "react";
import { missionDef, type MissionId } from "../../core/model";
import { completeOnboarding, submitProof } from "../../core/rules";
import { go } from "../../app/router";
import { commit, getState, handoff, makeId } from "../../app/store";
import { openCamera, recordVideo, stopCamera, takePhoto, type CameraError } from "../../platform/camera";
import { sfx } from "../../platform/sound";
import { putMedia } from "../../platform/storage";
import { Icon } from "../../ui/icons";

type Phase = "ready" | "recording" | "review" | "saving";

export default function Capture({ missionId, first = false }: { missionId: MissionId; first?: boolean }) {
  const def = missionDef(missionId);
  const setting = getState().missions.find((m) => m.id === missionId);
  const seconds = setting?.seconds ?? 15;
  const camRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<{ cancel: () => void } | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [left, setLeft] = useState(seconds);
  const [attempt, setAttempt] = useState(0);
  const [camReady, setCamReady] = useState(false);

  useEffect(() => {
    if (!setting) go("/home", { replace: true });
  }, [setting]);

  // 카메라 켜기
  useEffect(() => {
    let alive = true;
    setError(null);
    setCamReady(false);
    openCamera()
      .then((stream) => {
        if (!alive) return stopCamera(stream);
        streamRef.current = stream;
        if (camRef.current) {
          camRef.current.srcObject = stream;
          void camRef.current.play().catch(() => undefined);
        }
        setCamReady(true);
      })
      .catch((e: CameraError) => alive && setError(e));
    return () => {
      alive = false;
      recRef.current?.cancel();
      stopCamera(streamRef.current);
      streamRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (!blob) return setPreviewUrl("");
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  // 남은 시간 표시
  useEffect(() => {
    if (phase !== "recording") return;
    const startedAt = Date.now();
    const t = window.setInterval(() => setLeft(Math.max(0, seconds - (Date.now() - startedAt) / 1000)), 100);
    return () => window.clearInterval(t);
  }, [phase, seconds]);

  const start = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    sfx.tap();
    if (def.kind === "photo") {
      sfx.shutter();
      void takePhoto(camRef.current!).then((b) => {
        setBlob(b);
        setPhase("review");
      });
      return;
    }
    setLeft(seconds);
    setPhase("recording");
    const rec = recordVideo(stream, seconds);
    recRef.current = rec;
    rec.done
      .then((b) => {
        recRef.current = null;
        sfx.coin();
        setBlob(b);
        setPhase("review");
      })
      .catch(() => undefined);
  }, [def.kind, seconds]);

  function retake() {
    sfx.tap();
    setBlob(null);
    setLeft(seconds);
    setPhase("ready");
  }

  async function submit() {
    if (!blob || phase !== "review") return;
    setPhase("saving");
    const id = makeId("proof");
    try {
      await putMedia(id, blob);
    } catch {
      // 저장 공간이 모자라도 아이의 진행은 막지 않는다. 부모 확인 화면에서 "영상을 불러올 수 없어요"로 보인다
    }
    const before = getState();
    const result = submitProof(before, { id, missionId, now: Date.now(), practice: first });
    if (!result.proof) {
      go("/home", { replace: true });
      return;
    }
    commit(first ? completeOnboarding(result.state) : result.state);
    handoff.lastSubmit = { proofId: id, climbed: result.climbed, from: before.stage, first };
    go(`/clear/${id}`, { replace: true });
  }

  const recording = phase === "recording";
  const progress = def.kind === "video" ? 1 - left / seconds : 0;

  return (
    <section className="screen v3 capture-v3" data-testid="screen-capture">
      <header className="capture-head">
        <button className="back-link" onClick={() => go(first ? "/setup/mission" : "/home")} data-testid="back">
          ‹ 이전
        </button>
        <h1 className="v3-title">{def.kind === "photo" && phase !== "review" ? "사진으로 기록해요" : def.name}</h1>
        <p className="v3-sub capture-status">
          {def.kind === "video" ? (recording ? <span className="rec-on">● 녹화 중 · </span> : phase === "review" ? "영상을 다 찍었어! · " : `${def.icon} 영상 · `) : `${def.icon} ${def.name} · `}
          <span data-testid="timer">{def.kind === "video" ? `00:${String(Math.ceil(recording ? seconds - left : phase === "ready" ? 0 : seconds)).padStart(2, "0")} / 00:${String(seconds).padStart(2, "0")}` : ""}</span>
          {def.kind === "photo" && (phase === "review" ? "사진을 확인해 줘" : "처음에는 부모님과 같이 해봐도 좋아요.")}
        </p>
      </header>
      {first && <p className="together" data-testid="together">엄마 아빠랑 같이 해봐요!</p>}

      <div className="cam-panel" data-testid="cam-panel">
        <div className="watch-panel">
          {/* 말풍선은 펭귄 얼굴을 가리지 않게 영상 칸 위에 둔다 */}
          <span className="watch-say">{recording ? "보고 있어!" : def.kind === "video" ? "화면은 잠깐 내려놓고 해봐!" : "미션을 마친 모습을 찍어 줘."}</span>
          <div className="watch-stage">
            <video src="./media/hero_look.mp4" muted autoPlay loop playsInline aria-label="펭귄이 지켜보고 있어요" />
          </div>
        </div>
        {error ? (
          <div className="cam-error" data-testid="cam-error">
            <Icon name="camera" size={40} />
            <b>{error === "denied" ? "카메라를 쓸 수 없어요" : "카메라를 찾을 수 없어요"}</b>
            <p>{error === "denied" ? "브라우저 설정에서 카메라를 허용한 뒤 다시 눌러 주세요" : "카메라가 있는 폰에서 열어 주세요"}</p>
            <button className="btn btn-white btn-sm" onClick={() => setAttempt((n) => n + 1)}>
              다시 시도
            </button>
          </div>
        ) : (
          <>
            <video ref={camRef} className={`cam ${phase === "review" ? "hidden" : ""}`} muted playsInline data-testid="camera" />
            {phase === "review" && previewUrl && def.kind === "photo" && <img className="cam" src={previewUrl} alt="찍은 사진" data-testid="preview" />}
            {phase === "review" && previewUrl && def.kind === "video" && <video className="cam" src={previewUrl} autoPlay loop muted playsInline data-testid="preview" />}
            {recording && (
              <span className="rec-dot" data-testid="rec">
                ● 녹화 중
              </span>
            )}
          </>
        )}
      </div>

      {def.kind === "video" && (
        <p className="rec-left">{recording ? `${Math.ceil(left)}초 남았어요` : phase === "ready" ? `${seconds}초 동안 찍어요` : "다 찍었어요!"}</p>
      )}
      {def.kind === "video" && (
        <div className="rec-bar" aria-label="남은 시간">
          <i style={{ width: `${(phase === "review" || phase === "saving" ? 1 : progress) * 100}%` }} />
        </div>
      )}

      <div className="capture-actions">
        {phase === "ready" || recording ? (
          <button className="btn btn-red btn-lg" onClick={start} disabled={recording || !!error || !camReady} data-testid="shoot">
            {!camReady && !error ? "카메라 켜는 중" : def.kind === "video" ? (recording ? "찍는 중..." : "● 시작") : "● 찍기"}
          </button>
        ) : (
          <button className="btn btn-white btn-lg" onClick={retake} disabled={phase === "saving"} data-testid="retake">
            <Icon name="refresh" size={20} /> 다시 찍기
          </button>
        )}
        <button className="btn btn-blue btn-lg" onClick={submit} disabled={phase !== "review"} data-testid="submit">
          <Icon name="check" size={22} stroke={3} /> 제출하기
        </button>
      </div>
    </section>
  );
}
