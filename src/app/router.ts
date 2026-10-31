// 해시 주소(#/home 등)로 화면을 고른다. 정적 호스팅에서 새로고침해도 같은 화면이 나온다.
import { useSyncExternalStore } from "react";

function current(): string {
  const path = window.location.hash.replace(/^#/, "");
  return path || "/";
}

export function useRoute(): string {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener("hashchange", l);
      return () => window.removeEventListener("hashchange", l);
    },
    current
  );
}

export function go(path: string, options: { replace?: boolean } = {}): void {
  if (options.replace) {
    window.location.replace(`#${path}`);
  } else {
    window.location.hash = path;
  }
}

/** "/capture/:id" 같은 모양과 맞으면 값을 돌려준다 */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/");
  const b = path.split("/");
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
