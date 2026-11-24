export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || typeof envUrl !== "string") return "/api";

  let clean = envUrl.trim();
  // Fix accidental double paste like: https://abc.onrender.comhttps://abc.onrender.com
  const match = clean.match(/^https?:\/\/[^\s"'<>]+/i);
  if (match) {
    clean = match[0];
    const secondHttp = clean.indexOf("http", 8);
    if (secondHttp !== -1) {
      clean = clean.substring(0, secondHttp);
    }
  }
  clean = clean.replace(/\/+$/, "");
  return clean.endsWith("/api") ? clean : `${clean}/api`;
}

const API_BASE = getApiBase();

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  return data as T;
}
