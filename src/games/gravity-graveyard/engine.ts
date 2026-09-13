export interface Vec2 {
  x: number
  y: number
}

export type AnchorMode = 'pull' | 'repel'

export interface GravityAnchor extends Vec2 {
  id: string
  mode: AnchorMode
  strength: number
}

export interface KinematicBody extends Vec2 {
  vx: number
  vy: number
  radius: number
}

export type RunPhase = 'briefing' | 'active' | 'interlude' | 'ending' | 'victory' | 'defeat'
export type RunAct = 1 | 2 | 3

export interface RunState {
  phase: RunPhase
  act: RunAct
  ritual: number
  score: number
  hull: number
  savedLives: number
  elapsed: number
  modules: string[]
}

export type RunEvent =
  | { type: 'start' }
  | { type: 'tick'; seconds: number }
  | { type: 'damage'; amount: number }
  | { type: 'repair'; amount: number }
  | { type: 'score'; amount: number }
  | { type: 'stabilized'; ritual: number; score: number; savedLives: number }
  | { type: 'choose-module'; moduleId: string }
  | { type: 'finish-ending' }

const GRAVITY_SOFTENING = 80

export function gravityVector(point: Vec2, anchors: GravityAnchor[]): Vec2 {
  return anchors.reduce<Vec2>(
    (total, anchor) => {
      const dx = anchor.x - point.x
      const dy = anchor.y - point.y
      const distance = Math.hypot(dx, dy)
      if (distance < 0.0001) return total

      const direction = anchor.mode === 'pull' ? 1 : -1
      const force = anchor.strength / (distance * distance + GRAVITY_SOFTENING * GRAVITY_SOFTENING)
      total.x += (dx / distance) * force * direction
      total.y += (dy / distance) * force * direction
      return total
    },
    { x: 0, y: 0 },
  )
}

export function integrateBody<T extends KinematicBody>(
  body: T,
  anchors: GravityAnchor[],
  dt: number,
  maxSpeed = 480,
): T {
  const acceleration = gravityVector(body, anchors)
  let vx = body.vx + acceleration.x * dt
  let vy = body.vy + acceleration.y * dt
  const speed = Math.hypot(vx, vy)
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed
    vx *= scale
    vy *= scale
  }

  return {
    ...body,
    x: body.x + vx * dt,
    y: body.y + vy * dt,
    vx,
    vy,
  }
}

export function predictTrajectory(
  body: KinematicBody,
  anchors: GravityAnchor[],
  steps = 28,
  dt = 0.1,
): Vec2[] {
  const points: Vec2[] = []
  let cursor = { ...body }
  for (let index = 0; index < steps; index += 1) {
    cursor = integrateBody(cursor, anchors, dt)
    points.push({ x: cursor.x, y: cursor.y })
  }
  return points
}

export function applyRunEvent(state: RunState, event: RunEvent): RunState {
  switch (event.type) {
    case 'start':
      return { ...state, phase: 'active' }
    case 'tick':
      return { ...state, elapsed: state.elapsed + Math.max(0, event.seconds) }
    case 'score':
      return { ...state, score: Math.max(0, state.score + event.amount) }
    case 'repair':
      return { ...state, hull: Math.min(100, state.hull + Math.max(0, event.amount)) }
    case 'damage': {
      const hull = Math.max(0, state.hull - Math.max(0, event.amount))
      return { ...state, hull, phase: hull === 0 ? 'defeat' : state.phase }
    }
    case 'stabilized': {
      const ritual = Math.min(100, state.ritual + Math.max(0, event.ritual))
      const completed = ritual >= 100
      return {
        ...state,
        ritual,
        score: Math.max(0, state.score + event.score),
        savedLives: state.savedLives + Math.max(0, event.savedLives),
        phase: completed ? 'interlude' : state.phase,
      }
    }
    case 'choose-module':
      if (state.phase !== 'interlude') return state
      return {
        ...state,
        phase: state.act === 3 ? 'ending' : 'active',
        act: Math.min(3, state.act + 1) as RunAct,
        ritual: state.act === 3 ? state.ritual : 0,
        modules: state.modules.includes(event.moduleId)
          ? state.modules
          : [...state.modules, event.moduleId],
      }
    case 'finish-ending':
      return { ...state, phase: 'victory' }
  }
}
