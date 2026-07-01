/* eslint-disable @typescript-eslint/no-explicit-any */
import { getStore } from "@edgeone/pages-blob"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
}

function publicRoom(room: any) {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const raw = String(code || "").trim().toUpperCase()
  const url = new URL(request.url)
  const since = Number(url.searchParams.get("since") || "0") || 0

  const store = getStore("pool")
  const room = await store.get(`room/${raw}`, {
    type: "json",
    consistency: "strong",
  })
  if (!room) {
    return NextResponse.json(
      { error: "room not found" },
      { status: 404, headers: cors },
    )
  }
  const ops = (await store.get(`ops/${raw}`, {
    type: "json",
    consistency: "strong",
  })) || []

  return NextResponse.json(
    {
      room: publicRoom(room),
      ops: ops.filter((o: any) => o.seq > since),
    },
    { status: 200, headers: cors },
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const raw = String(code || "").trim().toUpperCase()
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const token = String(body.token || "")

  const store = getStore("pool")
  const room = await store.get(`room/${raw}`, {
    type: "json",
    consistency: "strong",
  })
  if (!room) {
    return NextResponse.json(
      { error: "room not found" },
      { status: 404, headers: cors },
    )
  }

  let role = 0
  if (token && token === room.hostToken) role = 1
  else if (token && token === room.guestToken) role = 2
  if (!role) {
    return NextResponse.json(
      { error: "invalid token" },
      { status: 403, headers: cors },
    )
  }

  if (body.action === "leave") {
    if (role === 1) room.hostPresent = false
    else room.guestPresent = false
    if (!room.hostPresent && !room.guestPresent) room.status = "ended"
    room.updatedAt = Date.now()
    await store.setJSON(`room/${raw}`, room)
    return NextResponse.json({ ok: true }, { status: 200, headers: cors })
  }

  const op = body.op
  if (!op || !op.type) {
    return NextResponse.json(
      { error: "missing op" },
      { status: 400, headers: cors },
    )
  }

  if (op.type !== "break" && role !== room.turn) {
    return NextResponse.json(
      { error: "not your turn" },
      { status: 409, headers: cors },
    )
  }

  const ops = (await store.get(`ops/${raw}`, {
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

  await store.setJSON(`ops/${raw}`, ops)
  await store.setJSON(`room/${raw}`, room)

  return NextResponse.json({ seq, opSeq: seq }, { status: 200, headers: cors })
}

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: cors })
}
