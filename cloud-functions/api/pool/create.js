// POST /api/pool/create
// Creates a new online pool room. Returns the room code, deterministic rack
// seed, the caller's role (1 = host), and a secret token used to authorize the
// caller's future writes. Room metadata + the operation log live in Makers Blob.
import { getStore } from "@edgeone/pages-blob"

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // no I/O/0/1 ambiguity

function randomCode(len = 4) {
  let s = ""
  const buf = new Uint8Array(len)
  crypto.getRandomValues(buf)
  for (let i = 0; i < len; i++) s += CODE_CHARS[buf[i] % CODE_CHARS.length]
  return s
}

function randomToken() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
}

export async function onRequestPost({ request }) {
  const store = getStore("pool")

  // Find a free room code (retry on collision).
  let code = ""
  let attempts = 0
  while (attempts < 20) {
    code = randomCode()
    const existing = await store.get(`room/${code}`, { type: "json", consistency: "strong" })
    if (!existing) break
    attempts++
  }

  const seed = crypto.getRandomValues(new Uint32Array(1))[0] >>> 0
  const hostToken = randomToken()
  const room = {
    code,
    seed,
    status: "waiting",
    hostToken,
    guestToken: null,
    hostPresent: true,
    guestPresent: false,
    opSeq: 0,
    turn: 1,
    updatedAt: Date.now(),
  }

  await store.setJSON(`room/${code}`, room)
  await store.setJSON(`ops/${code}`, [])

  return new Response(
    JSON.stringify({ code, seed, role: 1, token: hostToken }),
    { status: 201, headers: cors },
  )
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors })
}
