"use client"

import { useEffect, useRef, useState } from "react"
import {
  BALL_COLORS,
  BALL_R,
  MAX_POWER,
  POCKET_R,
  POCKETS,
  RAIL,
  TABLE_H,
  TABLE_W,
  allStopped,
  applyMeta,
  applyPlace,
  buildMeta,
  buildShotResult,
  createInitialState,
  dist,
  isValidPlacement,
  predictAim,
  randomSeed,
  resetFromSeed,
  resolveShot,
  snapToResult,
  startShot,
  stepPhysics,
  type GameState,
  type Group,
  type Op,
  type Phase,
  type Role,
} from "@/lib/pool/engine"
import {
  createRoom,
  joinRoom,
  leaveRoom,
  pollState,
  submitOp,
  type RoomMeta,
} from "@/lib/pool/online"

// ==================== Rendering (canvas only) ====================
function drawFrame(ctx: CanvasRenderingContext2D) {
  const W = TABLE_W + 2 * RAIL
  const H = TABLE_H + 2 * RAIL
  const wg = ctx.createLinearGradient(0, 0, 0, H)
  wg.addColorStop(0, "#7a4a22")
  wg.addColorStop(0.5, "#5a3216")
  wg.addColorStop(1, "#3a2010")
  ctx.fillStyle = wg
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = "rgba(255,255,255,0.06)"
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, W - 2, H - 2)
  ctx.strokeStyle = "rgba(0,0,0,0.4)"
  ctx.strokeRect(RAIL - 2, RAIL - 2, TABLE_W + 4, TABLE_H + 4)
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = "rgba(255,255,255,0.55)"
  ctx.fillRect(-3, -3, 6, 6)
  ctx.restore()
}

function drawFelt(ctx: CanvasRenderingContext2D) {
  const fg = ctx.createRadialGradient(
    TABLE_W / 2, TABLE_H / 2, 60,
    TABLE_W / 2, TABLE_H / 2, TABLE_W * 0.72,
  )
  fg.addColorStop(0, "#0f7a45")
  fg.addColorStop(1, "#073d22")
  ctx.fillStyle = fg
  ctx.fillRect(0, 0, TABLE_W, TABLE_H)
  ctx.strokeStyle = "rgba(0,0,0,0.35)"
  ctx.lineWidth = 2
  ctx.strokeRect(0, 0, TABLE_W, TABLE_H)
  ctx.strokeStyle = "rgba(255,255,255,0.1)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(TABLE_W * 0.25, 0)
  ctx.lineTo(TABLE_W * 0.25, TABLE_H)
  ctx.stroke()
  ctx.fillStyle = "rgba(255,255,255,0.18)"
  ctx.beginPath()
  ctx.arc(TABLE_W * 0.72, TABLE_H / 2, 2.5, 0, Math.PI * 2)
  ctx.fill()
}

function drawPockets(ctx: CanvasRenderingContext2D) {
  for (const p of POCKETS) {
    const pg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, POCKET_R)
    pg.addColorStop(0, "#000000")
    pg.addColorStop(1, "#1a1a1a")
    ctx.fillStyle = pg
    ctx.beginPath()
    ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "rgba(0,0,0,0.5)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawBall(ctx: CanvasRenderingContext2D, b: { id: number; x: number; y: number; pocketed: boolean }) {
  ctx.beginPath()
  ctx.arc(b.x + 2, b.y + 3, BALL_R, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(0,0,0,0.35)"
  ctx.fill()

  const isStripe = b.id >= 9 && b.id <= 15
  ctx.beginPath()
  ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
  ctx.fillStyle = b.id === 0 ? "#f5f5f5" : isStripe ? "#ffffff" : BALL_COLORS[b.id]
  ctx.fill()

  if (isStripe) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = BALL_COLORS[b.id]
    ctx.fillRect(b.x - BALL_R, b.y - BALL_R * 0.45, BALL_R * 2, BALL_R * 0.9)
    ctx.restore()
  }

  const shade = ctx.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, BALL_R)
  shade.addColorStop(0, "rgba(255,255,255,0.45)")
  shade.addColorStop(0.5, "rgba(255,255,255,0)")
  shade.addColorStop(1, "rgba(0,0,0,0.4)")
  ctx.beginPath()
  ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
  ctx.fillStyle = shade
  ctx.fill()

  if (b.id !== 0) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, BALL_R * 0.44, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()
    ctx.fillStyle = "#111111"
    ctx.font = `bold ${Math.round(BALL_R * 0.62)}px sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(b.id), b.x, b.y + 0.5)
  }

  ctx.beginPath()
  ctx.arc(b.x - 4, b.y - 5, BALL_R * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.fill()
}

function drawAim(ctx: CanvasRenderingContext2D, g: GameState, mouse: { x: number; y: number } | null) {
  if (!mouse) return
  const cue = g.balls.find((b) => b.id === 0)
  if (!cue || cue.pocketed) return
  const ddx = cue.x - mouse.x
  const ddy = cue.y - mouse.y
  const d = Math.hypot(ddx, ddy)
  if (d < BALL_R) return
  const dir = { x: ddx / d, y: ddy / d }
  const power = Math.max(0, Math.min(MAX_POWER, (d - BALL_R - 6) * 0.45))
  const hit = predictAim(g, cue, dir)

  ctx.save()
  ctx.setLineDash([6, 6])
  ctx.strokeStyle = "rgba(255,255,255,0.7)"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cue.x + dir.x * BALL_R, cue.y + dir.y * BALL_R)
  ctx.lineTo(hit.x, hit.y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = "rgba(255,255,255,0.55)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(hit.x, hit.y, BALL_R, 0, Math.PI * 2)
  ctx.stroke()
  if (hit.type === "ball" && hit.hit) {
    const tdx = hit.hit.x - hit.x
    const tdy = hit.hit.y - hit.y
    const tl = Math.hypot(tdx, tdy)
    if (tl > 0.01) {
      const tn = { x: tdx / tl, y: tdy / tl }
      ctx.strokeStyle = "rgba(255,180,80,0.85)"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(hit.hit.x, hit.hit.y)
      ctx.lineTo(hit.hit.x + tn.x * 44, hit.hit.y + tn.y * 44)
      ctx.stroke()
    }
  }
  ctx.restore()

  const pullback = power * 2.2
  const tipX = cue.x - dir.x * (BALL_R + 4 + pullback)
  const tipY = cue.y - dir.y * (BALL_R + 4 + pullback)
  const buttX = tipX - dir.x * 190
  const buttY = tipY - dir.y * 190
  ctx.save()
  ctx.lineCap = "round"
  ctx.strokeStyle = "#f0f0f0"
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(tipX - dir.x * 10, tipY - dir.y * 10)
  ctx.stroke()
  const sg = ctx.createLinearGradient(tipX, tipY, buttX, buttY)
  sg.addColorStop(0, "#caa472")
  sg.addColorStop(1, "#5a3a18")
  ctx.strokeStyle = sg
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(tipX - dir.x * 10, tipY - dir.y * 10)
  ctx.lineTo(buttX, buttY)
  ctx.stroke()
  ctx.restore()
}

function drawGhostCue(ctx: CanvasRenderingContext2D, mouse: { x: number; y: number }, valid: boolean) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(mouse.x, mouse.y, BALL_R, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.fill()
  ctx.strokeStyle = valid ? "rgba(80,255,140,0.9)" : "rgba(255,90,90,0.9)"
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

function render(
  ctx: CanvasRenderingContext2D,
  g: GameState,
  ui: { aiming: boolean; mouse: { x: number; y: number } | null; canPlace: boolean },
) {
  const W = TABLE_W + 2 * RAIL
  const H = TABLE_H + 2 * RAIL
  ctx.clearRect(0, 0, W, H)
  drawFrame(ctx)
  for (let i = 1; i <= 3; i++) {
    const x = RAIL + (TABLE_W / 4) * i
    drawDiamond(ctx, x, RAIL / 2)
    drawDiamond(ctx, x, H - RAIL / 2)
  }
  drawDiamond(ctx, RAIL / 2, RAIL + TABLE_H / 2)
  drawDiamond(ctx, W - RAIL / 2, RAIL + TABLE_H / 2)

  ctx.save()
  ctx.translate(RAIL, RAIL)
  drawFelt(ctx)
  drawPockets(ctx)
  for (const b of g.balls) if (!b.pocketed) drawBall(ctx, b)
  if (ui.aiming && g.phase === "ready") drawAim(ctx, g, ui.mouse)
  if (g.phase === "ballInHand" && ui.mouse && ui.canPlace) {
    drawGhostCue(ctx, ui.mouse, isValidPlacement(g, ui.mouse.x, ui.mouse.y))
  }
  ctx.restore()
}

// ==================== Component ====================
type Mode = "menu" | "local" | "online"
type Screen = "lobby" | "hostwait" | "game"

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

type ShotCtx =
  | { kind: "local" }
  | { kind: "online-mine"; dirx: number; diry: number; power: number }
  | { kind: "online-replay"; op: Op }

interface OnlineInfo {
  code: string
  role: Role
  token: string
  seed: number
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gameRef = useRef<GameState | null>(null)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const aimingRef = useRef(false)
  const placingRef = useRef(false)
  const shotCtxRef = useRef<ShotCtx | null>(null)
  const lastSeqRef = useRef(0)
  const onlineRef = useRef<OnlineInfo | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittingRef = useRef(false)
  // Mirrors of state used inside the rAF loop / setInterval(doPoll), which
  // capture closures at setup time. Without these refs the loop/interval would
  // read stale values (e.g. screen staying "lobby" forever, breaking the
  // host-waiting -> game transition and opponent-left detection).
  const screenRef = useRef<Screen>("lobby")
  const canInteractRef = useRef(false)

  const [mode, setMode] = useState<Mode>("menu")
  const [screen, setScreen] = useState<Screen>("lobby")
  const [role, setRole] = useState<Role>(1)
  const [code, setCode] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [roomStatus, setRoomStatus] = useState<RoomMeta | null>(null)
  const [opponentLeft, setOpponentLeft] = useState(false)
  const [onlineError, setOnlineError] = useState("")

  const [current, setCurrent] = useState<Role>(1)
  const [message, setMessage] = useState("玩家 1 开球 — 拖动白球附近瞄准")
  const [phase, setPhase] = useState<Phase>("ready")
  const [groups, setGroups] = useState<[Group, Group]>([null, null])
  const [pocketedIds, setPocketedIds] = useState<number[]>([])
  const [gameOver, setGameOver] = useState<{ winner: Role; text: string } | null>(null)
  const [power, setPower] = useState(0)
  const [aiming, setAiming] = useState(false)

  const syncUI = () => {
    const g = gameRef.current
    if (!g) return
    setCurrent(g.current)
    setMessage(g.message)
    setPhase(g.phase)
    setGroups([g.players[0].group, g.players[1].group])
    setPocketedIds(g.balls.filter((b) => b.pocketed).map((b) => b.id))
    setGameOver(g.gameOver)
  }

  const startLocal = () => {
    gameRef.current = createInitialState(randomSeed())
    shotCtxRef.current = null
    setMode("local")
    setScreen("game")
    setOpponentLeft(false)
    setOnlineError("")
    syncUI()
  }

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Apply an op received from the opponent (replay it locally).
  const applyRemoteOp = (op: Op) => {
    const g = gameRef.current
    if (!g) return
    // Never replay my own ops — I already applied them locally.
    if (onlineRef.current && op.by === onlineRef.current.role) {
      lastSeqRef.current = Math.max(lastSeqRef.current, op.seq)
      return
    }
    if (op.type === "break") {
      resetFromSeed(g, op.seed ?? g.seed)
      if (op.meta) applyMeta(g, op.meta)
    } else if (op.type === "place") {
      applyPlace(g, op.x ?? 0, op.y ?? 0)
      if (op.meta) applyMeta(g, op.meta)
    } else if (op.type === "shot") {
      // Begin deterministic replay; the rAF loop finishes it and snaps to result.
      shotCtxRef.current = { kind: "online-replay", op }
      startShot(g, op.dirx ?? 0, op.diry ?? 0, op.power ?? 0)
    }
    lastSeqRef.current = Math.max(lastSeqRef.current, op.seq)
    syncUI()
  }

  const doPoll = async () => {
    const info = onlineRef.current
    const g = gameRef.current
    if (!info || !g) return
    // Don't fetch/apply while a shot (mine or a replay) is in progress.
    if (g.phase === "shooting") return
    try {
      const resp = await pollState(info.code, lastSeqRef.current)
      setRoomStatus(resp.room)
      // Read screen from the ref: doPoll is captured once by setInterval, so
      // the closed-over `screen` state would otherwise be stuck at the value
      // from the render that started polling (e.g. "lobby"), which broke both
      // the host-waiting -> game transition and opponent-left detection.
      const sc = screenRef.current
      if (resp.room.status === "ended" ||
          (sc === "game" && !resp.room.hostPresent) ||
          (sc === "game" && !resp.room.guestPresent)) {
        setOpponentLeft(true)
      }
      // Host transitions from waiting to game once the guest joins.
      if (info.role === 1 && sc === "hostwait" && resp.room.guestPresent) {
        setScreen("game")
      }
      for (const op of resp.ops) {
        applyRemoteOp(op)
        // applyRemoteOp may have started a replay (mutating g in place); re-read
        // from the ref so TS doesn't keep the stale narrowed phase type.
        if (gameRef.current?.phase === "shooting") break // defer the rest
      }
    } catch {
      // Transient errors are fine; keep retrying.
    }
  }

  const startPolling = () => {
    stopPolling()
    pollRef.current = setInterval(doPoll, 900)
  }

  const handleCreateRoom = async () => {
    setOnlineError("")
    try {
      const resp = await createRoom()
      onlineRef.current = { code: resp.code, role: resp.role, token: resp.token, seed: resp.seed }
      gameRef.current = createInitialState(resp.seed)
      lastSeqRef.current = 0
      setRole(resp.role)
      setCode(resp.code)
      setMode("online")
      setScreen("hostwait")
      setOpponentLeft(false)
      syncUI()
      startPolling()
    } catch (e) {
      setOnlineError("创建房间失败：" + errMsg(e))
    }
  }

  const handleJoinRoom = async () => {
    setOnlineError("")
    const c = joinCode.trim().toUpperCase()
    if (!c) {
      setOnlineError("请输入房间号")
      return
    }
    try {
      const resp = await joinRoom(c)
      onlineRef.current = { code: resp.code, role: resp.role, token: resp.token, seed: resp.seed }
      gameRef.current = createInitialState(resp.seed)
      lastSeqRef.current = resp.opSeq
      setRole(resp.role)
      setCode(resp.code)
      setMode("online")
      setScreen("game")
      setOpponentLeft(false)
      syncUI()
      startPolling()
    } catch (e) {
      setOnlineError("加入房间失败：" + errMsg(e))
    }
  }

  const leaveOnline = () => {
    const info = onlineRef.current
    stopPolling()
    if (info) leaveRoom(info.code, info.token)
    onlineRef.current = null
    setMode("menu")
    setScreen("lobby")
    setRoomStatus(null)
    setOpponentLeft(false)
  }

  // Submit an op to the backend (shot/place/break). Sets lastSeq from the response.
  const sendOp = async (op: Omit<Op, "seq">) => {
    const info = onlineRef.current
    if (!info) return
    submittingRef.current = true
    try {
      const resp = await submitOp(info.code, info.token, op)
      lastSeqRef.current = Math.max(lastSeqRef.current, resp.seq)
    } catch (e) {
      setOnlineError("同步失败：" + errMsg(e))
    } finally {
      submittingRef.current = false
    }
  }

  // Online rematch (host only): reset with a fresh seed and broadcast a break op.
  const onlineRematch = async () => {
    const g = gameRef.current
    const info = onlineRef.current
    if (!g || !info || info.role !== 1) return
    const seed = randomSeed()
    resetFromSeed(g, seed)
    const op: Omit<Op, "seq"> = {
      type: "break", by: info.role, seed, meta: buildMeta(g),
    }
    syncUI()
    await sendOp(op)
  }

  const getTablePos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const sx = (TABLE_W + 2 * RAIL) / rect.width
    const sy = (TABLE_H + 2 * RAIL) / rect.height
    return {
      x: (e.clientX - rect.left) * sx - RAIL,
      y: (e.clientY - rect.top) * sy - RAIL,
    }
  }

  const isLocal = mode === "local"
  const isOnline = mode === "online"
  const myTurn = isLocal || (isOnline && role === current)
  const playing = !isOnline || (roomStatus?.status === "playing")
  const canInteract =
    (isLocal || (isOnline && screen === "game")) &&
    myTurn && playing && !opponentLeft && !submittingRef.current
  // True only while the <canvas> is actually mounted (the game screen). The
  // main rAF effect depends on this so it (re)starts exactly when the canvas
  // appears, instead of running once at menu mount when canvasRef is null.
  const canvasMounted = isLocal || (isOnline && screen === "game")
  // Keep refs in sync for the closures captured by setInterval / rAF.
  screenRef.current = screen
  canInteractRef.current = canInteract

  const tryPlaceCue = (x: number, y: number) => {
    const g = gameRef.current
    if (!g || !isValidPlacement(g, x, y)) return false
    applyPlace(g, x, y)
    g.phase = "ready"
    g.message = `${g.players[g.current - 1].name} 击球中`
    if (isOnline) {
      const op: Omit<Op, "seq"> = {
        type: "place",
        by: role,
        x,
        y,
        meta: buildMeta(g),
      }
      sendOp(op)
    }
    syncUI()
    return true
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const g = gameRef.current
    if (!g || !canInteract) return
    const pos = getTablePos(e)
    mouseRef.current = pos
    if (g.phase === "ballInHand") {
      placingRef.current = true
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    } else if (g.phase === "ready") {
      aimingRef.current = true
      setAiming(true)
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const pos = getTablePos(e)
    mouseRef.current = pos
    if (aimingRef.current) {
      const cue = gameRef.current?.balls.find((b) => b.id === 0)
      if (cue) {
        const d = dist(cue.x, cue.y, pos.x, pos.y)
        setPower(Math.max(0, Math.min(MAX_POWER, (d - BALL_R - 6) * 0.45)))
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gameRef.current
    if (!g) return
    const pos = getTablePos(e)
    mouseRef.current = pos

    if (placingRef.current) {
      placingRef.current = false
      if (canInteract) tryPlaceCue(pos.x, pos.y)
      return
    }

    if (aimingRef.current) {
      aimingRef.current = false
      setAiming(false)
      if (!canInteract) return
      const cue = g.balls.find((b) => b.id === 0)
      if (!cue) return
      const d = dist(cue.x, cue.y, pos.x, pos.y)
      if (d <= BALL_R) {
        setPower(0)
        return
      }
      const p = Math.max(0, Math.min(MAX_POWER, (d - BALL_R - 6) * 0.45))
      if (p <= 0.5) {
        setPower(0)
        return
      }
      const dirx = (cue.x - pos.x) / d
      const diry = (cue.y - pos.y) / d
      shotCtxRef.current = isOnline
        ? { kind: "online-mine", dirx, diry, power: p }
        : { kind: "local" }
      startShot(g, dirx, diry, p)
      setPhase("shooting")
      setPower(0)
      setMessage("击球中…")
    }
  }

  const newLocalGame = () => {
    gameRef.current = createInitialState(randomSeed())
    shotCtxRef.current = null
    setPower(0)
    setAiming(false)
    syncUI()
  }

  // Main loop: physics + render. Re-runs whenever the canvas actually mounts
  // (canvasMounted). Previously this had `[]` deps, so on first render (menu,
  // no <canvas>) canvasRef was null and the effect bailed out forever — leaving
  // a blank canvas once the user navigated to the game screen.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = (TABLE_W + 2 * RAIL) * dpr
    canvas.height = (TABLE_H + 2 * RAIL) * dpr
    ctx.scale(dpr, dpr)

    let raf = 0
    const loop = () => {
      const g = gameRef.current
      if (g) {
        if (g.phase === "shooting") {
          stepPhysics(g)
          if (allStopped(g)) {
            const ctx2 = shotCtxRef.current
            if (ctx2?.kind === "local") {
              resolveShot(g)
            } else if (ctx2?.kind === "online-mine") {
              resolveShot(g)
              const op: Omit<Op, "seq"> = {
                type: "shot",
                by: role,
                dirx: ctx2.dirx,
                diry: ctx2.diry,
                power: ctx2.power,
                result: buildShotResult(g),
                meta: buildMeta(g),
              }
              // Fire-and-forget: sendOp sets submittingRef while in flight.
              void sendOp(op)
            } else if (ctx2?.kind === "online-replay") {
              if (ctx2.op.result) snapToResult(g, ctx2.op.result)
              if (ctx2.op.meta) applyMeta(g, ctx2.op.meta)
            }
            shotCtxRef.current = null
            syncUI()
          }
        }
        render(ctx, g, {
          aiming: aimingRef.current,
          mouse: mouseRef.current,
          canPlace: canInteractRef.current,
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasMounted])

  // Cleanup online on unmount.
  useEffect(() => {
    return () => {
      stopPolling()
      const info = onlineRef.current
      if (info) leaveRoom(info.code, info.token)
    }
  }, [])

  // Also notify the server when the tab is closed / navigated away — React's
  // unmount cleanup is not guaranteed to run on pagehide, so we listen for it
  // explicitly. leaveRoom uses keepalive so the request survives the unload.
  useEffect(() => {
    const onUnload = () => {
      const info = onlineRef.current
      if (info) leaveRoom(info.code, info.token)
    }
    window.addEventListener("pagehide", onUnload)
    return () => window.removeEventListener("pagehide", onUnload)
  }, [])

  const groupLabel = (grp: Group) =>
    grp === "solids" ? "实球 1-7" : grp === "stripes" ? "花球 9-15" : "待定"

  // ---------- Menu ----------
  if (mode === "menu") {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center">
        <div className="grid-background" />
        <div
          className="gradient-orb w-[520px] h-[520px] -top-[160px] -left-[120px] opacity-30"
          style={{ background: "radial-gradient(circle, rgba(14,122,69,0.55) 0%, transparent 70%)" }}
        />
        <div className="relative z-10 text-center px-6 max-w-md w-full">
          <h1 className="text-5xl font-bold leading-tight mb-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-green-300 to-white">
              台球大师
            </span>
          </h1>
          <p className="text-gray-400 text-sm mb-8">8 球玩法 · 本地双人 / 在线联机</p>

          <div className="space-y-3">
            <button
              onClick={startLocal}
              className="w-full px-6 py-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors cursor-pointer"
            >
              本地双人对战
            </button>
            <button
              onClick={() => { setMode("online"); setScreen("lobby"); setOnlineError("") }}
              className="w-full px-6 py-4 rounded-lg bg-white/10 hover:bg-white/15 border border-emerald-400/40 text-white font-semibold transition-colors cursor-pointer"
            >
              在线联机对战
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-6 leading-relaxed">
            在线模式基于 EdgeOne Makers Cloud Functions + Blob 存储实现：
            操作日志以追加方式写入 Blob，双方轮询拉取并确定性重放，保证状态同步。
          </p>
        </div>
      </div>
    )
  }

  // ---------- Online lobby ----------
  if (isOnline && screen === "lobby") {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center">
        <div className="grid-background" />
        <div className="relative z-10 text-center px-6 max-w-md w-full">
          <h2 className="text-3xl font-bold mb-6">在线联机</h2>
          <div className="space-y-4 text-left">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-sm font-semibold mb-2">创建房间</p>
              <p className="text-xs text-gray-400 mb-3">生成房间号，分享给好友加入。你将作为玩家 1（主机）先开球。</p>
              <button
                onClick={handleCreateRoom}
                className="w-full px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors cursor-pointer"
              >
                创建房间
              </button>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-sm font-semibold mb-2">加入房间</p>
              <p className="text-xs text-gray-400 mb-3">输入好友给你的房间号加入对局。</p>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="房间号"
                className="w-full px-3 py-2 mb-2 rounded-lg bg-black/50 border border-white/15 text-white text-center tracking-widest uppercase outline-none focus:border-emerald-400"
              />
              <button
                onClick={handleJoinRoom}
                className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-emerald-400/40 font-semibold transition-colors cursor-pointer"
              >
                加入
              </button>
            </div>
          </div>
          {onlineError && <p className="text-red-400 text-xs mt-4">{onlineError}</p>}
          <button
            onClick={() => setMode("menu")}
            className="mt-6 text-gray-500 hover:text-gray-300 text-sm cursor-pointer"
          >
            ← 返回菜单
          </button>
          <p className="text-gray-600 text-xs mt-4 leading-relaxed">
            提示：在线模式需部署到 EdgeOne Makers 后生效；本地预览可先体验“本地双人”。
          </p>
        </div>
      </div>
    )
  }

  // ---------- Host waiting ----------
  if (isOnline && screen === "hostwait") {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center">
        <div className="grid-background" />
        <div className="relative z-10 text-center px-6">
          <h2 className="text-2xl font-bold mb-2">等待对手加入…</h2>
          <p className="text-gray-400 text-sm mb-6">把房间号分享给好友</p>
          <div className="text-5xl font-bold tracking-[0.4em] text-emerald-300 mb-6 bg-white/5 border border-emerald-400/30 rounded-xl px-8 py-4 inline-block">
            {code}
          </div>
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
            <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            等待中…
          </div>
          {onlineError && <p className="text-red-400 text-xs mt-4">{onlineError}</p>}
          <button
            onClick={leaveOnline}
            className="mt-8 text-gray-500 hover:text-gray-300 text-sm cursor-pointer block mx-auto"
          >
            ← 取消并返回菜单
          </button>
        </div>
      </div>
    )
  }

  // ---------- Game (local or online) ----------
  const showCanvas = !isOnline || screen === "game"

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="grid-background" />
      <div
        className="gradient-orb w-[520px] h-[520px] -top-[160px] -left-[120px] opacity-30"
        style={{ background: "radial-gradient(circle, rgba(14,122,69,0.55) 0%, transparent 70%)" }}
      />
      <div
        className="gradient-orb w-[420px] h-[420px] top-[40%] -right-[120px] opacity-25"
        style={{ background: "radial-gradient(circle, rgba(0,173,216,0.4) 0%, transparent 70%)" }}
      />

      <main className="container mx-auto px-4 py-6 relative z-10">
        <header className="text-center mb-4">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-green-300 to-white">
              台球大师
            </span>
            <span className="text-gray-500 text-base ml-3">
              {isLocal ? "本地对战" : `在线 · 房间 ${code} · 你是玩家 ${role}`}
            </span>
          </h1>
          <p className="text-gray-400 mt-1 text-xs">
            8 球玩法 · 拖动白球反方向拉杆瞄准并蓄力，松开击球
          </p>
        </header>

        {/* Scoreboard */}
        <div className="grid grid-cols-2 gap-3 max-w-[940px] mx-auto mb-4">
          {[0, 1].map((i) => {
            const playerRole = (i + 1) as Role
            const isCur = current === playerRole && phase !== "gameover"
            const isMe = isOnline && role === playerRole
            const grp = groups[i]
            const ids =
              grp === "solids"
                ? [1, 2, 3, 4, 5, 6, 7]
                : grp === "stripes"
                  ? [9, 10, 11, 12, 13, 14, 15]
                  : []
            const pocketedOfGroup = ids.filter((id) => pocketedIds.includes(id))
            return (
              <div
                key={i}
                className={`rounded-lg p-3 border transition-all ${
                  isCur
                    ? "border-emerald-400 bg-emerald-400/10 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {`玩家 ${i + 1}`}
                    {isMe && <span className="ml-1 text-xs text-cyan-300">（你）</span>}
                    {isCur && <span className="ml-2 text-xs text-emerald-300">● 击球中</span>}
                  </span>
                  <span className="text-xs text-gray-400">{groupLabel(grp)}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-2xl font-bold tabular-nums">
                    {grp ? pocketedOfGroup.length : 0}
                    <span className="text-sm text-gray-500">/7</span>
                  </span>
                  {ids.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ids.map((id) => {
                        const potted = pocketedIds.includes(id)
                        return (
                          <span
                            key={id}
                            className="w-4 h-4 rounded-full"
                            style={{
                              background: potted ? "#333333" : BALL_COLORS[id],
                              border:
                                id >= 9 && id <= 15 ? "1px solid #fff" : "1px solid #000",
                              opacity: potted ? 0.4 : 1,
                            }}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {showCanvas && (
          <>
            <div className="flex justify-center">
              <div className="relative w-full max-w-[940px]">
                <canvas
                  ref={canvasRef}
                  className={`w-full rounded-lg shadow-2xl touch-none select-none ${
                    canInteract ? "cursor-crosshair" : "cursor-default"
                  }`}
                  style={{ aspectRatio: `${TABLE_W + 2 * RAIL} / ${TABLE_H + 2 * RAIL}` }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                />
                {gameOver && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/55 backdrop-blur-sm">
                    <div className="text-center px-6 py-5 rounded-xl bg-zinc-900/90 border border-yellow-400/40 shadow-2xl">
                      <div className="text-5xl mb-2">🏆</div>
                      <div className="text-xl font-bold text-yellow-300">{gameOver.text}</div>
                      <div className="text-sm text-gray-400 mt-1">玩家 {gameOver.winner} 获胜</div>
                      {isLocal && (
                        <button
                          onClick={newLocalGame}
                          className="mt-4 px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors cursor-pointer"
                        >
                          再来一局
                        </button>
                      )}
                      {isOnline && role === 1 && (
                        <button
                          onClick={onlineRematch}
                          className="mt-4 px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors cursor-pointer"
                        >
                          再来一局
                        </button>
                      )}
                      {isOnline && role === 2 && (
                        <p className="text-xs text-gray-400 mt-4">等待主机开始新局…</p>
                      )}
                    </div>
                  </div>
                )}
                {opponentLeft && !gameOver && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/55 backdrop-blur-sm">
                    <div className="text-center px-6 py-5 rounded-xl bg-zinc-900/90 border border-red-400/40">
                      <div className="text-xl font-bold text-red-300 mb-2">对手已离开</div>
                      <button
                        onClick={leaveOnline}
                        className="mt-2 px-6 py-2 rounded-lg bg-white/10 hover:bg-white/15 font-semibold transition-colors cursor-pointer"
                      >
                        返回菜单
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {aiming && phase === "ready" && (
              <div className="max-w-[940px] mx-auto mt-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-10">力度</span>
                  <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(power / MAX_POWER) * 100}%`,
                        background: "linear-gradient(90deg,#22c55e,#eab308,#ef4444)",
                        transition: "width 60ms linear",
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-10 text-right tabular-nums">
                    {Math.round((power / MAX_POWER) * 100)}%
                  </span>
                </div>
              </div>
            )}

            <div className="max-w-[940px] mx-auto mt-4 text-center">
              <div
                className={`inline-block px-4 py-2 rounded-lg text-sm ${
                  phase === "gameover"
                    ? "bg-yellow-400/20 text-yellow-200 border border-yellow-400/40"
                    : phase === "ballInHand"
                      ? "bg-amber-400/15 text-amber-200 border border-amber-400/30"
                      : phase === "shooting"
                        ? "bg-white/5 text-gray-300 border border-white/10"
                        : isOnline && !myTurn
                          ? "bg-cyan-400/10 text-cyan-200 border border-cyan-400/30"
                          : "bg-emerald-400/10 text-emerald-200 border border-emerald-400/30"
                }`}
              >
                {isOnline && !myTurn && phase === "ready"
                  ? "等待对手击球…"
                  : isOnline && !myTurn && phase === "ballInHand"
                    ? "对手自由放球中…"
                    : message}
                {phase === "ballInHand" && myTurn && " 点击台面合法位置放置白球"}
              </div>
            </div>

            <div className="max-w-[940px] mx-auto mt-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <p className="text-xs text-gray-500 leading-relaxed">
                {isLocal
                  ? "本地双人：两人共用一台设备轮流操作。"
                  : `在线联机：你是玩家 ${role}。`}
              </p>
              <div className="flex gap-2">
                {isOnline && (
                  <button
                    onClick={leaveOnline}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    离开房间
                  </button>
                )}
                {isLocal && (
                  <button
                    onClick={newLocalGame}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    新游戏
                  </button>
                )}
                <button
                  onClick={() => {
                    if (isOnline) leaveOnline()
                    else setMode("menu")
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold transition-colors cursor-pointer"
                >
                  返回菜单
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
