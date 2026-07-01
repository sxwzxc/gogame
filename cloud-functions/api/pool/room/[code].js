// /api/pool/room/[code]
//   GET  ?since=N    -> { room: {...public meta...}, ops: [ops with seq > since] }
//   POST { token, op }            -> append an op (shot/place/break), server assigns seq
//   POST { token, action:"leave" }-> mark the caller's presence off
//
// All reads/writes use strong consistency so turn enforcement is never based on
// stale data. Only the player whose role equals room.turn may submit an op —
// the game is strictly turn-based, so there is no concurrent writing.
import { getStore } from "@edgeone/pages-blob"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
}

function publicRoom(room) {
  return {
    code: room.code,
    seed: room.seed,
    status: room.status,
    hostPresent: !!room.hostPresent,
    guestPresent: !!room.guestPresent,
    opSeq: room.opSeq,
    turn: room.turn,
  }
}

export async function onRequestGet(context) {
  const code = String(context.params.code || "").trim().toUpperCase()
  const url = new URL(context.request.url)
  const since = Number(url.searchParams.get("since") || "0") || 0

  const store = getStore("pool")
  const room = await store.get(`room/${code}`, {
    type: "json",
    consistency: "strong",
  })
  if (!room) {
    return new Response(JSON.stringify({ error: "room not found" }), {
      status: 404,
      headers: cors,
    })
  }
  const ops = (await store.get(`ops/${code}`, {
    type: "json",
    consistency: "strong",
  })) || []

  return new Response(
    JSON.stringify({
      room: publicRoom(room),
      ops: ops.filter((o) => o.seq > since),
    }),
    { status: 200, headers: cors },
  )
}

export async function onRequestPost(context) {
  const code = String(context.params.code || "").trim().toUpperCase()
  let body = {}
  try {
    body = await context.request.json()
  } catch {
    body = {}
  }
  const token = String(body.token || "")

  const store = getStore("pool")
  const room = await store.get(`room/${code}`, {
    type: "json",
    consistency: "strong",
  })
  if (!room) {
    return new Response(JSON.stringify({ error: "room not found" }), {
      status: 404,
      headers: cors,
    })
  }

  let role = 0
  if (token && token === room.hostToken) role = 1
  else if (token && token === room.guestToken) role = 2
  if (!role) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 403,
      headers: cors,
    })
  }

  // Leave / presence-off.
  if (body.action === "leave") {
    if (role === 1) room.hostPresent = false
    else room.guestPresent = false
    if (!room.hostPresent && !room.guestPresent) room.status = "ended"
    room.updatedAt = Date.now()
    await store.setJSON(`room/${code}`, room)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors })
  }

  const op = body.op
  if (!op || !op.type) {
    return new Response(JSON.stringify({ error: "missing op" }), {
      status: 400,
      headers: cors,
    })
  }

  // Turn enforcement: only the current player may push a play op.
  // A "break" (new-game/reset) is a control op and may be sent by either player
  // (in practice the host initiates a rematch).
  if (op.type !== "break" && role !== room.turn) {
    return new Response(JSON.stringify({ error: "not your turn" }), {
      status: 409,
      headers: cors,
    })
  }

  const ops = (await store.get(`ops/${code}`, {
    type: "json",
    consistency: "strong",
  })) || []

  const seq = (room.opSeq || 0) + 1
  op.seq = seq
  op.by = role
  ops.push(op)
  room.opSeq = seq
  if (op.meta && typeof op.meta.current === "number") {
    room.turn = op.meta.current
  }
  if (op.type === "break") room.status = "playing"
  room.updatedAt = Date.now()

  await store.setJSON(`ops/${code}`, ops)
  await store.setJSON(`room/${code}`, room)

  return new Response(JSON.stringify({ seq, opSeq: seq }), {
    status: 200,
    headers: cors,
  })
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors })
}
