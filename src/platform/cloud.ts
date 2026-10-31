// Supabase 감싸기 (ADR-016). 부모 계정 로그인, 진행 상태 JSON, 인증 사진·영상을 서버에 둔다.
// 환경 변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 없으면 꺼지고, 앱은 폰 안 저장만으로 동작한다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppState } from "../core/model";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLE = "family_state";
const BUCKET = "proofs";

const client: SupabaseClient | null = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

/** 서버 연결 설정이 들어 있는지 */
export const cloudEnabled = client !== null;

export type CloudUser = { id: string; email: string };

/** 로그인 상태가 바뀔 때마다 알려 준다. 앱을 다시 열면 저장된 로그인으로 한 번 불린다 */
export function onAuthChange(cb: (user: CloudUser | null) => void): () => void {
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    cb(u ? { id: u.id, email: u.email ?? "" } : null);
  });
  return () => data.subscription.unsubscribe();
}

function koreanError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "이메일이나 비밀번호가 맞지 않아요";
  if (m.includes("already registered") || m.includes("already been registered")) return "이미 가입한 이메일이에요. 로그인해 주세요";
  if (m.includes("password") && m.includes("at least")) return "비밀번호는 6자 이상으로 해 주세요";
  if (m.includes("email not confirmed")) return "메일함에서 가입 확인 메일을 먼저 눌러 주세요";
  if (m.includes("valid email") || m.includes("invalid email")) return "이메일 주소를 확인해 주세요";
  if (m.includes("fetch") || m.includes("network")) return "인터넷 연결을 확인해 주세요";
  return "잠시 후 다시 시도해 주세요";
}

export type AuthResult = { ok: true; needsConfirm?: boolean } | { ok: false; error: string };

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!client) return { ok: false, error: "서버가 연결되지 않았어요" };
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) return { ok: false, error: koreanError(error.message) };
  // 이메일 확인을 켠 프로젝트는 세션 없이 돌아온다
  return { ok: true, needsConfirm: !data.session };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!client) return { ok: false, error: "서버가 연결되지 않았어요" };
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: koreanError(error.message) } : { ok: true };
}

export async function signOut(): Promise<void> {
  await client?.auth.signOut();
}

// ---------- 진행 상태 ----------

export type RemoteState = { state: AppState; updatedAt: number };

/** 이 계정에 저장된 진행 상태. 처음 로그인한 계정이면 null */
export async function pullState(userId: string): Promise<RemoteState | null> {
  if (!client) return null;
  const { data, error } = await client.from(TABLE).select("state, updated_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { state: data.state as AppState, updatedAt: Date.parse(data.updated_at as string) };
}

export async function pushState(userId: string, state: AppState): Promise<number> {
  if (!client) return 0;
  const updatedAt = new Date();
  const { error } = await client.from(TABLE).upsert({ user_id: userId, state, updated_at: updatedAt.toISOString() });
  if (error) throw error;
  return updatedAt.getTime();
}

// ---------- 인증 사진·영상 ----------

const path = (userId: string, id: string) => `${userId}/${id}`;

export async function uploadMedia(userId: string, id: string, blob: Blob): Promise<void> {
  if (!client) return;
  const { error } = await client.storage.from(BUCKET).upload(path(userId, id), blob, { upsert: true, contentType: blob.type || undefined });
  if (error) throw error;
}

export async function downloadMedia(userId: string, id: string): Promise<Blob | undefined> {
  if (!client) return undefined;
  const { data, error } = await client.storage.from(BUCKET).download(path(userId, id));
  return error ? undefined : data;
}

/** 서버에 이미 올라간 사진·영상 이름들 */
export async function listMedia(userId: string): Promise<Set<string>> {
  if (!client) return new Set();
  const names = new Set<string>();
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage.from(BUCKET).list(userId, { limit: 100, offset });
    if (error) throw error;
    data.forEach((f) => names.add(f.name));
    if (data.length < 100) return names;
  }
}
