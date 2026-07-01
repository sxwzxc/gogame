/* eslint-disable @typescript-eslint/no-explicit-any */
import { getStore } from "@edgeone/pages-blob"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
}

export async function POST(request: Request) {
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }
  const raw = String(body.code || "").trim().toUpperCase()
  if (!raw) {
    return NextResponse.json(
      { error: "missing code" },
      { status: 400, headers: cors },
    )
  }

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

  if (room.guestToken && room.guestPresent) {
    return NextResponse.json(
      { error: "room full" },
      { status: 409, headers: cors },
    )
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

  return NextResponse.json(
    {
      code: room.code,
      seed: room.seed,
      role: 2,
      token: room.guestToken,
      opSeq: room.opSeq,
    },
    { status: 200, headers: cors },
  )
}

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: cors })
}
