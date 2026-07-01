// POST /api/pool/join
// Body: { code }
// Joins an existing room as the guest (player 2). Returns the seed (so the
// guest can build an identical rack), role 2, a guest token, and the current
// opSeq. Rejects if the room is unknown or already full.
import { getStore } from "@edgeone/pages-blob"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
}

export async function onRequestPost({ request }) {
  let body = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }
  const raw = String(body.code || "").trim().toUpperCase()
  if (!raw) {
    return new Response(JSON.stringify({ error: "missing code" }), {
      status: 400,
      headers: cors,
    })
  }

  const store = getStore("pool")
  const room = await store.get(`room/${raw}`, {
    type: "json",
    consistency: "strong",
  })
  if (!room) {
    return new Response(JSON.stringify({ error: "room not found" }), {
      status: 404,
      headers: cors,
    })
  }

  // Slot already claimed and still occupied.
  if (room.guestToken && room.guestPresent) {
    return new Response(JSON.stringify({ error: "room full" }), {
      status: 409,
      headers: cors,
    })
  }

  if (!room.guestToken) {
    room.guestToken = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }
  room.guestPresent = true
  room.status = "playing"
  room.updatedAt = Date.now()
  await store.setJSON(`room/${raw}`, room)

  return new Response(
    JSON.stringify({
      code: room.code,
      seed: room.seed,
      role: 2,
      token: room.guestToken,
      opSeq: room.opSeq,
    }),
    { status: 200, headers: cors },
  )
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors })
}
