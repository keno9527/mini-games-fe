import { useEffect, useMemo, useRef, useState } from 'react'
import { createRecord } from '../api'
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  ENEMY_DEFINITIONS,
  PATH_POINTS,
  PATH_TILES,
  TOWER_DEFINITIONS,
  WAVES,
  canPlaceTower,
  createGameState,
  getEnemyPosition,
  getTowerStats,
  getUpgradeCost,
  placeTower,
  sellTower,
  startNextWave,
  stepGame,
  togglePause,
  upgradeTower,
  type GameState,
  type TowerKind,
} from './tower-defense/engine'

interface Props {
  userId?: string
  gameId: string
}

const CANVAS_WIDTH = 960
const CANVAS_HEIGHT = 640
const TILE_SIZE = CANVAS_WIDTH / BOARD_COLUMNS
const TOWER_ORDER: TowerKind[] = ['sprout', 'frost', 'cannon']

export default function TowerDefense({ userId, gameId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const submittedRef = useRef(false)
  const [game, setGame] = useState<GameState>(createGameState)
  const [selectedKind, setSelectedKind] = useState<TowerKind>('sprout')
  const [selectedTowerId, setSelectedTowerId] = useState<number | null>(null)
  const [hoverTile, setHoverTile] = useState<{ column: number; row: number } | null>(null)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const [notice, setNotice] = useState('先在草地上布置守卫，再开启第一波。')

  const selectedTower = useMemo(
    () => game.towers.find(tower => tower.id === selectedTowerId) ?? null,
    [game.towers, selectedTowerId],
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGame(current => stepGame(current, 0.05 * speed))
    }, 50)
    return () => window.clearInterval(timer)
  }, [speed])

  useEffect(() => {
    if (game.phase === 'victory') {
      setNotice('晨芽守住了！整片绿野重新亮了起来。')
    } else if (game.phase === 'defeat') {
      setNotice('防线失守了。调整塔位，再试一次吧。')
    } else if (game.phase === 'ready' && game.wave > 0) {
      setNotice(`第 ${game.wave} 波已清除，防线获得了补给。`)
    }
  }, [game.phase, game.wave])

  useEffect(() => {
    if ((game.phase !== 'victory' && game.phase !== 'defeat') || submittedRef.current || !userId) return
    submittedRef.current = true
    createRecord(userId, {
      gameId,
      score: game.score,
      duration: game.elapsed,
      result: game.phase === 'victory' ? 'win' : 'lose',
    }).catch(() => {})
  }, [game.elapsed, game.phase, game.score, gameId, userId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    const gradient = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, '#7fbd65')
    gradient.addColorStop(1, '#4c8f53')
    context.fillStyle = gradient
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let column = 0; column < BOARD_COLUMNS; column += 1) {
        context.fillStyle = (row + column) % 2 === 0
          ? 'rgba(218, 241, 159, 0.055)'
          : 'rgba(17, 73, 48, 0.045)'
        context.fillRect(column * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE)

        const seed = (row * 19 + column * 31) % 7
        if (seed < 3 && !PATH_TILES.some(([pathColumn, pathRow]) => pathColumn === column && pathRow === row)) {
          context.fillStyle = seed === 0 ? '#d8ef92' : '#6dab53'
          context.beginPath()
          context.arc(column * TILE_SIZE + 18 + seed * 11, row * TILE_SIZE + 20 + seed * 13, 2.5, 0, Math.PI * 2)
          context.fill()
        }
      }
    }

    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    PATH_POINTS.forEach((point, index) => {
      const x = point.x * TILE_SIZE
      const y = point.y * TILE_SIZE
      if (index === 0) context.moveTo(-TILE_SIZE, y)
      context.lineTo(x, y)
    })
    context.lineTo(CANVAS_WIDTH + TILE_SIZE, PATH_POINTS.at(-1)!.y * TILE_SIZE)
    context.strokeStyle = '#765c3f'
    context.lineWidth = 62
    context.stroke()
    context.strokeStyle = '#c39a61'
    context.lineWidth = 52
    context.stroke()
    context.setLineDash([7, 13])
    context.strokeStyle = 'rgba(255, 226, 154, 0.38)'
    context.lineWidth = 3
    context.stroke()
    context.setLineDash([])

    const basePoint = PATH_POINTS.at(-1)!
    const baseX = basePoint.x * TILE_SIZE
    const baseY = basePoint.y * TILE_SIZE
    context.fillStyle = '#f5e7b5'
    context.beginPath()
    context.arc(baseX, baseY, 30, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = '#315f3d'
    context.lineWidth = 6
    context.stroke()
    context.fillStyle = '#65b85b'
    context.beginPath()
    context.arc(baseX, baseY, 14, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#f4ffd4'
    context.beginPath()
    context.arc(baseX - 5, baseY - 6, 4, 0, Math.PI * 2)
    context.fill()

    if (hoverTile && !game.towers.some(tower => tower.column === hoverTile.column && tower.row === hoverTile.row)) {
      const placement = canPlaceTower(game, selectedKind, hoverTile.column, hoverTile.row)
      context.fillStyle = placement.ok ? 'rgba(235, 255, 169, 0.32)' : 'rgba(239, 91, 80, 0.28)'
      context.fillRect(
        hoverTile.column * TILE_SIZE + 4,
        hoverTile.row * TILE_SIZE + 4,
        TILE_SIZE - 8,
        TILE_SIZE - 8,
      )
      if (placement.ok) {
        context.strokeStyle = 'rgba(244, 255, 205, 0.65)'
        context.lineWidth = 2
        context.beginPath()
        context.arc(
          (hoverTile.column + 0.5) * TILE_SIZE,
          (hoverTile.row + 0.5) * TILE_SIZE,
          TOWER_DEFINITIONS[selectedKind].range * TILE_SIZE,
          0,
          Math.PI * 2,
        )
        context.stroke()
      }
    }

    if (selectedTower) {
      context.fillStyle = 'rgba(224, 255, 177, 0.1)'
      context.strokeStyle = '#efffb2'
      context.lineWidth = 2
      context.beginPath()
      context.arc(
        (selectedTower.column + 0.5) * TILE_SIZE,
        (selectedTower.row + 0.5) * TILE_SIZE,
        getTowerStats(selectedTower).range * TILE_SIZE,
        0,
        Math.PI * 2,
      )
      context.fill()
      context.stroke()
    }

    game.towers.forEach(tower => {
      const x = (tower.column + 0.5) * TILE_SIZE
      const y = (tower.row + 0.5) * TILE_SIZE
      const definition = TOWER_DEFINITIONS[tower.kind]
      const isSelected = tower.id === selectedTowerId

      context.fillStyle = 'rgba(31, 63, 35, 0.3)'
      context.beginPath()
      context.ellipse(x, y + 22, 27, 10, 0, 0, Math.PI * 2)
      context.fill()
      if (isSelected) {
        context.strokeStyle = '#fff49b'
        context.lineWidth = 4
        context.beginPath()
        context.arc(x, y, 31, 0, Math.PI * 2)
        context.stroke()
      }

      context.fillStyle = '#6b482d'
      context.fillRect(x - 7, y + 2, 14, 24)
      context.fillStyle = definition.color
      context.beginPath()
      context.arc(x, y - 6, tower.kind === 'cannon' ? 22 : 19, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = '#243d2f'
      context.lineWidth = 3
      context.stroke()

      if (tower.kind === 'sprout') {
        context.fillStyle = definition.accent
        context.beginPath()
        context.arc(x + 13, y - 9, 9, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#284a30'
        context.beginPath()
        context.arc(x + 17, y - 11, 3, 0, Math.PI * 2)
        context.fill()
      } else if (tower.kind === 'frost') {
        context.fillStyle = definition.accent
        context.beginPath()
        context.arc(x, y - 7, 10, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#e5ffff'
        context.beginPath()
        context.arc(x - 3, y - 11, 3, 0, Math.PI * 2)
        context.fill()
      } else {
        context.strokeStyle = definition.accent
        context.lineWidth = 11
        context.beginPath()
        context.moveTo(x, y - 8)
        context.lineTo(x + 23, y - 15)
        context.stroke()
      }

      for (let level = 0; level < tower.level; level += 1) {
        context.fillStyle = '#ffe16b'
        context.beginPath()
        context.arc(x - 9 + level * 9, y + 29, 3.2, 0, Math.PI * 2)
        context.fill()
      }
    })

    game.enemies.forEach(enemy => {
      const position = getEnemyPosition(enemy)
      const x = position.x * TILE_SIZE
      const y = position.y * TILE_SIZE
      const definition = ENEMY_DEFINITIONS[enemy.kind]
      const radius = definition.radius * TILE_SIZE

      context.fillStyle = 'rgba(59, 36, 24, 0.3)'
      context.beginPath()
      context.ellipse(x, y + radius * 0.75, radius, radius * 0.38, 0, 0, Math.PI * 2)
      context.fill()
      if (enemy.slowTimer > 0) {
        context.fillStyle = 'rgba(131, 233, 255, 0.25)'
        context.beginPath()
        context.arc(x, y, radius + 7, 0, Math.PI * 2)
        context.fill()
      }

      context.fillStyle = definition.color
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = enemy.kind === 'boss' ? '#ffcf5e' : '#3d2b28'
      context.lineWidth = enemy.kind === 'boss' ? 5 : 3
      context.stroke()
      context.fillStyle = '#fff7dc'
      context.beginPath()
      context.arc(x - radius * 0.35, y - radius * 0.15, Math.max(2.4, radius * 0.12), 0, Math.PI * 2)
      context.arc(x + radius * 0.35, y - radius * 0.15, Math.max(2.4, radius * 0.12), 0, Math.PI * 2)
      context.fill()

      const barWidth = Math.max(34, radius * 2.2)
      context.fillStyle = 'rgba(36, 33, 29, 0.72)'
      context.fillRect(x - barWidth / 2, y - radius - 13, barWidth, 6)
      context.fillStyle = enemy.kind === 'boss' ? '#ffcf5e' : '#b6ef72'
      context.fillRect(x - barWidth / 2, y - radius - 13, barWidth * Math.max(0, enemy.hp / enemy.maxHp), 6)
    })

    game.shots.forEach(shot => {
      const tower = game.towers.find(item => item.id === shot.towerId)
      if (!tower) return
      const fromX = (tower.column + 0.5) * TILE_SIZE
      const fromY = (tower.row + 0.5) * TILE_SIZE
      context.strokeStyle = TOWER_DEFINITIONS[shot.kind].accent
      context.globalAlpha = Math.max(0, shot.life / 0.14)
      context.lineWidth = shot.kind === 'cannon' ? 7 : 4
      context.beginPath()
      context.moveTo(fromX, fromY)
      context.lineTo(shot.target.x * TILE_SIZE, shot.target.y * TILE_SIZE)
      context.stroke()
      context.globalAlpha = 1
    })

    if (game.phase === 'paused' || game.phase === 'victory' || game.phase === 'defeat') {
      context.fillStyle = 'rgba(22, 43, 36, 0.64)'
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      context.textAlign = 'center'
      context.fillStyle = '#fff4b0'
      context.font = '700 48px Nunito, sans-serif'
      context.fillText(
        game.phase === 'paused' ? '暂停中' : game.phase === 'victory' ? '绿野得救了！' : '防线失守',
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 - 8,
      )
      context.fillStyle = '#ecf8d5'
      context.font = '700 22px Nunito, sans-serif'
      context.fillText(
        game.phase === 'paused' ? '点击继续，让时间重新流动' : `本局得分 ${game.score}`,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 36,
      )
      context.textAlign = 'start'
    }
  }, [game, hoverTile, selectedKind, selectedTower, selectedTowerId])

  const handleCanvasPointer = (clientX: number, clientY: number, place = false) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    const column = Math.floor(((clientX - bounds.left) / bounds.width) * BOARD_COLUMNS)
    const row = Math.floor(((clientY - bounds.top) / bounds.height) * BOARD_ROWS)
    if (column < 0 || column >= BOARD_COLUMNS || row < 0 || row >= BOARD_ROWS) return
    setHoverTile({ column, row })
    if (!place) return

    const tower = game.towers.find(item => item.column === column && item.row === row)
    if (tower) {
      setSelectedTowerId(tower.id)
      setNotice(`${TOWER_DEFINITIONS[tower.kind].name} · ${tower.level} 级`)
      return
    }

    const placement = canPlaceTower(game, selectedKind, column, row)
    if (!placement.ok) {
      setNotice(placement.reason)
      return
    }
    setGame(current => placeTower(current, selectedKind, column, row))
    setSelectedTowerId(null)
    setNotice(`${TOWER_DEFINITIONS[selectedKind].name}已就位。`)
  }

  const resetGame = () => {
    setGame(createGameState())
    setSelectedTowerId(null)
    setSpeed(1)
    setNotice('新的守卫战开始了，先布置你的第一座塔。')
    submittedRef.current = false
  }

  const beginWave = () => {
    setGame(current => startNextWave(current))
    setSelectedTowerId(null)
    setNotice(`第 ${game.wave + 1} 波正在接近！`)
  }

  const pauseGame = () => {
    setGame(current => togglePause(current))
    setNotice(game.phase === 'paused' ? '战斗继续。' : '战斗已暂停。')
  }

  const handleCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === '1' || event.key === '2' || event.key === '3') {
      setSelectedKind(TOWER_ORDER[Number(event.key) - 1])
    } else if (event.key.toLowerCase() === 'p' && (game.phase === 'wave' || game.phase === 'paused')) {
      pauseGame()
    } else if (event.code === 'Space' && game.phase === 'ready') {
      event.preventDefault()
      beginWave()
    } else if (event.key === 'Escape') {
      setSelectedTowerId(null)
    }
  }

  const upcomingEnemies = game.phase === 'ready' && game.wave < WAVES.length
    ? WAVES[game.wave]
    : []

  return (
    <div className="font-game text-[#183f32]">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['☀', '阳光', game.gold],
          ['♥', '晨芽', game.lives],
          ['◆', '波次', `${game.wave}/${WAVES.length}`],
          ['★', '得分', game.score],
        ].map(([icon, label, value]) => (
          <div key={label} className="rounded-lg border-2 border-[#7aa452] bg-[#eff7cd] px-3 py-2 shadow-[0_3px_0_#456d3e]">
            <div className="text-[11px] font-black uppercase tracking-wider text-[#517044]">{icon} {label}</div>
            <div className="mt-0.5 text-xl font-black text-[#264b35]">{value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border-4 border-[#334c33] bg-[#173b2b] shadow-[0_5px_0_#101e18]">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block aspect-[3/2] w-full cursor-crosshair touch-manipulation outline-none focus:ring-4 focus:ring-inset focus:ring-[#fff49b]"
          aria-label="绿野防线战场。点击草地建塔，点击已有防御塔进行升级或出售。"
          tabIndex={0}
          onPointerMove={event => handleCanvasPointer(event.clientX, event.clientY)}
          onPointerUp={event => handleCanvasPointer(event.clientX, event.clientY, true)}
          onPointerLeave={() => setHoverTile(null)}
          onKeyDown={handleCanvasKeyDown}
        />
      </div>

      <div className="mt-4 rounded-lg border-2 border-[#8bab58] bg-[#f4f5ca] px-4 py-3 text-sm font-extrabold text-[#3d603b]" aria-live="polite">
        <span className="mr-2 text-[#c2702d]">▸</span>{notice}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-[#d9f99d]">选择防御塔</h2>
            <span className="hidden text-xs font-bold text-[#9dbe8b] sm:inline">快捷键 1 / 2 / 3</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {TOWER_ORDER.map((kind, index) => {
              const tower = TOWER_DEFINITIONS[kind]
              const affordable = game.gold >= tower.cost
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    setSelectedKind(kind)
                    setSelectedTowerId(null)
                    setNotice(`已选择${tower.name}，点击空草地建造。`)
                  }}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    selectedKind === kind && !selectedTower
                      ? 'border-[#ffe05f] bg-[#fff4a8] shadow-[0_4px_0_#9f7221]'
                      : 'border-[#769c5c] bg-[#e8f2c8] shadow-[0_3px_0_#3f6842] hover:-translate-y-0.5 hover:bg-[#f4f7d8]'
                  } ${affordable ? '' : 'opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-lg font-black text-[#294a35]">{index + 1}. {tower.name}</span>
                    <span className="rounded bg-[#315a3b] px-2 py-1 text-xs font-black text-[#f9eb7e]">☀ {tower.cost}</span>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-[#52704d]">{tower.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border-2 border-[#6d9357] bg-[#d9e7b5] p-3 shadow-[0_3px_0_#385d3d]">
          {selectedTower && game.phase !== 'victory' && game.phase !== 'defeat' ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-[#5a7047]">已选守卫</div>
                  <div className="mt-1 text-lg font-black text-[#254733]">{TOWER_DEFINITIONS[selectedTower.kind].name}</div>
                </div>
                <span className="rounded bg-[#315a3b] px-2 py-1 text-xs font-black text-[#fff1a1]">Lv.{selectedTower.level}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black text-[#496342]">
                <span>攻击 {Math.round(getTowerStats(selectedTower).damage)}</span>
                <span>范围 {getTowerStats(selectedTower).range.toFixed(1)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={getUpgradeCost(selectedTower) === null || game.gold < (getUpgradeCost(selectedTower) ?? Infinity)}
                  onClick={() => {
                    const cost = getUpgradeCost(selectedTower)
                    setGame(current => upgradeTower(current, selectedTower.id))
                    setNotice(cost === null ? '这座塔已经满级。' : `${TOWER_DEFINITIONS[selectedTower.kind].name}升级完成。`)
                  }}
                  className="rounded-md bg-[#277443] px-2 py-2 text-xs font-black text-white shadow-[0_3px_0_#17472b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {getUpgradeCost(selectedTower) === null ? '已满级' : `升级 ☀ ${getUpgradeCost(selectedTower)}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGame(current => sellTower(current, selectedTower.id))
                    setSelectedTowerId(null)
                    setNotice('守卫已回收，返还了 70% 阳光。')
                  }}
                  className="rounded-md bg-[#a85d32] px-2 py-2 text-xs font-black text-white shadow-[0_3px_0_#67351f]"
                >
                  出售 ☀ {Math.round(selectedTower.invested * 0.7)}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs font-black uppercase tracking-wider text-[#5a7047]">下一波侦察</div>
              <div className="mt-2 min-h-12 text-sm font-black leading-6 text-[#31523a]">
                {game.phase === 'ready' && upcomingEnemies.length > 0
                  ? `${upcomingEnemies.length} 个敌人 · ${Array.from(new Set(upcomingEnemies)).map(kind => ENEMY_DEFINITIONS[kind].name).join(' / ')}`
                  : game.phase === 'wave'
                    ? `场上 ${game.enemies.length} 个敌人，尚有 ${game.spawnQueue.length} 个接近中`
                    : '点击战场上的防御塔，可升级或出售。'}
              </div>
              <div className="mt-3 flex gap-2">
                {game.phase === 'ready' && game.wave < WAVES.length && (
                  <button
                    type="button"
                    onClick={beginWave}
                    className="flex-1 rounded-md bg-[#e98a2f] px-3 py-2 text-sm font-black text-white shadow-[0_3px_0_#8c461d] hover:bg-[#f49a37]"
                  >
                    ▶ 开始第 {game.wave + 1} 波
                  </button>
                )}
                {(game.phase === 'wave' || game.phase === 'paused') && (
                  <>
                    <button
                      type="button"
                      onClick={pauseGame}
                      className="flex-1 rounded-md bg-[#315a3b] px-3 py-2 text-sm font-black text-white shadow-[0_3px_0_#173822]"
                    >
                      {game.phase === 'paused' ? '▶ 继续' : 'Ⅱ 暂停'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpeed(current => current === 1 ? 2 : 1)}
                      className="rounded-md bg-[#407da0] px-3 py-2 text-sm font-black text-white shadow-[0_3px_0_#264d65]"
                    >
                      ×{speed}
                    </button>
                  </>
                )}
                {(game.phase === 'victory' || game.phase === 'defeat') && (
                  <button
                    type="button"
                    onClick={resetGame}
                    className="flex-1 rounded-md bg-[#e98a2f] px-3 py-2 text-sm font-black text-white shadow-[0_3px_0_#8c461d]"
                  >
                    ↻ 再守一次
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs font-bold leading-5 text-[#9fbea2]">
        操作：点击草地建塔 · 点击防御塔升级/出售 · 空格开启波次 · P 暂停
      </p>
    </div>
  )
}
