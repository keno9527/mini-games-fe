import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRecord } from '../api'
import {
  applyRunEvent,
  integrateBody,
  predictTrajectory,
  type GravityAnchor,
  type RunAct,
  type RunState,
  type Vec2,
} from './gravity-graveyard/engine'

interface Props {
  userId?: string
  gameId: string
}

type BodyKind = 'wreck' | 'projectile' | 'heretic' | 'cathedral'

interface GraveBody {
  id: number
  kind: BodyKind
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  mass: number
  hp: number
  rotation: number
  spin: number
  stable: number
  age: number
}

interface PlayerBody {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  angle: number
  invulnerable: number
  dashCooldown: number
  shieldCooldown: number
}

interface Particle extends Vec2 {
  vx: number
  vy: number
  life: number
  color: string
}

interface HudSnapshot {
  run: RunState
  anchors: number
  maxAnchors: number
  bossHp: number
  energy: number
  message: string
}

interface ModuleDefinition {
  id: string
  name: string
  glyph: string
  description: string
}

const W = 960
const H = 560
const BURIAL_ZONE = { x: 760, y: 280, radius: 78 }
const UNLOCKS_KEY = 'gravity-graveyard-unlocked-liturgies'

const ACT_COPY: Record<RunAct, { title: string; subtitle: string; objective: string; transmission: string }> = {
  1: {
    title: '第一幕 · 静默墓场',
    subtitle: '为无名星骸完成最后一次稳定轨道。',
    objective: '将星骸低速送入右侧葬环',
    transmission: '“航海日志仍在呼吸……教会为什么宣告我们死亡？”',
  },
  2: {
    title: '第二幕 · 异端回声',
    subtitle: '幸存者开始向葬仪舰开火。',
    objective: '安葬星骸，借引力反杀异端舰',
    transmission: '“葬仪师，别替他们封棺。航道安全，是拿活人换的。”',
  },
  3: {
    title: '第三幕 · 拒葬圣堂',
    subtitle: '旗舰拒绝被世界遗忘。',
    objective: '用星骸与炮火击破圣堂核心',
    transmission: '“这里不是墓。这里保存着三百万个尚未说完的名字。”',
  },
}

const MODULES: ModuleDefinition[] = [
  { id: 'twin-choir', name: '双锚共鸣', glyph: 'Ⅱ', description: '可同时维持两枚引力锚，制造弹弓轨道。' },
  { id: 'choir-lens', name: '圣咏透镜', glyph: '◉', description: '引力锚强度提升 35%，轨道弯折更锐利。' },
  { id: 'reliquary', name: '遗骸圣匣', glyph: '◇', description: '每 12 秒抵消一次碰撞伤害。' },
  { id: 'frozen-psalm', name: '冻结轨迹', glyph: '⌁', description: '预演更长的星骸轨迹，便于精确安葬。' },
  { id: 'mass-offering', name: '质量献祭', glyph: '✦', description: '星骸撞击敌舰的伤害与仪式进度提升。' },
  { id: 'last-prayer', name: '最后祷词', glyph: '✣', description: '相位闪避会释放一次短距斥力脉冲。' },
]

const INITIAL_UNLOCKS = MODULES.slice(0, 3).map(module => module.id)

const initialRun = (): RunState => ({
  phase: 'briefing',
  act: 1,
  ritual: 0,
  score: 0,
  hull: 100,
  savedLives: 0,
  elapsed: 0,
  modules: [],
})

const initialPlayer = (): PlayerBody => ({
  x: 190,
  y: H / 2,
  vx: 0,
  vy: 0,
  radius: 12,
  angle: 0,
  invulnerable: 0,
  dashCooldown: 0,
  shieldCooldown: 0,
})

function loadUnlocks(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(UNLOCKS_KEY) ?? '[]')
    if (!Array.isArray(stored)) return INITIAL_UNLOCKS
    return Array.from(new Set([...INITIAL_UNLOCKS, ...stored.filter(item => typeof item === 'string')]))
  } catch {
    return INITIAL_UNLOCKS
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function distance(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function seededStars() {
  let seed = 7193
  return Array.from({ length: 120 }, () => {
    seed = (seed * 16807) % 2147483647
    const x = (seed / 2147483647) * W
    seed = (seed * 16807) % 2147483647
    const y = (seed / 2147483647) * H
    seed = (seed * 16807) % 2147483647
    return { x, y, size: 0.45 + (seed / 2147483647) * 1.5 }
  })
}

export default function GravityGraveyard({ userId, gameId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)
  const entityIdRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const shotTimerRef = useRef(0)
  const hudTimerRef = useRef(0)
  const startTimeRef = useRef(0)
  const submittedRef = useRef(false)
  const keysRef = useRef(new Set<string>())
  const pointerRef = useRef<Vec2>({ x: W / 2, y: H / 2 })
  const playerRef = useRef<PlayerBody>(initialPlayer())
  const bodiesRef = useRef<GraveBody[]>([])
  const anchorsRef = useRef<GravityAnchor[]>([])
  const particlesRef = useRef<Particle[]>([])
  const runRef = useRef<RunState>(initialRun())
  const bossHpRef = useRef(180)
  const energyRef = useRef(100)
  const messageRef = useRef('等待葬仪许可')
  const audioRef = useRef<{ context: AudioContext; nodes: AudioNode[] } | null>(null)

  const [run, setRun] = useState<RunState>(runRef.current)
  const [hud, setHud] = useState<HudSnapshot>({
    run: runRef.current,
    anchors: 0,
    maxAnchors: 1,
    bossHp: 180,
    energy: 100,
    message: messageRef.current,
  })
  const [unlocked, setUnlocked] = useState<string[]>(loadUnlocks)
  const [choirOn, setChoirOn] = useState(false)
  const [endingChoice, setEndingChoice] = useState('')

  const stars = useMemo(seededStars, [])
  const actCopy = ACT_COPY[run.act]
  const hasModule = useCallback((id: string) => runRef.current.modules.includes(id), [])
  const maxAnchors = hasModule('twin-choir') ? 2 : 1

  const syncHud = useCallback(() => {
    const next = { ...runRef.current, modules: [...runRef.current.modules] }
    setRun(next)
    setHud({
      run: next,
      anchors: anchorsRef.current.length,
      maxAnchors: next.modules.includes('twin-choir') ? 2 : 1,
      bossHp: bossHpRef.current,
      energy: energyRef.current,
      message: messageRef.current,
    })
  }, [])

  const emitParticles = useCallback((x: number, y: number, color: string, amount = 10) => {
    for (let index = 0; index < amount; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = 25 + Math.random() * 105
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.55,
        color,
      })
    }
  }, [])

  const makeBody = useCallback((kind: BodyKind, act: RunAct, overrides: Partial<GraveBody> = {}): GraveBody => {
    entityIdRef.current += 1
    const side = Math.random() > 0.5 ? -1 : 1
    const base: GraveBody = {
      id: entityIdRef.current,
      kind,
      x: kind === 'heretic' ? 720 + Math.random() * 120 : side < 0 ? -40 : W + 40,
      y: 85 + Math.random() * (H - 170),
      vx: side < 0 ? 45 + Math.random() * 35 : -45 - Math.random() * 35,
      vy: -22 + Math.random() * 44,
      radius: kind === 'projectile' ? 5 : kind === 'heretic' ? 17 : 15 + Math.random() * 11,
      mass: kind === 'wreck' ? 1.2 + Math.random() * 1.6 : 1,
      hp: kind === 'heretic' ? 48 + act * 8 : kind === 'cathedral' ? 180 : 1,
      rotation: Math.random() * Math.PI * 2,
      spin: -0.7 + Math.random() * 1.4,
      stable: 0,
      age: 0,
    }
    return { ...base, ...overrides }
  }, [])

  const prepareAct = useCallback((act: RunAct) => {
    anchorsRef.current = []
    particlesRef.current = []
    playerRef.current = initialPlayer()
    energyRef.current = 100
    spawnTimerRef.current = 1.5
    shotTimerRef.current = 1.8
    messageRef.current = ACT_COPY[act].transmission
    const wreckCount = act === 1 ? 5 : 4
    bodiesRef.current = Array.from({ length: wreckCount }, (_, index) => makeBody('wreck', act, {
      x: 350 + index * 72,
      y: 100 + (index % 3) * 155,
      vx: 12 - index * 5,
      vy: index % 2 === 0 ? 24 : -19,
    }))
    if (act >= 2) {
      bodiesRef.current.push(makeBody('heretic', act, { x: 780, y: 120, vx: -14, vy: 28 }))
      if (act === 2) bodiesRef.current.push(makeBody('heretic', act, { x: 835, y: 430, vx: -16, vy: -25 }))
    }
    if (act === 3) {
      bossHpRef.current = 180
      bodiesRef.current = bodiesRef.current.filter(body => body.kind !== 'heretic')
      bodiesRef.current.push(makeBody('cathedral', act, {
        x: BURIAL_ZONE.x,
        y: BURIAL_ZONE.y,
        vx: 0,
        vy: 0,
        radius: 54,
        hp: 180,
        spin: 0.08,
      }))
    }
  }, [makeBody])

  const stopChoir = useCallback(() => {
    if (!audioRef.current) return
    const { context, nodes } = audioRef.current
    nodes.forEach(node => {
      try { node.disconnect() } catch { /* already disconnected */ }
    })
    void context.close()
    audioRef.current = null
    setChoirOn(false)
  }, [])

  const toggleChoir = useCallback(() => {
    if (audioRef.current) {
      stopChoir()
      return
    }
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const master = context.createGain()
    master.gain.value = 0.026
    master.connect(context.destination)
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 520
    filter.Q.value = 0.7
    filter.connect(master)
    const nodes: AudioNode[] = [master, filter]
    ;[55, 82.41, 110].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = index === 1 ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      gain.gain.value = index === 1 ? 0.32 : 0.5
      oscillator.connect(gain)
      gain.connect(filter)
      oscillator.start()
      nodes.push(oscillator, gain)
    })
    audioRef.current = { context, nodes }
    setChoirOn(true)
  }, [stopChoir])

  const startRun = useCallback(() => {
    const next = applyRunEvent(initialRun(), { type: 'start' })
    runRef.current = next
    submittedRef.current = false
    startTimeRef.current = Date.now()
    setEndingChoice('')
    prepareAct(1)
    syncHud()
  }, [prepareAct, syncHud])

  const restartRun = useCallback(() => {
    runRef.current = initialRun()
    playerRef.current = initialPlayer()
    bodiesRef.current = []
    anchorsRef.current = []
    particlesRef.current = []
    bossHpRef.current = 180
    energyRef.current = 100
    messageRef.current = '等待葬仪许可'
    submittedRef.current = false
    setEndingChoice('')
    syncHud()
  }, [syncHud])

  const submitRecord = useCallback(async (result: 'win' | 'lose', score: number) => {
    if (!userId || submittedRef.current) return
    submittedRef.current = true
    const duration = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
    try {
      await createRecord(userId, { gameId, score, duration, result })
    } catch {
      submittedRef.current = false
    }
  }, [gameId, userId])

  const dealDamage = useCallback((amount: number) => {
    const player = playerRef.current
    if (player.invulnerable > 0) return
    if (hasModule('reliquary') && player.shieldCooldown <= 0) {
      player.shieldCooldown = 12
      player.invulnerable = 0.45
      messageRef.current = '遗骸圣匣吞没了撞击'
      emitParticles(player.x, player.y, '#f4d38a', 18)
      return
    }
    const next = applyRunEvent(runRef.current, { type: 'damage', amount })
    runRef.current = next
    player.invulnerable = 0.9
    emitParticles(player.x, player.y, '#d4585c', 18)
    if (next.phase === 'defeat') {
      messageRef.current = '葬仪舰失去回应'
      void submitRecord('lose', next.score)
      syncHud()
    }
  }, [emitParticles, hasModule, submitRecord, syncHud])

  const addRitual = useCallback((ritual: number, score: number, savedLives: number, message: string) => {
    if (runRef.current.phase !== 'active') return
    const previousPhase = runRef.current.phase
    const next = applyRunEvent(runRef.current, { type: 'stabilized', ritual, score, savedLives })
    runRef.current = next
    messageRef.current = message
    if (previousPhase !== next.phase) {
      anchorsRef.current = []
      if (next.phase === 'ending') messageRef.current = ACT_COPY[3].transmission
      syncHud()
    }
  }, [syncHud])

  const chooseModule = useCallback((moduleId: string) => {
    const next = applyRunEvent(runRef.current, { type: 'choose-module', moduleId })
    runRef.current = next
    prepareAct(next.act)
    syncHud()
  }, [prepareAct, syncHud])

  const finishEnding = useCallback((choice: 'burial' | 'release' | 'concord') => {
    const endingScore = choice === 'concord' ? 3400 : choice === 'release' ? 1900 : 2300
    const next = applyRunEvent(
      applyRunEvent(runRef.current, { type: 'score', amount: endingScore }),
      { type: 'finish-ending' },
    )
    runRef.current = next
    setEndingChoice(choice)
    const nextUnlock = MODULES.find(module => !unlocked.includes(module.id))
    if (nextUnlock) {
      const upgraded = [...unlocked, nextUnlock.id]
      window.localStorage.setItem(UNLOCKS_KEY, JSON.stringify(upgraded))
      setUnlocked(upgraded)
      messageRef.current = `新礼器解锁：${nextUnlock.name}`
    }
    syncHud()
    void submitRecord('win', next.score)
  }, [submitRecord, syncHud, unlocked])

  const placeAnchor = useCallback((mode: 'pull' | 'repel', point: Vec2) => {
    if (runRef.current.phase !== 'active') return
    const limit = runRef.current.modules.includes('twin-choir') ? 2 : 1
    const strength = runRef.current.modules.includes('choir-lens') ? 760000 : 560000
    const anchors = anchorsRef.current
    if (anchors.length >= limit) anchors.shift()
    anchors.push({
      id: `anchor-${Date.now()}-${anchors.length}`,
      x: clamp(point.x, 30, W - 30),
      y: clamp(point.y, 30, H - 30),
      mode,
      strength,
    })
    messageRef.current = mode === 'pull' ? '牵引圣印已落下' : '斥力圣印已落下'
    syncHud()
  }, [syncHud])

  const pointerPosition = useCallback((event: React.PointerEvent<HTMLCanvasElement>): Vec2 => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    }
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current = pointerPosition(event)
  }, [pointerPosition])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointerPosition(event)
    pointerRef.current = point
    placeAnchor(event.button === 2 ? 'repel' : 'pull', point)
  }, [placeAnchor, pointerPosition])

  const performDash = useCallback(() => {
    if (runRef.current.phase !== 'active') return
    const player = playerRef.current
    if (player.dashCooldown > 0 || energyRef.current < 32) return
    let dx = Number(keysRef.current.has('d') || keysRef.current.has('arrowright')) - Number(keysRef.current.has('a') || keysRef.current.has('arrowleft'))
    let dy = Number(keysRef.current.has('s') || keysRef.current.has('arrowdown')) - Number(keysRef.current.has('w') || keysRef.current.has('arrowup'))
    if (dx === 0 && dy === 0) {
      dx = Math.cos(player.angle)
      dy = Math.sin(player.angle)
    }
    const length = Math.hypot(dx, dy) || 1
    player.vx += (dx / length) * 330
    player.vy += (dy / length) * 330
    player.invulnerable = 0.55
    player.dashCooldown = 1.2
    energyRef.current -= 32
    emitParticles(player.x, player.y, '#e6d093', 22)
    if (hasModule('last-prayer')) {
      bodiesRef.current = bodiesRef.current.map(body => {
        const dxBody = body.x - player.x
        const dyBody = body.y - player.y
        const dist = Math.hypot(dxBody, dyBody)
        if (dist === 0 || dist > 120 || body.kind === 'cathedral') return body
        return { ...body, vx: body.vx + (dxBody / dist) * 190, vy: body.vy + (dyBody / dist) * 190 }
      })
    }
  }, [emitParticles, hasModule])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'q', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault()
      }
      keysRef.current.add(key)
      if (event.repeat) return
      if (key === ' ') performDash()
      if (key === 'q' && runRef.current.phase === 'active') {
        anchorsRef.current.pop()
        messageRef.current = '圣印已回收'
        syncHud()
      }
    }
    const keyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase())
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
    }
  }, [performDash, syncHud])

  const update = useCallback((dt: number) => {
    const currentRun = runRef.current
    if (currentRun.phase !== 'active') return
    runRef.current = applyRunEvent(currentRun, { type: 'tick', seconds: dt })

    const player = playerRef.current
    const keys = keysRef.current
    const inputX = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'))
    const inputY = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'))
    const inputLength = Math.hypot(inputX, inputY) || 1
    if (inputX || inputY) {
      player.vx += (inputX / inputLength) * 240 * dt
      player.vy += (inputY / inputLength) * 240 * dt
    }
    const gravityPlayer = integrateBody(player, anchorsRef.current, dt, 360)
    player.x = clamp(gravityPlayer.x, 18, W - 18)
    player.y = clamp(gravityPlayer.y, 18, H - 18)
    player.vx = gravityPlayer.vx * Math.pow(0.985, dt * 60)
    player.vy = gravityPlayer.vy * Math.pow(0.985, dt * 60)
    player.angle = Math.atan2(pointerRef.current.y - player.y, pointerRef.current.x - player.x)
    player.invulnerable = Math.max(0, player.invulnerable - dt)
    player.dashCooldown = Math.max(0, player.dashCooldown - dt)
    player.shieldCooldown = Math.max(0, player.shieldCooldown - dt)
    energyRef.current = Math.min(100, energyRef.current + 14 * dt)

    spawnTimerRef.current -= dt
    const wrecks = bodiesRef.current.filter(body => body.kind === 'wreck').length
    if (spawnTimerRef.current <= 0 && wrecks < 7) {
      bodiesRef.current.push(makeBody('wreck', currentRun.act))
      spawnTimerRef.current = currentRun.act === 1 ? 3.7 : 3.1
    }

    shotTimerRef.current -= dt
    const shooters = bodiesRef.current.filter(body => body.kind === 'heretic' || body.kind === 'cathedral')
    if (shotTimerRef.current <= 0 && shooters.length > 0) {
      shooters.forEach(shooter => {
        const dx = player.x - shooter.x
        const dy = player.y - shooter.y
        const length = Math.hypot(dx, dy) || 1
        const speed = shooter.kind === 'cathedral' ? 155 : 135
        bodiesRef.current.push(makeBody('projectile', currentRun.act, {
          x: shooter.x + (dx / length) * (shooter.radius + 8),
          y: shooter.y + (dy / length) * (shooter.radius + 8),
          vx: (dx / length) * speed,
          vy: (dy / length) * speed,
          radius: shooter.kind === 'cathedral' ? 7 : 5,
        }))
      })
      shotTimerRef.current = currentRun.act === 3 ? 1.35 : 2.15
    }

    const removed = new Set<number>()
    const damageScale = hasModule('mass-offering') ? 1.55 : 1
    bodiesRef.current = bodiesRef.current.map(body => {
      if (body.kind === 'cathedral') {
        return { ...body, rotation: body.rotation + body.spin * dt, age: body.age + dt }
      }
      const next = integrateBody(body, anchorsRef.current, dt, body.kind === 'projectile' ? 520 : 330)
      next.rotation += next.spin * dt
      next.age += dt
      if (next.kind !== 'projectile') {
        if (next.x < next.radius && next.vx < 0) next.vx *= -0.72
        if (next.x > W - next.radius && next.vx > 0) next.vx *= -0.72
        if (next.y < next.radius && next.vy < 0) next.vy *= -0.72
        if (next.y > H - next.radius && next.vy > 0) next.vy *= -0.72
        next.x = clamp(next.x, next.radius, W - next.radius)
        next.y = clamp(next.y, next.radius, H - next.radius)
      }
      if (next.kind === 'projectile' && (next.age > 11 || next.x < -60 || next.x > W + 60 || next.y < -60 || next.y > H + 60)) {
        removed.add(next.id)
      }
      return next
    })

    const targets = bodiesRef.current.filter(body => body.kind === 'heretic' || body.kind === 'cathedral')
    for (const body of bodiesRef.current) {
      if (removed.has(body.id)) continue
      if (body.kind === 'wreck' && currentRun.act < 3) {
        const speed = Math.hypot(body.vx, body.vy)
        if (distance(body, BURIAL_ZONE) < BURIAL_ZONE.radius - body.radius && speed < 112) {
          body.stable += dt
          if (body.stable >= 1.15) {
            removed.add(body.id)
            emitParticles(body.x, body.y, '#e4c67d', 24)
            addRitual(currentRun.act === 1 ? 24 : 20, 520 + Math.round(body.mass * 100), currentRun.act === 1 ? 36 : 54, '星骸已进入安息轨道')
          }
        } else {
          body.stable = Math.max(0, body.stable - dt * 0.8)
        }
      }

      if (body.kind === 'projectile' || body.kind === 'wreck') {
        const speed = Math.hypot(body.vx, body.vy)
        for (const target of targets) {
          if (target.id === body.id || removed.has(target.id)) continue
          if (distance(body, target) > body.radius + target.radius) continue
          if (speed < (body.kind === 'wreck' ? 105 : 70)) continue
          const baseDamage = body.kind === 'wreck' ? (22 + body.mass * 12) * damageScale : 18
          target.hp -= baseDamage
          removed.add(body.id)
          emitParticles(body.x, body.y, target.kind === 'cathedral' ? '#f0cb70' : '#b45b62', 20)
          if (target.kind === 'cathedral') {
            bossHpRef.current = Math.max(0, target.hp)
            addRitual((baseDamage / 180) * 100, Math.round(baseDamage * 24), 0, '圣堂核心轨道正在崩解')
            if (target.hp <= 0) removed.add(target.id)
          } else if (target.hp <= 0) {
            removed.add(target.id)
            addRitual(16, 780, 42, '异端舰的信标沉默了')
          }
          break
        }
      }

      if (body.kind !== 'cathedral' && distance(body, player) < body.radius + player.radius) {
        const hostileImpact = body.kind === 'projectile' || body.kind === 'heretic'
        const speed = Math.hypot(body.vx - player.vx, body.vy - player.vy)
        if (hostileImpact || speed > 135) {
          dealDamage(body.kind === 'projectile' ? 14 : body.kind === 'heretic' ? 22 : 6)
          if (body.kind === 'projectile') removed.add(body.id)
          const dx = player.x - body.x
          const dy = player.y - body.y
          const length = Math.hypot(dx, dy) || 1
          player.vx += (dx / length) * 95
          player.vy += (dy / length) * 95
          if (body.kind === 'wreck') {
            body.vx -= (dx / length) * 70
            body.vy -= (dy / length) * 70
          }
        }
      }
    }
    bodiesRef.current = bodiesRef.current.filter(body => !removed.has(body.id))

    particlesRef.current = particlesRef.current
      .map(particle => ({
        ...particle,
        x: particle.x + particle.vx * dt,
        y: particle.y + particle.vy * dt,
        vx: particle.vx * 0.98,
        vy: particle.vy * 0.98,
        life: particle.life - dt,
      }))
      .filter(particle => particle.life > 0)

    hudTimerRef.current += dt
    if (hudTimerRef.current > 0.12) {
      hudTimerRef.current = 0
      syncHud()
    }
  }, [addRitual, dealDamage, emitParticles, hasModule, makeBody, syncHud])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const background = ctx.createRadialGradient(W * 0.72, H * 0.42, 40, W * 0.55, H * 0.5, W * 0.72)
    background.addColorStop(0, '#3b111a')
    background.addColorStop(0.42, '#19090e')
    background.addColorStop(1, '#050507')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, W, H)

    ctx.save()
    ctx.globalAlpha = 0.12
    ctx.strokeStyle = '#9b3946'
    ctx.lineWidth = 38
    ctx.beginPath()
    ctx.arc(W * 0.58, H * 1.1, 430, Math.PI * 1.08, Math.PI * 1.92)
    ctx.stroke()
    ctx.lineWidth = 2
    for (let index = 0; index < 8; index += 1) {
      const x = 65 + index * 126
      ctx.beginPath()
      ctx.moveTo(x, H)
      ctx.lineTo(x + 32, H - 110 - (index % 3) * 34)
      ctx.lineTo(x + 64, H)
      ctx.stroke()
    }
    ctx.restore()

    stars.forEach(star => {
      ctx.fillStyle = `rgba(237, 215, 166, ${0.25 + star.size * 0.18})`
      ctx.fillRect(star.x, star.y, star.size, star.size)
    })

    const currentRun = runRef.current
    if (currentRun.act < 3) {
      const pulse = 1 + Math.sin(performance.now() / 650) * 0.045
      ctx.save()
      ctx.translate(BURIAL_ZONE.x, BURIAL_ZONE.y)
      ctx.scale(pulse, pulse)
      ctx.strokeStyle = 'rgba(224, 190, 116, .72)'
      ctx.shadowColor = '#d6a955'
      ctx.shadowBlur = 18
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, BURIAL_ZONE.radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([4, 10])
      ctx.rotate(performance.now() / 16000)
      ctx.beginPath()
      ctx.arc(0, 0, BURIAL_ZONE.radius + 13, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(218, 181, 106, .75)'
      for (let index = 0; index < 8; index += 1) {
        ctx.rotate(Math.PI / 4)
        ctx.fillRect(BURIAL_ZONE.radius + 20, -1, 12, 2)
      }
      ctx.restore()
    }

    anchorsRef.current.forEach((anchor, index) => {
      const color = anchor.mode === 'pull' ? '#e4c67d' : '#c95d66'
      ctx.save()
      ctx.translate(anchor.x, anchor.y)
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 16
      ctx.lineWidth = 2
      const spin = performance.now() / (anchor.mode === 'pull' ? 900 : -900)
      ctx.rotate(spin + index)
      ctx.beginPath()
      ctx.arc(0, 0, 22, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([4, 7])
      ctx.beginPath()
      ctx.arc(0, 0, 39, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      for (let mark = 0; mark < 6; mark += 1) {
        ctx.rotate(Math.PI / 3)
        ctx.fillStyle = color
        ctx.fillRect(25, -1, 9, 2)
      }
      ctx.restore()
    })

    const previewBody = bodiesRef.current.find(body => body.kind === 'wreck')
    if (previewBody && anchorsRef.current.length > 0) {
      const points = predictTrajectory(previewBody, anchorsRef.current, hasModule('frozen-psalm') ? 54 : 30, 0.075)
      ctx.save()
      ctx.strokeStyle = 'rgba(236, 211, 153, .34)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 6])
      ctx.beginPath()
      ctx.moveTo(previewBody.x, previewBody.y)
      points.forEach(point => ctx.lineTo(point.x, point.y))
      ctx.stroke()
      ctx.restore()
    }

    bodiesRef.current.forEach(body => {
      ctx.save()
      ctx.translate(body.x, body.y)
      ctx.rotate(body.rotation)
      if (body.kind === 'wreck') {
        const stableGlow = clamp(body.stable / 1.15, 0, 1)
        ctx.shadowColor = '#e6c67b'
        ctx.shadowBlur = stableGlow * 24
        ctx.fillStyle = stableGlow > 0 ? '#d4b775' : '#776c63'
        ctx.strokeStyle = '#b2a28d'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(-body.radius, body.radius * 0.6)
        ctx.lineTo(-body.radius * 0.45, -body.radius * 0.55)
        ctx.lineTo(0, -body.radius)
        ctx.lineTo(body.radius * 0.32, -body.radius * 0.25)
        ctx.lineTo(body.radius, -body.radius * 0.05)
        ctx.lineTo(body.radius * 0.25, body.radius * 0.75)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.strokeStyle = 'rgba(246, 225, 177, .48)'
        ctx.beginPath()
        ctx.moveTo(-body.radius * 0.5, body.radius * 0.3)
        ctx.lineTo(body.radius * 0.25, -body.radius * 0.45)
        ctx.stroke()
      } else if (body.kind === 'projectile') {
        ctx.fillStyle = '#d95562'
        ctx.shadowColor = '#ef4356'
        ctx.shadowBlur = 14
        ctx.beginPath()
        ctx.arc(0, 0, body.radius, 0, Math.PI * 2)
        ctx.fill()
      } else if (body.kind === 'heretic') {
        ctx.fillStyle = '#702b36'
        ctx.strokeStyle = '#d06772'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(body.radius, 0)
        ctx.lineTo(-body.radius * 0.8, -body.radius * 0.65)
        ctx.lineTo(-body.radius * 0.35, 0)
        ctx.lineTo(-body.radius * 0.8, body.radius * 0.65)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#ee9a9f'
        ctx.fillRect(-4, -2, 9, 4)
      } else {
        ctx.shadowColor = '#b33d4b'
        ctx.shadowBlur = 28
        ctx.fillStyle = '#241217'
        ctx.strokeStyle = '#d0ae6b'
        ctx.lineWidth = 2
        for (let spire = 0; spire < 8; spire += 1) {
          ctx.rotate(Math.PI / 4)
          ctx.beginPath()
          ctx.moveTo(18, -9)
          ctx.lineTo(body.radius + (spire % 2) * 18, 0)
          ctx.lineTo(18, 9)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.arc(0, 0, 25, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#8f2938'
        ctx.beginPath()
        ctx.arc(0, 0, 10, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    })

    particlesRef.current.forEach(particle => {
      ctx.globalAlpha = clamp(particle.life * 1.8, 0, 1)
      ctx.fillStyle = particle.color
      ctx.fillRect(particle.x - 1.5, particle.y - 1.5, 3, 3)
    })
    ctx.globalAlpha = 1

    const player = playerRef.current
    ctx.save()
    ctx.translate(player.x, player.y)
    ctx.rotate(player.angle)
    if (player.invulnerable > 0 && Math.floor(performance.now() / 70) % 2 === 0) ctx.globalAlpha = 0.35
    ctx.shadowColor = '#f1d58f'
    ctx.shadowBlur = 12
    ctx.fillStyle = '#eee8d9'
    ctx.strokeStyle = '#d2ae62'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(18, 0)
    ctx.lineTo(-11, -9)
    ctx.lineTo(-5, 0)
    ctx.lineTo(-11, 9)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#a5424d'
    ctx.fillRect(-13, -3, 7, 6)
    ctx.restore()

    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,.58)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, W, H)
  }, [hasModule, stars])

  useEffect(() => {
    const frame = (time: number) => {
      const dt = lastFrameRef.current ? Math.min(0.033, (time - lastFrameRef.current) / 1000) : 0
      lastFrameRef.current = time
      update(dt)
      draw()
      frameRef.current = requestAnimationFrame(frame)
    }
    frameRef.current = requestAnimationFrame(frame)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      stopChoir()
    }
  }, [draw, stopChoir, update])

  const moduleOptions = useMemo(() => {
    const available = MODULES.filter(module => unlocked.includes(module.id) && !run.modules.includes(module.id))
    return available.slice(0, 3)
  }, [run.modules, unlocked])

  const concordUnlocked = run.hull >= 55 && run.savedLives >= 140
  const endingCopy = endingChoice === 'burial'
    ? '你完成了葬仪。殖民地灯火没有熄灭，三百万个名字却永远沉默。'
    : endingChoice === 'release'
      ? '你打破圣轨。旗舰载着亡者驶入黑暗，航道警报在身后逐一亮起。'
      : '你献出葬仪舰作为第三枚引力锚。圣轨与旗舰同时稳定，而你的名字进入了最后一份记录。'

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-[#80613b]/50 bg-[#070608] text-[#eee7d8] shadow-[0_28px_80px_rgba(0,0,0,.55)]">
      <div className="relative border-b border-[#80613b]/35 px-5 py-4 sm:px-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_-20%,rgba(128,30,43,.4),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.34em] text-[#c9a967]">
              <span className="h-px w-7 bg-[#c9a967]" /> Holy Orbit Funeral Office
            </div>
            <h2 className="font-serif text-2xl font-semibold tracking-[.12em] text-[#f5eddd] sm:text-3xl">引力墓场</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={toggleChoir}
              className="rounded-full border border-[#80613b]/55 px-3 py-2 text-[#d7c7a5] transition hover:border-[#d2ae62] hover:text-white"
            >
              {choirOn ? '关闭圣咏' : '开启圣咏'}
            </button>
            <span className="rounded-full border border-[#6e2632] bg-[#2a0d13] px-3 py-2 text-[#d99aa2]">礼器藏库 {unlocked.length}/6</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onContextMenu={event => event.preventDefault()}
          aria-label="引力墓场游戏区域"
          className="block aspect-[12/7] w-full cursor-crosshair bg-black outline-none"
        />

        {run.phase === 'active' && (
          <>
            <div className="pointer-events-none absolute left-4 top-4 max-w-[52%] rounded-xl border border-[#8c6a40]/45 bg-[#080609]/80 px-4 py-3 backdrop-blur-md sm:left-6 sm:top-6">
              <div className="text-[10px] font-bold uppercase tracking-[.24em] text-[#c6a35c]">{ACT_COPY[hud.run.act].title}</div>
              <div className="mt-1 text-sm text-[#e5dcc9]">{ACT_COPY[hud.run.act].objective}</div>
              <div className="mt-2 line-clamp-1 text-[11px] italic text-[#a99c8a]">{hud.message}</div>
            </div>
            <div className="pointer-events-none absolute right-4 top-4 w-44 rounded-xl border border-[#8c6a40]/45 bg-[#080609]/80 p-3 text-[10px] backdrop-blur-md sm:right-6 sm:top-6 sm:w-52">
              <div className="mb-1 flex justify-between tracking-[.16em] text-[#c7b794]"><span>葬仪进度</span><span>{Math.round(hud.run.ritual)}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#342b26]"><div className="h-full bg-gradient-to-r from-[#9d3140] to-[#d2ae62] transition-all" style={{ width: `${hud.run.ritual}%` }} /></div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[#aea18e]">
                <span>舰体 <b className="text-[#eee1c7]">{Math.round(hud.run.hull)}</b></span>
                <span>相位 <b className="text-[#eee1c7]">{Math.round(hud.energy)}</b></span>
                <span>存档生命 <b className="text-[#eee1c7]">{hud.run.savedLives}</b></span>
                <span>得分 <b className="text-[#eee1c7]">{hud.run.score}</b></span>
              </div>
              {hud.run.act === 3 && <div className="mt-2 border-t border-[#6e2632]/55 pt-2 text-[#dc8690]">圣堂核心 {Math.ceil(hud.bossHp)} / 180</div>}
            </div>
            <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#8c6a40]/35 bg-[#080609]/75 px-4 py-2 text-[9px] uppercase tracking-[.14em] text-[#b7aa94] backdrop-blur-md sm:text-[10px]">
              <span><b className="text-[#e5c87d]">WASD</b> 惯性航行</span><span className="text-[#5c4a35]">/</span>
              <span><b className="text-[#e5c87d]">左键</b> 牵引</span><span className="text-[#5c4a35]">/</span>
              <span><b className="text-[#c96670]">右键</b> 斥力</span><span className="text-[#5c4a35]">/</span>
              <span><b className="text-[#e5c87d]">空格</b> 相位</span><span className="text-[#5c4a35]">/</span>
              <span><b className="text-[#e5c87d]">Q</b> 回收</span>
            </div>
          </>
        )}

        {run.phase === 'briefing' && (
          <div className="absolute inset-0 flex items-end bg-[#030304]/35">
            <img src="/covers/gravity-graveyard.png" alt="教堂星舰构成的引力墓场" className="absolute inset-0 h-full w-full object-cover opacity-75" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#070608] via-[#070608]/75 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070608] via-transparent to-[#070608]/25" />
            <div className="relative max-w-xl px-7 pb-8 sm:px-10 sm:pb-11">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[.36em] text-[#d2ae62]">Burial order 7193</div>
              <h3 className="font-serif text-3xl leading-tight text-[#fff8e9] sm:text-5xl">给死者轨道，<br />给生者真相。</h3>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#c7baa5]">你是圣轨教会的星骸葬仪师。没有炮口，只有引力。牵引残骸、折返敌火，在三幕葬仪里决定三百万个意识是否该被埋葬。</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" onClick={startRun} className="rounded-full border border-[#e1c176] bg-[#d2ae62] px-6 py-3 text-xs font-black tracking-[.2em] text-[#17100a] shadow-[0_0_30px_rgba(210,174,98,.28)] transition hover:bg-[#ead18d]">接受葬仪</button>
                <span className="text-[11px] text-[#9f927e]">桌面端 · 键鼠 · 单局约 10–15 分钟</span>
              </div>
            </div>
          </div>
        )}

        {run.phase === 'interlude' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050406]/90 p-5 backdrop-blur-sm">
            <div className="w-full max-w-3xl">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-[.3em] text-[#c6a35c]">Act {run.act} completed</div>
                <h3 className="mt-2 font-serif text-3xl text-[#f3e8d1]">从遗言中取一件礼器</h3>
                <p className="mt-2 text-sm text-[#998e7b]">数值不会带入下一局。新的规则，会。</p>
              </div>
              <div className="mt-7 grid gap-3 md:grid-cols-3">
                {moduleOptions.map(module => (
                  <button key={module.id} type="button" onClick={() => chooseModule(module.id)} className="group min-h-44 rounded-2xl border border-[#735c3c] bg-[#130d0e] p-5 text-left transition hover:-translate-y-1 hover:border-[#d2ae62] hover:bg-[#1c1113]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#7d633e] font-serif text-xl text-[#e2c478] group-hover:shadow-[0_0_20px_rgba(210,174,98,.25)]">{module.glyph}</span>
                    <strong className="mt-5 block font-serif text-lg text-[#eee2ca]">{module.name}</strong>
                    <span className="mt-2 block text-xs leading-5 text-[#9f9482]">{module.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {run.phase === 'ending' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050406]/94 p-5 backdrop-blur-md">
            <div className="w-full max-w-4xl text-center">
              <div className="text-[10px] font-bold uppercase tracking-[.34em] text-[#bc8d45]">Final liturgy</div>
              <h3 className="mt-3 font-serif text-3xl text-[#f3e8d1] sm:text-4xl">你要埋葬什么？</h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#a99c89]">圣堂核心已经安静。殖民地航道、旗舰里的意识，以及你的葬仪舰，只有两者能保持稳定。</p>
              <div className="mt-7 grid gap-3 md:grid-cols-3">
                <button type="button" onClick={() => finishEnding('burial')} className="rounded-2xl border border-[#80633c] bg-[#17100e] p-5 text-left transition hover:border-[#dfbd72]">
                  <span className="text-[10px] uppercase tracking-[.18em] text-[#c4a15c]">教会结局</span><strong className="mt-2 block font-serif text-xl">完成葬仪</strong><span className="mt-3 block text-xs leading-5 text-[#a69a87]">埋葬旗舰，确保殖民地航道绝对安全。</span>
                </button>
                <button type="button" onClick={() => finishEnding('release')} className="rounded-2xl border border-[#6d2834] bg-[#190d11] p-5 text-left transition hover:border-[#c95160]">
                  <span className="text-[10px] uppercase tracking-[.18em] text-[#c96d77]">异端结局</span><strong className="mt-2 block font-serif text-xl">打破圣轨</strong><span className="mt-3 block text-xs leading-5 text-[#a69a87]">释放旗舰，让所有名字自己选择终点。</span>
                </button>
                <button type="button" disabled={!concordUnlocked} onClick={() => finishEnding('concord')} className="rounded-2xl border border-[#7e744e] bg-[#121312] p-5 text-left transition enabled:hover:border-[#d7d09b] disabled:cursor-not-allowed disabled:opacity-35">
                  <span className="text-[10px] uppercase tracking-[.18em] text-[#d0c98f]">隐秘结局</span><strong className="mt-2 block font-serif text-xl">成为第三枚锚</strong><span className="mt-3 block text-xs leading-5 text-[#a69a87]">{concordUnlocked ? '献出葬仪舰，同时稳定圣轨与旗舰。' : '需要舰体 ≥ 55、存档生命 ≥ 140。'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {(run.phase === 'victory' || run.phase === 'defeat') && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050406]/94 p-6 backdrop-blur-md">
            <div className="max-w-xl text-center">
              <div className={`text-[10px] font-bold uppercase tracking-[.34em] ${run.phase === 'victory' ? 'text-[#c6a35c]' : 'text-[#bd5360]'}`}>{run.phase === 'victory' ? 'Funeral completed' : 'Vessel lost'}</div>
              <h3 className="mt-3 font-serif text-4xl text-[#f3e8d1]">{run.phase === 'victory' ? '葬仪结束' : '墓场没有回应'}</h3>
              <p className="mx-auto mt-4 text-sm leading-6 text-[#aaa08e]">{run.phase === 'victory' ? endingCopy : '你的舰体成为了下一具星骸。但所有已记录的名字，仍留在航道里。'}</p>
              <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 divide-x divide-[#5e4a31] rounded-2xl border border-[#654e32] bg-[#100c0c] py-4 text-xs">
                <div><span className="block text-[#8f8474]">得分</span><strong className="mt-1 block text-lg text-[#e5c87d]">{run.score}</strong></div>
                <div><span className="block text-[#8f8474]">存档生命</span><strong className="mt-1 block text-lg text-[#e5c87d]">{run.savedLives}</strong></div>
                <div><span className="block text-[#8f8474]">用时</span><strong className="mt-1 block text-lg text-[#e5c87d]">{Math.max(1, Math.round(run.elapsed / 60))}′</strong></div>
              </div>
              <button type="button" onClick={restartRun} className="mt-7 rounded-full border border-[#d2ae62] px-6 py-3 text-xs font-bold tracking-[.18em] text-[#e9d59d] transition hover:bg-[#d2ae62] hover:text-[#161008]">重新校准轨道</button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 border-t border-[#80613b]/30 bg-[#0b0809] px-5 py-4 text-xs text-[#9d9280] sm:grid-cols-[1fr_auto] sm:px-7">
        <p><span className="mr-2 text-[#c5a25d]">葬仪原则</span>{actCopy.subtitle}</p>
        <p className="font-mono text-[10px] uppercase tracking-[.14em]">anchors {hud.anchors}/{hud.maxAnchors} · no direct weapons</p>
      </div>
    </section>
  )
}
