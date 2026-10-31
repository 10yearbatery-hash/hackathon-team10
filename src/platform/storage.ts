// 저장소 감싸기 (ADR-002, ADR-003). 상태 JSON은 localStorage, 인증 사진·영상은 IndexedDB에 둔다.
// 로그인하면 같은 내용을 서버에도 올린다 (ADR-017, app/sync.ts). 폰 안 저장이 항상 먼저다.
import { emptyState, type AppState } from "../core/model";

const STATE_KEY = "penguin-adventure/v1";
const SYNC_KEY = "penguin-adventure/sync";
const DB_NAME = "penguin-adventure";
const STORE = "media";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as AppState;
    return parsed && parsed.version === 1 ? parsed : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function putMedia(id: string, blob: Blob): Promise<IDBValidKey> {
  return withStore("readwrite", (s) => s.put(blob, id));
}

export function getMedia(id: string): Promise<Blob | undefined> {
  return withStore<Blob | undefined>("readonly", (s) => s.get(id));
}

/** 폰 안에 있는 사진·영상 이름들 */
export function listMediaKeys(): Promise<string[]> {
  return withStore<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).then((keys) => keys.map(String));
}

/** 서버 동기화 기록. 어느 계정에 맞춰져 있고, 마지막으로 올린 뒤 폰에서 바뀐 게 있는지 */
export type SyncMeta = { userId: string | null; dirty: boolean };

export function loadSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    return raw ? (JSON.parse(raw) as SyncMeta) : { userId: null, dirty: false };
  } catch {
    return { userId: null, dirty: false };
  }
}

export function saveSyncMeta(meta: SyncMeta): void {
  localStorage.setItem(SYNC_KEY, JSON.stringify(meta));
}

/** 시연 직전에 처음 상태로 되돌린다 (PRD 9장) */
export async function resetAll(): Promise<void> {
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(SYNC_KEY);
  await withStore("readwrite", (s) => s.clear());
}
