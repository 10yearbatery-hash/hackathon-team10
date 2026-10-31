// 폰 안 저장과 서버(Supabase)를 맞춘다 (ADR-017). 폰 안 저장이 항상 먼저이고, 로그인했을 때만 서버에 올린다.
// - 로그인하면: 계정에 기록이 있으면 그 기록을 불러오고, 없으면 이 폰의 기록을 올린다.
//   단, 같은 계정으로 이 폰에서 바꾼 뒤 아직 못 올린 게 있으면 이 폰 기록을 올린다.
// - 상태가 바뀔 때마다 잠깐 기다렸다 올린다. 사진·영상은 찍을 때 올리고, 못 올린 건 다음 로그인 때 올린다.
import { useSyncExternalStore } from "react";
import {
  cloudEnabled,
  downloadMedia,
  listMedia,
  onAuthChange,
  pullState,
  pushState,
  signIn,
  signOut,
  signUp,
  uploadMedia,
  type AuthResult,
  type CloudUser
} from "../platform/cloud";
import { getMedia, listMediaKeys, loadSyncMeta, putMedia, saveSyncMeta } from "../platform/storage";
import { getState, onCommit, replaceState } from "./store";

export type SyncStatus = "off" | "out" | "syncing" | "saved" | "error";
export type SyncView = { enabled: boolean; user: CloudUser | null; status: SyncStatus; savedAt: number | null };

let view: SyncView = { enabled: cloudEnabled, user: null, status: cloudEnabled ? "out" : "off", savedAt: null };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

/** 앱을 연 직후 저장된 로그인을 되살리는 동안 사진·영상 요청을 잠깐 기다리게 한다 */
let authKnown!: () => void;
const authReady = new Promise<void>((resolve) => (authKnown = resolve));
if (!cloudEnabled) authKnown();
setTimeout(() => authKnown(), 4000);

/** 이번에 찍은 사진·영상. 폰 저장이 실패해도 앱을 끄기 전까지는 부모 확인에서 보인다 */
const memo = new Map<string, Blob>();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 실패하면 조금 기다렸다 다시 한다 */
async function retry<T>(times: number, run: () => Promise<T>): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await run();
    } catch (e) {
      if (i >= times) throw e;
      await wait(700 * i);
    }
  }
}

function set(patch: Partial<SyncView>) {
  view = { ...view, ...patch };
  listeners.forEach((l) => l());
}

export function useSync(): SyncView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => view
  );
}

/** 앱을 열 때 한 번 부른다 */
export function startSync(): void {
  if (!cloudEnabled || started) return;
  started = true;

  onCommit(() => {
    saveSyncMeta({ ...loadSyncMeta(), dirty: true });
    if (!view.user) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void pushNow(), 800);
  });

  // 인터넷이 다시 연결되면 못 올린 사진·영상을 올린다
  window.addEventListener("online", () => {
    if (view.user) void uploadMissingMedia(view.user.id).catch(() => undefined);
  });

  onAuthChange((user) => {
    authKnown();
    if (user?.id === view.user?.id) return;
    set({ user, status: user ? "syncing" : "out", savedAt: null });
    if (user) void reconcile(user);
  });
}

async function reconcile(user: CloudUser) {
  try {
    const meta = loadSyncMeta();
    const remote = await pullState(user.id);
    if (remote && remote.state?.version === 1 && !(meta.userId === user.id && meta.dirty)) {
      replaceState(remote.state);
      saveSyncMeta({ userId: user.id, dirty: false });
      set({ status: "saved", savedAt: remote.updatedAt });
    } else {
      await pushNow();
    }
    await uploadMissingMedia(user.id);
  } catch {
    set({ status: "error" });
  }
}

/** 지금 상태를 서버에 올린다 */
export async function pushNow(): Promise<void> {
  const user = view.user;
  if (!user) return;
  set({ status: "syncing" });
  try {
    const savedAt = await pushState(user.id, getState());
    saveSyncMeta({ userId: user.id, dirty: false });
    set({ status: "saved", savedAt });
  } catch {
    set({ status: "error" });
  }
}

async function uploadMissingMedia(userId: string) {
  const [local, remote] = await Promise.all([listMediaKeys().catch(() => [] as string[]), listMedia(userId)]);
  const ids = new Set([...local, ...memo.keys()]);
  for (const id of ids) {
    if (remote.has(id)) continue;
    const blob = memo.get(id) ?? (await getMedia(id).catch(() => undefined));
    if (blob) await retry(3, () => uploadMedia(userId, id, blob));
  }
}

/** 폰 저장소를 읽다 실패해도 멈추지 않는다 */
const readLocal = (id: string) => getMedia(id).catch(() => undefined);

/**
 * 인증 사진·영상을 저장한다. 절대 실패로 끝나지 않는다.
 * 메모리에 먼저 두고, 폰 저장(두 번까지)과 서버 업로드(로그인했으면, 세 번까지)를 한다.
 */
export async function saveMedia(id: string, blob: Blob): Promise<void> {
  memo.set(id, blob);
  try {
    await retry(2, () => putMedia(id, blob));
  } catch {
    // 폰 저장 공간이 모자라거나 사생활 보호 모드면 메모리와 서버에만 남는다
  }
  const user = view.user;
  if (user) void retry(3, () => uploadMedia(user.id, id, blob)).catch(() => set({ status: "error" }));
}

/** 메모리 → 폰 → 서버(다른 기기에서 찍은 것) 순서로 찾는다. 서버에서 받은 건 폰에 넣어 둔다 */
export async function loadMedia(id: string): Promise<Blob | undefined> {
  const mem = memo.get(id);
  if (mem) return mem;
  const local = await readLocal(id);
  if (local) return local;
  await authReady;
  const user = view.user;
  if (!user) return undefined;
  // 다른 폰이 아직 올리는 중일 수 있어 몇 번 더 기다려 본다
  for (let i = 0; i < 4; i++) {
    const remote = await downloadMedia(user.id, id).catch(() => undefined);
    if (remote) {
      memo.set(id, remote);
      void putMedia(id, remote).catch(() => undefined);
      return remote;
    }
    await wait(1500);
  }
  return undefined;
}

export function login(email: string, password: string): Promise<AuthResult> {
  return signIn(email.trim(), password);
}

export function join(email: string, password: string): Promise<AuthResult> {
  return signUp(email.trim(), password);
}

/** 로그아웃. 못 올린 변경을 먼저 올리고, 폰 안 기록은 그대로 둔 채 서버에 올리기만 멈춘다 */
export async function logout(): Promise<void> {
  if (timer) clearTimeout(timer);
  if (loadSyncMeta().dirty) await pushNow();
  await signOut();
  saveSyncMeta({ userId: null, dirty: false });
}
