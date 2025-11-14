const BASE = process.env.EXPO_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || "";
export const API_BASE = BASE.endsWith("/") ? BASE.slice(0, -1) : BASE;

function buildUrl(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${API_BASE}${path}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path));
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiPost<T = any>(path: string, body?: any, init?: RequestInit): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    ...(init || {}),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// Social graph
export async function followUser(followerId: string, followingId: string) {
  return apiPost("/api/follows", { follower_id: followerId, following_id: followingId, action: "follow" });
}
export async function unfollowUser(followerId: string, followingId: string) {
  return apiPost("/api/follows", { follower_id: followerId, following_id: followingId, action: "unfollow" });
}
export async function getFollowStatus(followerId: string, followingId: string) {
  return apiGet<{ following: boolean }>(`/api/follows/status?follower_id=${encodeURIComponent(followerId)}&following_id=${encodeURIComponent(followingId)}`);
}

// Presence
export async function presenceWatch(userId: string, eventId: string) {
  return apiPost("/api/presence/watch", { user_id: userId, event_id: eventId });
}
export async function presenceLeave(userId: string, eventId: string) {
  return apiPost("/api/presence/leave", { user_id: userId, event_id: eventId });
}
export async function getEventPresence(eventId: string, userId?: string) {
  const q = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  return apiGet<{ watching_now: number; friends_watching: number; friend_ids: string[] }>(`/api/events/${eventId}/presence${q}`);
}
