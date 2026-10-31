// 효과음 감싸기 (F-03, N-04). 음원 파일 없이 Web Audio로 만든다. 첫 터치(O1) 전에는 소리가 나지 않는다.

let ctx: AudioContext | null = null;

/** O1 "시작"을 누를 때 부른다. 브라우저가 소리를 허용한다 */
export function unlockSound(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

type Note = [freq: number, at: number, dur: number, type?: OscillatorType, gain?: number];

function play(notes: Note[]): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.01;
  for (const [freq, at, dur, type = "triangle", gain = 0.16] of notes) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0 + at);
    g.gain.setValueAtTime(0, t0 + at);
    g.gain.linearRampToValueAtTime(gain, t0 + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + dur + 0.02);
  }
}

export const sfx = {
  tap: () => play([[660, 0, 0.08, "sine", 0.1]]),
  clear: () => play([[523, 0, 0.18], [659, 0.1, 0.18], [784, 0.2, 0.22], [1047, 0.32, 0.4]]),
  coin: () => play([[988, 0, 0.09, "square", 0.07], [1319, 0.08, 0.28, "square", 0.07]]),
  climb: () => play([[392, 0, 0.12], [494, 0.12, 0.12], [587, 0.24, 0.12], [784, 0.36, 0.3]]),
  soft: () => play([[440, 0, 0.2, "sine", 0.12], [392, 0.18, 0.3, "sine", 0.12]]),
  shutter: () => play([[1800, 0, 0.04, "square", 0.05], [900, 0.04, 0.06, "square", 0.04]]),
  wrong: () => play([[220, 0, 0.12, "sawtooth", 0.06], [196, 0.12, 0.16, "sawtooth", 0.06]])
};
