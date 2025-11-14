export const API_BASE = process.env.EXPO_BACKEND_URL || "";

function buildUrl(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  // Always hit the preview domain directly to work on native too
  return `${API_BASE}${path}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path));
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body?: any, init?: RequestInit): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    ...(init || {}),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
