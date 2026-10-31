// 카메라 감싸기 (ADR-002). 화질을 낮춰 용량을 줄인다 (N-02).

export type CameraError = "denied" | "unavailable";

/** 카메라를 연다. 방금 다른 화면이 카메라를 놓은 직후처럼 잠깐 못 여는 경우가 있어 한 번 더 시도한다 */
export async function openCamera(): Promise<MediaStream> {
  try {
    return await openOnce();
  } catch (error) {
    if (error === "denied") throw error;
    await new Promise((r) => setTimeout(r, 600));
    return openOnce();
  }
}

async function openOnce(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw "unavailable" satisfies CameraError;
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 }, frameRate: { ideal: 15, max: 24 } }
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

/** mp4(H.264)를 먼저 고른다. 아이폰 Safari와 최신 Chrome이 녹화할 수 있고, 거의 모든 브라우저가 재생한다.
 *  webm은 Safari에서 녹화는 돼도 재생이 불안정해 뒤로 둔다 */
function pickMime(): string {
  const options = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp8", "video/webm"];
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
