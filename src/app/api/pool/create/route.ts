/* eslint-disable @typescript-eslint/no-explicit-any */
import { getStore } from "@edgeone/pages-blob"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

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

export async function POST() {
  const store = getStore("pool")

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

  return NextResponse.json(
    { code, seed, role: 1, token: hostToken },
    { status: 201, headers: cors },
  )
}

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: cors })
}
