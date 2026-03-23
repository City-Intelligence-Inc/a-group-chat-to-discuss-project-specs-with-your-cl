const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

// Auth token management — set by the chat page once Clerk is ready
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenProvider(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts?.headers as Record<string, string>),
  };

  // Attach Clerk JWT if available
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch {}
  }

  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Rooms ──────────────────────────────────────────────────────────────────
export async function listRooms() {
  const data = await apiFetch("/api/rooms/");
  const rooms = data.rooms || data || [];
  return rooms.map((r: Record<string, string>) => ({
    id: r.roomId || r.id,
    name: r.name,
    description: r.description,
    created_by: r.createdBy || r.created_by,
  }));
}

export async function getRoom(id: string) {
  const data = await apiFetch(`/api/rooms/${id}`);
  const r = data.room || data;
  return { id: r.roomId || r.id, name: r.name, description: r.description };
}

export async function createRoom(data: { name: string; description?: string; created_by: string }) {
  const res = await apiFetch("/api/rooms/", { method: "POST", body: JSON.stringify(data) });
  const r = res.room || res;
  return { id: r.roomId || r.id, name: r.name, description: r.description };
}

// ─── Members ────────────────────────────────────────────────────────────────
export async function listMembers(roomId: string) {
  const data = await apiFetch(`/api/members/${roomId}`);
  const members = data.members || data || [];
  return members.map((m: Record<string, string>) => ({
    user_id: m.userId || m.user_id,
    username: m.username || m.userId || m.user_id,
    avatar_url: m.avatarUrl || m.avatar_url,
    role: m.role,
    is_online: true,
  }));
}

export async function getUserRooms(userId: string) {
  return apiFetch(`/api/members/user/${userId}`);
}

export async function joinRoom(roomId: string, data: { user_id: string }) {
  return apiFetch(`/api/members/${roomId}/join`, { method: "POST", body: JSON.stringify(data) });
}

export async function leaveRoom(roomId: string, userId: string) {
  return apiFetch(`/api/members/${roomId}/leave/${userId}`, { method: "DELETE" });
}

// ─── Messages ───────────────────────────────────────────────────────────────
export async function listMessages(roomId: string, limit = 50, cursor?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const data = await apiFetch(`/api/messages/${roomId}?${params}`);
  const messages = (data.messages || []).map((m: Record<string, string>) => ({
    id: m.messageId || m.id || m.sortKey,
    room_id: m.roomId || m.room_id,
    sender_id: m.senderId || m.sender_id,
    sender_name: m.senderName || m.sender_name || m.senderId || m.sender_id,
    content: m.content,
    type: m.type || "text",
    created_at: m.createdAt || m.created_at,
    sort_key: m.sortKey || m.sort_key,
  }));
  return { messages, cursor: data.cursor, has_more: data.has_more };
}

export async function sendMessage(roomId: string, data: { sender_id: string; content: string; sender_name?: string }) {
  return apiFetch(`/api/messages/${roomId}`, { method: "POST", body: JSON.stringify(data) });
}

export async function deleteMessage(roomId: string, key: string) {
  return apiFetch(`/api/messages/${roomId}/${encodeURIComponent(key)}`, { method: "DELETE" });
}

// ─── Users ──────────────────────────────────────────────────────────────────
export async function syncUser(data: { id: string; username: string; email: string; avatar_url?: string }) {
  return apiFetch("/api/users/", { method: "POST", body: JSON.stringify(data) });
}

export async function getUser(id: string) {
  const data = await apiFetch(`/api/users/${id}`);
  const u = data.user || data;
  return { id: u.userId || u.id, username: u.username, email: u.email, avatar_url: u.avatarUrl };
}

// ─── Connections (presence) ─────────────────────────────────────────────────
export async function getActiveUsers(roomId: string) {
  const data = await apiFetch(`/api/connections/room/${roomId}`);
  return data.connections || data || [];
}

export async function registerConnection(data: { id: string; user_id: string; room_id: string }) {
  return apiFetch("/api/connections/", {
    method: "POST",
    body: JSON.stringify({ user_id: data.user_id, room_id: data.room_id }),
  });
}

export async function removeConnection(id: string) {
  return apiFetch(`/api/connections/${id}`, { method: "DELETE" });
}

// ─── WebSocket ──────────────────────────────────────────────────────────────
export function connectWebSocket(roomId: string, userId: string) {
  return new WebSocket(`${WS_URL}/ws/${roomId}/${userId}`);
}

// ─── SSE ────────────────────────────────────────────────────────────────────
export function connectSSE(roomId: string) {
  return new EventSource(`${API}/api/sse/${roomId}`);
}
