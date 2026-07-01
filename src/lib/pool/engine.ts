// Deterministic 8-ball pool engine.
// Pure (no React, no DOM). All randomness flows through a seeded PRNG so that
// two clients starting from the same seed + same operation log converge to the
// exact same state. This is what makes online "replay" sync possible.

// ==================== Constants ====================
export const TABLE_W = 880
export const TABLE_H = 440
export const RAIL = 30
export const BALL_R = 12
export const POCKET_R = 22
export const FRICTION = 0.988
export const STOP_V = 0.05
export const CUSHION_BOUNCE = 0.8
export const BALL_BOUNCE = 0.96
export const MAX_POWER = 22
export const POWER_SCALE = 0.95
export const SUBSTEPS = 8

export const BALL_COLORS: Record<number, string> = {
  0: "#ffffff",
  1: "#f2c01e",
  2: "#1f4fb0",
  3: "#d83232",
  4: "#6b2c91",
  5: "#e8731c",
  6: "#1a7a3a",
  7: "#7a1f1f",
  8: "#1a1a1a",
  9: "#f2c01e",
  10: "#1f4fb0",
  11: "#d83232",
  12: "#6b2c91",
  13: "#e8731c",
  14: "#1a7a3a",
  15: "#7a1f1f",
}

export const POCKETS = [
  { x: 0, y: 0 },
  { x: TABLE_W / 2, y: 0 },
  { x: TABLE_W, y: 0 },
  { x: 0, y: TABLE_H },
  { x: TABLE_W / 2, y: TABLE_H },
  { x: TABLE_W, y: TABLE_H },
]

// ==================== Types ====================
export type Group = "solids" | "stripes" | null
export type Phase = "ready" | "shooting" | "ballInHand" | "gameover"
export type Role = 1 | 2

export interface Ball {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  pocketed: boolean
}

export interface Player {
  name: string
  group: Group
}

export interface GameState {
  balls: Ball[]
  players: [Player, Player]
  current: Role
  phase: Phase
  message: string
  shotCount: number
  firstContact: number | null
  pocketedThisShot: number[]
  gameOver: { winner: Role; text: string } | null
  seed: number
}

export interface ShotResult {
  balls: { id: number; x: number; y: number; pocketed: boolean }[]
  pocketed: number[]
}

export interface OpMeta {
  current: Role
  phase: Phase
  groups: [Group, Group]
  gameOver: { winner: Role; text: string } | null
  message: string
}

export type OpType = "break" | "place" | "shot"

export interface Op {
  seq: number
  type: OpType
  by: Role
  seed?: number
  x?: number
  y?: number
  dirx?: number
  diry?: number
  power?: number
  result?: ShotResult
  meta?: OpMeta
}

// ==================== Seeded PRNG (mulberry32) ====================
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rng: () => number, n: number) {
  return Math.floor(rng() * n)
}

function shuffleRng<T>(rng: () => number, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

// ==================== Helpers ====================
export function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by)
}

// Deterministic 8-ball rack: 1 at apex, 8 at center, one solid & one stripe in
// the two back corners, remaining balls randomized by the seeded PRNG.
export function buildRack(seed: number): Ball[] {
  const rng = mulberry32(seed)
  const balls: Ball[] = []
  const footX = TABLE_W * 0.72
  const footY = TABLE_H / 2
  const dx = BALL_R * Math.sqrt(3) + 0.3
  const spacing = 2 * BALL_R + 0.5

  const positions: { x: number; y: number }[] = []
  for (let r = 0; r < 5; r++) {
    for (let i = 0; i <= r; i++) {
      positions.push({ x: footX + r * dx, y: footY + (i - r / 2) * spacing })
    }
  }

  const assign: number[] = new Array(15).fill(0)
  assign[0] = 1
  assign[4] = 8

  const solids = [2, 3, 4, 5, 6, 7]
  const stripes = [9, 10, 11, 12, 13, 14, 15]
  const cornerSolid = solids[randInt(rng, solids.length)]
  const cornerStripe = stripes[randInt(rng, stripes.length)]
  const swap = rng() < 0.5
  assign[10] = swap ? cornerSolid : cornerStripe
  assign[14] = swap ? cornerStripe : cornerSolid

  const remaining: number[] = []
  for (let id = 1; id <= 15; id++) {
    if (id === 1 || id === 8 || id === cornerSolid || id === cornerStripe) continue
    remaining.push(id)
  }
  shuffleRng(rng, remaining)
  let ri = 0
  for (let idx = 0; idx < 15; idx++) {
    if (assign[idx] !== 0) continue
    assign[idx] = remaining[ri++]
  }

  for (let idx = 0; idx < 15; idx++) {
    balls.push({
      id: assign[idx],
      x: positions[idx].x,
      y: positions[idx].y,
      vx: 0,
      vy: 0,
      pocketed: false,
    })
  }
  balls.push({ id: 0, x: TABLE_W * 0.25, y: TABLE_H / 2, vx: 0, vy: 0, pocketed: false })
  return balls
}

export function createInitialState(seed: number, names?: [string, string]): GameState {
  return {
    balls: buildRack(seed),
    players: [
      { name: names?.[0] ?? "玩家 1", group: null },
      { name: names?.[1] ?? "玩家 2", group: null },
    ],
    current: 1,
    phase: "ready",
    message: "玩家 1 开球 — 拖动白球附近瞄准",
    shotCount: 0,
    firstContact: null,
    pocketedThisShot: [],
    gameOver: null,
    seed,
  }
}

// Reset an existing state in-place to a fresh rack (used by "break" op / rematch).
export function resetFromSeed(g: GameState, seed: number) {
  const fresh = createInitialState(seed, [g.players[0].name, g.players[1].name])
  g.balls = fresh.balls
  g.players[0].group = null
  g.players[1].group = null
  g.current = 1
  g.phase = "ready"
  g.shotCount = 0
  g.firstContact = null
  g.pocketedThisShot = []
  g.gameOver = null
  g.seed = seed
  g.message = "新局开始 — 玩家 1 开球"
}

// ==================== Physics ====================
function resolveCollision(a: Ball, b: Ball) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  if (d === 0 || d >= 2 * BALL_R) return
  const nx = dx / d
  const ny = dy / d
  const overlap = 2 * BALL_R - d
  a.x -= (nx * overlap) / 2
  a.y -= (ny * overlap) / 2
  b.x += (nx * overlap) / 2
  b.y += (ny * overlap) / 2
  const dvx = b.vx - a.vx
  const dvy = b.vy - a.vy
  const vn = dvx * nx + dvy * ny
  if (vn > 0) return
  const j = (-(1 + BALL_BOUNCE) * vn) / 2
  a.vx -= j * nx
  a.vy -= j * ny
  b.vx += j * nx
  b.vy += j * ny
}

function applyCushions(b: Ball) {
  const near = (px: number, py: number) => dist(b.x, b.y, px, py) < POCKET_R * 1.25
  const nearTL = near(POCKETS[0].x, POCKETS[0].y)
  const nearTM = near(POCKETS[1].x, POCKETS[1].y)
  const nearTR = near(POCKETS[2].x, POCKETS[2].y)
  const nearBL = near(POCKETS[3].x, POCKETS[3].y)
  const nearBM = near(POCKETS[4].x, POCKETS[4].y)
  const nearBR = near(POCKETS[5].x, POCKETS[5].y)
  if (b.x - BALL_R < 0 && !nearTL && !nearBL) {
    b.x = BALL_R
    b.vx = -b.vx * CUSHION_BOUNCE
  }
  if (b.x + BALL_R > TABLE_W && !nearTR && !nearBR) {
    b.x = TABLE_W - BALL_R
    b.vx = -b.vx * CUSHION_BOUNCE
  }
  if (b.y - BALL_R < 0 && !nearTL && !nearTM && !nearTR) {
    b.y = BALL_R
    b.vy = -b.vy * CUSHION_BOUNCE
  }
  if (b.y + BALL_R > TABLE_H && !nearBL && !nearBM && !nearBR) {
    b.y = TABLE_H - BALL_R
    b.vy = -b.vy * CUSHION_BOUNCE
  }
}

export function stepPhysics(g: GameState) {
  for (let s = 0; s < SUBSTEPS; s++) {
    for (const b of g.balls) {
      if (b.pocketed) continue
      b.x += b.vx / SUBSTEPS
      b.y += b.vy / SUBSTEPS
    }
    for (let i = 0; i < g.balls.length; i++) {
      const a = g.balls[i]
      if (a.pocketed) continue
      for (let j = i + 1; j < g.balls.length; j++) {
        const b = g.balls[j]
        if (b.pocketed) continue
        resolveCollision(a, b)
        if (g.firstContact == null && (a.id === 0 || b.id === 0)) {
          g.firstContact = a.id === 0 ? b.id : a.id
        }
      }
    }
    for (const b of g.balls) {
      if (b.pocketed) continue
      applyCushions(b)
      for (const p of POCKETS) {
        if (dist(b.x, b.y, p.x, p.y) < POCKET_R) {
          b.pocketed = true
          b.vx = 0
          b.vy = 0
          g.pocketedThisShot.push(b.id)
          break
        }
      }
    }
  }
  for (const b of g.balls) {
    if (b.pocketed) continue
    b.vx *= FRICTION
    b.vy *= FRICTION
    if (Math.hypot(b.vx, b.vy) < STOP_V) {
      b.vx = 0
      b.vy = 0
    }
  }
}

export function allStopped(g: GameState) {
  return g.balls.every((b) => b.pocketed || (b.vx === 0 && b.vy === 0))
}

export function ballsRemaining(g: GameState, playerIdx: number) {
  const p = g.players[playerIdx]
  if (!p.group) return 7
  const ids = p.group === "solids" ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15]
  let n = 0
  for (const id of ids) {
    const b = g.balls.find((x) => x.id === id)
    if (b && !b.pocketed) n++
  }
  return n
}

// Resolve the outcome of a shot once all balls have come to rest (mutates g).
export function resolveShot(g: GameState) {
  const pocketed = g.pocketedThisShot
  const cueScratched = pocketed.includes(0)
  const eightPocketed = pocketed.includes(8)
  const legalPocketed = pocketed.filter((id) => id !== 0 && id !== 8)
  const noContact = g.firstContact == null
  const me = g.players[g.current - 1]
  const opp = g.players[g.current === 1 ? 1 : 0]
  const foul = cueScratched || noContact

  if (eightPocketed && g.shotCount !== 0) {
    const cleared = me.group && ballsRemaining(g, g.current - 1) === 0
    if (cleared && !foul) {
      g.gameOver = { winner: g.current, text: `${me.name} 击落 8 号球，获胜！` }
    } else {
      g.gameOver = {
        winner: g.current === 1 ? 2 : 1,
        text: `${me.name} 提前击落 8 号球，${opp.name} 获胜！`,
      }
    }
    g.phase = "gameover"
    g.message = g.gameOver.text
    return
  }

  if (eightPocketed && g.shotCount === 0) {
    const eight = g.balls.find((b) => b.id === 8)!
    eight.pocketed = false
    eight.vx = 0
    eight.vy = 0
    eight.x = TABLE_W * 0.72
    eight.y = TABLE_H / 2
    for (let guard = 0; guard < 40; guard++) {
      let overlap = false
      for (const b of g.balls) {
        if (b === eight || b.pocketed) continue
        if (dist(b.x, b.y, eight.x, eight.y) < 2 * BALL_R + 1) {
          eight.x += 4
          overlap = true
        }
      }
      if (!overlap) break
    }
  }

  if (!me.group && !opp.group && legalPocketed.length > 0 && !foul) {
    const first = legalPocketed[0]
    const type: Group = first <= 7 ? "solids" : "stripes"
    me.group = type
    opp.group = type === "solids" ? "stripes" : "solids"
  }

  let continueTurn = false
  if (!foul) {
    if (me.group) {
      const pocketedOwn = legalPocketed.some((id) =>
        me.group === "solids" ? id <= 7 : id >= 9,
      )
      if (pocketedOwn) continueTurn = true
    } else if (legalPocketed.length > 0) {
      continueTurn = true
    }
  }

  if (foul) {
    const cue = g.balls.find((b) => b.id === 0)!
    cue.pocketed = true
    g.current = g.current === 1 ? 2 : 1
    g.phase = "ballInHand"
    g.message = `犯规！${g.players[g.current - 1].name} 自由放球`
  } else if (!continueTurn) {
    g.current = g.current === 1 ? 2 : 1
    g.phase = "ready"
    g.message = `轮到 ${g.players[g.current - 1].name} 击球`
  } else {
    g.phase = "ready"
    g.message = `${me.name} 进球，继续击球！`
  }
}

// ==================== Aim / placement ====================
export function predictAim(g: GameState, cue: Ball, dir: { x: number; y: number }) {
  let x = cue.x + dir.x * BALL_R
  let y = cue.y + dir.y * BALL_R
  const step = 2
  const maxLen = 2400
  for (let t = 0; t < maxLen; t += step) {
    x += dir.x * step
    y += dir.y * step
    if (x < BALL_R || x > TABLE_W - BALL_R || y < BALL_R || y > TABLE_H - BALL_R) {
      return { x, y, type: "wall" as const, hit: null as Ball | null }
    }
    for (const b of g.balls) {
      if (b.pocketed || b.id === 0) continue
      if (dist(b.x, b.y, x, y) < 2 * BALL_R) {
        return { x, y, type: "ball" as const, hit: b }
      }
    }
  }
  return { x, y, type: "none" as const, hit: null as Ball | null }
}

export function isValidPlacement(g: GameState, x: number, y: number) {
  if (x < BALL_R || x > TABLE_W - BALL_R || y < BALL_R || y > TABLE_H - BALL_R) return false
  for (const b of g.balls) {
    if (b.pocketed || b.id === 0) continue
    if (dist(b.x, b.y, x, y) < 2 * BALL_R + 1) return false
  }
  for (const p of POCKETS) {
    if (dist(p.x, p.y, x, y) < POCKET_R + BALL_R) return false
  }
  return true
}

// ==================== Op building (shooter side) ====================
// Begin a shot: set cue velocity, enter shooting phase, clear per-shot trackers.
export function startShot(g: GameState, dirx: number, diry: number, power: number) {
  const cue = g.balls.find((b) => b.id === 0)
  if (!cue || cue.pocketed) return
  cue.vx = dirx * power * POWER_SCALE
  cue.vy = diry * power * POWER_SCALE
  g.phase = "shooting"
  g.pocketedThisShot = []
  g.firstContact = null
  g.shotCount += 1
}

export function buildShotResult(g: GameState): ShotResult {
  return {
    balls: g.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, pocketed: b.pocketed })),
    pocketed: [...g.pocketedThisShot],
  }
}

export function buildMeta(g: GameState): OpMeta {
  return {
    current: g.current,
    phase: g.phase,
    groups: [g.players[0].group, g.players[1].group],
    gameOver: g.gameOver,
    message: g.message,
  }
}

// ==================== Op application (remote replay side) ====================
// Snap local ball positions to the shooter's authoritative result (corrects any
// floating-point drift so the two clients never diverge over many shots).
export function snapToResult(g: GameState, result: ShotResult) {
  for (const r of result.balls) {
    const b = g.balls.find((x) => x.id === r.id)
    if (!b) continue
    b.x = r.x
    b.y = r.y
    b.vx = 0
    b.vy = 0
    b.pocketed = r.pocketed
  }
  g.pocketedThisShot = [...result.pocketed]
}

export function applyMeta(g: GameState, meta: OpMeta) {
  g.current = meta.current
  g.phase = meta.phase
  g.players[0].group = meta.groups[0]
  g.players[1].group = meta.groups[1]
  g.gameOver = meta.gameOver
  if (meta.message) g.message = meta.message
}

// Apply a "place" (ball-in-hand) action locally.
export function applyPlace(g: GameState, x: number, y: number) {
  const cue = g.balls.find((b) => b.id === 0)
  if (!cue) return
  cue.x = x
  cue.y = y
  cue.vx = 0
  cue.vy = 0
  cue.pocketed = false
}
