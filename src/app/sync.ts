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

  onAuthChange((user) => {
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
  const [local, remote] = await Promise.all([listMediaKeys(), listMedia(userId)]);
  for (const id of local) {
    if (remote.has(id)) continue;
    const blob = await getMedia(id);
    if (blob) await uploadMedia(userId, id, blob);
  }
}

/** 인증 사진·영상을 폰에 저장하고, 로그인했으면 서버에도 올린다 */
export async function saveMedia(id: string, blob: Blob): Promise<void> {
  await putMedia(id, blob);
  const user = view.user;
  if (user) void uploadMedia(user.id, id, blob).catch(() => set({ status: "error" }));
}

/** 폰에 없으면 서버에서 받아 폰에 넣어 둔다 (다른 기기에서 찍은 것) */
export async function loadMedia(id: string): Promise<Blob | undefined> {
  const local = await getMedia(id);
  if (local || !view.user) return local;
  const remote = await downloadMedia(view.user.id, id);
  if (remote) await putMedia(id, remote);
  return remote;
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
