// 카메라 감싸기 (ADR-002). 화질을 낮춰 용량을 줄인다 (N-02).

export type CameraError = "denied" | "unavailable";

/** 앞(셀카) 카메라와 뒤 카메라 */
export type Facing = "user" | "environment";

/** 카메라를 연다. 방금 다른 화면이 카메라를 놓은 직후처럼 잠깐 못 여는 경우가 있어 한 번 더 시도한다 */
export async function openCamera(facing: Facing = "user"): Promise<MediaStream> {
  try {
    return await openOnce(facing);
  } catch (error) {
    if (error === "denied") throw error;
    await new Promise((r) => setTimeout(r, 600));
    return openOnce(facing);
  }
}

/** 카메라가 몇 개인지. 브라우저는 카메라 권한을 받은 뒤에야 정확히 알려 주므로 카메라를 연 다음에 부른다 */
export async function countCameras(): Promise<number> {
  try {
    const devices = (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];
    return devices.filter((d) => d.kind === "videoinput").length;
  } catch {
    return 0;
  }
}

async function openOnce(facing: Facing): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw "unavailable" satisfies CameraError;
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 480 }, height: { ideal: 640 }, frameRate: { ideal: 15, max: 24 } }
    });
  } catch (error) {
    const name = (error as DOMException)?.name;
    throw (name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable") satisfies CameraError;
  }
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

export function takePhoto(video: HTMLVideoElement): Promise<Blob> {
  const w = video.videoWidth || 480;
  const h = video.videoHeight || 640;
  const scale = Math.min(1, 640 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("photo"))), "image/jpeg", 0.7));
}

/** 아이폰·아이패드(모든 브라우저가 Safari 엔진)와 Mac Safari */
function isAppleWebKit(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios || (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|Android/.test(ua));
}

/** 녹화 형식. Safari는 mp4가 기본이고 webm은 녹화돼도 재생이 불안정해 mp4를 먼저 쓴다.
 *  Chrome·Edge·Firefox는 webm이 안정적이다. Chrome의 mp4 녹화는 가끔 빈 파일을 만든다 (2026-11-01 시험) */
function pickMime(): string {
  const webm = ["video/webm;codecs=vp8", "video/webm"];
  const mp4 = ["video/mp4;codecs=avc1", "video/mp4"];
  const options = isAppleWebKit() ? [...mp4, ...webm] : [...webm, ...mp4];
  return options.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

/** 정해진 길이만큼 녹화하고 자동으로 멈춘다. stop()으로 중간에 버릴 수 있다 */
export function recordVideo(stream: MediaStream, seconds: number): { done: Promise<Blob>; cancel: () => void } {
  const mimeType = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined, videoBitsPerSecond: 300_000 });
  const chunks: Blob[] = [];
  let cancelled = false;
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      if (cancelled) return reject(new Error("cancelled"));
      const blob = new Blob(chunks, { type: (recorder.mimeType || mimeType || "video/webm").split(";")[0] });
      // 카메라가 중간에 끊기면 빈 파일이 나온다. 그대로 제출하면 부모 확인에서 검은 화면만 보인다
      if (blob.size === 0) return reject(new Error("empty"));
      resolve(blob);
    };
  });
  recorder.start(500);
  const timer = window.setTimeout(() => recorder.state !== "inactive" && recorder.stop(), seconds * 1000);
  return {
    done,
    cancel: () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (recorder.state !== "inactive") recorder.stop();
    }
  };
}
