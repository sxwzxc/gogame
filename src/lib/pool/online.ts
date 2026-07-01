// Online multiplayer client for the pool game.
//
// Talks to the EdgeOne Makers Node.js Cloud Functions in cloud-functions/api/pool/.
// Those functions store room metadata + an append-only operation log in Makers
// Blob storage. Sync model: the current-turn player runs physics locally and
// submits an Op (shot direction+power + authoritative result+meta). The opponent
// polls for new ops and *replays* them on their own identical, seeded state, then
// snaps to the shooter's result to stay in lockstep.

import type { Op, Role } from "./engine"

// In production the functions are same-origin under /api/pool/...
// For local dev against `edgeone makers dev` (port 8088), set the env var.
export const API_BASE = process.env.NEXT_PUBLIC_POOL_API ?? ""

export interface RoomMeta {
  code: string
  seed: number
  status: "waiting" | "playing" | "ended"
  hostPresent: boolean
  guestPresent: boolean
  opSeq: number
  turn: Role
}

export interface CreateRoomResp {
  code: string
  seed: number
  role: Role
  token: string
}

export interface JoinRoomResp {
  code: string
  seed: number
  role: Role
  token: string
  opSeq: number
}

export interface PollResp {
  room: RoomMeta
  ops: Op[]
}

export interface SubmitResp {
  seq: number
  opSeq: number
}

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`GET ${url} -> ${res.status} ${t}`)
  }
  return res.json() as Promise<T>
}

async function jpost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`POST ${url} -> ${res.status} ${t}`)
  }
  return res.json() as Promise<T>
}

export function createRoom(): Promise<CreateRoomResp> {
  return jpost<CreateRoomResp>(`${API_BASE}/api/pool/create`, {})
}

export function joinRoom(code: string): Promise<JoinRoomResp> {
  return jpost<JoinRoomResp>(`${API_BASE}/api/pool/join`, {
    code: code.trim().toUpperCase(),
  })
}

export function pollState(code: string, since: number): Promise<PollResp> {
  return jget<PollResp>(`${API_BASE}/api/pool/room/${encodeURIComponent(code)}?since=${since}`)
}

export function submitOp(
  code: string,
  token: string,
  op: Omit<Op, "seq">,
): Promise<SubmitResp> {
  return jpost<SubmitResp>(
    `${API_BASE}/api/pool/room/${encodeURIComponent(code)}`,
    { token, op },
  )
}

export async function leaveRoom(code: string, token: string): Promise<void> {
  try {
    // keepalive so the request still completes if the tab is closing
    // (pagehide / unload) — otherwise the opponent would never be notified.
    await fetch(`${API_BASE}/api/pool/room/${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "leave" }),
      keepalive: true,
    })
  } catch {
    // Best-effort: ignore errors when leaving.
  }
}
