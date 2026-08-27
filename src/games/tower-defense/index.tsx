import { useEffect, useMemo, useRef, useState } from 'react'
import { createRecord } from '@/api'
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  ENEMY_DEFINITIONS,
  INITIAL_LIVES,
  OBSTACLE_DEFINITIONS,
  PATH_POINTS,
  PATH_TILES,
  SKILL_DEFINITIONS,
  TOWER_DEFINITIONS,
  WAVES,
  canPlaceTower,
  createGameState,
  getEnemyPosition,
  getStarRating,
  getTowerStats,
  getUpgradeCost,
  placeTower,
  sellTower,
  startNextWave,
  stepGame,
  togglePause,
  upgradeTower,
  useSkill,
  type GameState,
  type SkillKind,
  type TowerKind,
} from '@/games/tower-defense/engine'

interface Props {
  userId?: string
  gameId: string
}

const CANVAS_WIDTH = 960
const CANVAS_HEIGHT = 640
const TILE_SIZE = CANVAS_WIDTH / BOARD_COLUMNS
const TOWER_ORDER: TowerKind[] = ['sprout', 'frost', 'cannon', 'sun', 'magic', 'spike']
const SKILL_ORDER: SkillKind[] = ['freeze', 'gold', 'bomb']

export default function TowerDefense({ userId, gameId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const submittedRef = useRef(false)
  const [game, setGame] = useState<GameState>(createGameState)
  const [selectedKind, setSelectedKind] = useState<TowerKind>('sprout')
  const [selectedTowerId, setSelectedTowerId] = useState<number | null>(null)
  const [hoverTile, setHoverTile] = useState<{ column: number; row: number } | null>(null)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const [notice, setNotice] = useState('在草地上布置守卫，清除障碍物获取额外金币，准备好后开启第一波！')

  const selectedTower = useMemo(
    () => game.towers.find((tower) => tower.id === selectedTowerId) ?? null,
    [game.towers, selectedTowerId],
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGame((current) => stepGame(current, 0.05 * speed))
    }, 50)
    return () => window.clearInterval(timer)
  }, [speed])

  useEffect(() => {
    if (game.phase === 'victory') {
      const stars = getStarRating(game)
      setNotice(`胜利！获得 ${stars} 星评价，得分 ${game.score}`)
    } else if (game.phase === 'defeat') {
      setNotice('萝卜被吃掉了！调整塔位和技能释放时机，再试一次吧。')
    } else if (game.phase === 'ready' && game.wave > 0) {
      setNotice(`第 ${game.wave} 波已清除，获得补给金币。`)
    }
  }, [game.phase, game.wave, game.score])

  useEffect(() => {
    if ((game.phase !== 'victory' && game.phase !== 'defeat') || submittedRef.current || !userId)
      return
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
        context.fillStyle =
          (row + column) % 2 === 0 ? 'rgba(218, 241, 159, 0.055)' : 'rgba(17, 73, 48, 0.045)'
        context.fillRect(column * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE)

        const seed = (row * 19 + column * 31) % 7
        if (
          seed < 3 &&
          !PATH_TILES.some(([pathColumn, pathRow]) => pathColumn === column && pathRow === row)
        ) {
          context.fillStyle = seed === 0 ? '#d8ef92' : '#6dab53'
          context.beginPath()
          context.arc(
            column * TILE_SIZE + 18 + seed * 11,
            row * TILE_SIZE + 20 + seed * 13,
            2.5,
            0,
            Math.PI * 2,
          )
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
    context.arc(baseX, baseY, 32, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = '#315f3d'
    context.lineWidth = 6
    context.stroke()
    context.fillStyle = '#ff8c42'
    context.beginPath()
    context.arc(baseX, baseY, 18, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#fff'
    context.beginPath()
    context.arc(baseX - 6, baseY - 5, 4, 0, Math.PI * 2)
    context.arc(baseX + 6, baseY - 5, 4, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#333'
    context.beginPath()
    context.arc(baseX - 5, baseY - 4, 2, 0, Math.PI * 2)
    context.arc(baseX + 7, baseY - 4, 2, 0, Math.PI * 2)
    context.fill()

    game.obstacles.forEach((obstacle) => {
      const x = (obstacle.column + 0.5) * TILE_SIZE
      const y = (obstacle.row + 0.5) * TILE_SIZE
      const def = OBSTACLE_DEFINITIONS[obstacle.kind]

      context.fillStyle = 'rgba(0,0,0,0.2)'
      context.beginPath()
      context.ellipse(x, y + 14, 22, 7, 0, 0, Math.PI * 2)
      context.fill()

      if (obstacle.kind === 'rock') {
        context.fillStyle = def.color
        context.beginPath()
        context.moveTo(x - 20, y + 10)
        context.lineTo(x - 14, y - 14)
        context.lineTo(x + 2, y - 18)
        context.lineTo(x + 18, y - 8)
        context.lineTo(x + 20, y + 10)
        context.closePath()
        context.fill()
        context.strokeStyle = '#4a4a4a'
        context.lineWidth = 2.5
        context.stroke()
        context.fillStyle = def.accent
        context.beginPath()
        context.arc(x - 5, y - 5, 4, 0, Math.PI * 2)
        context.fill()
      } else if (obstacle.kind === 'chest') {
        context.fillStyle = def.color
        context.fillRect(x - 18, y - 10, 36, 22)
        context.fillStyle = '#6b4220'
        context.fillRect(x - 18, y - 10, 36, 8)
        context.fillStyle = def.accent
        context.fillRect(x - 3, y - 4, 6, 10)
        context.strokeStyle = '#4a3018'
        context.lineWidth = 2
        context.strokeRect(x - 18, y - 10, 36, 22)
      } else {
        context.fillStyle = def.color
        context.beginPath()
        context.moveTo(x, y - 20)
        context.lineTo(x + 14, y + 2)
        context.lineTo(x + 8, y + 14)
        context.lineTo(x - 8, y + 14)
        context.lineTo(x - 14, y + 2)
        context.closePath()
        context.fill()
        context.strokeStyle = '#6b3f7a'
        context.lineWidth = 2.5
        context.stroke()
        context.fillStyle = def.accent
        context.beginPath()
        context.moveTo(x, y - 14)
        context.lineTo(x + 6, y - 2)
        context.lineTo(x, y + 4)
        context.lineTo(x - 6, y - 2)
        context.closePath()
        context.fill()
      }

      const barWidth = 36
      context.fillStyle = 'rgba(36, 33, 29, 0.72)'
      context.fillRect(x - barWidth / 2, y - 26, barWidth, 5)
      context.fillStyle = '#ffb74d'
      context.fillRect(x - barWidth / 2, y - 26, barWidth * Math.max(0, obstacle.hp / obstacle.maxHp), 5)
    })

    if (
      hoverTile &&
      !game.towers.some((tower) => tower.column === hoverTile.column && tower.row === hoverTile.row)
    ) {
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

    game.towers.forEach((tower) => {
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

      if (tower.kind === 'sprout') {
        context.fillStyle = definition.color
        context.beginPath()
        context.arc(x, y - 6, 19, 0, Math.PI * 2)
        context.fill()
        context.strokeStyle = '#243d2f'
        context.lineWidth = 3
        context.stroke()
        context.fillStyle = definition.accent
        context.beginPath()
        context.arc(x + 13, y - 9, 9, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#284a30'
        context.beginPath()
        context.arc(x + 17, y - 11, 3, 0, Math.PI * 2)
        context.fill()
      } else if (tower.kind === 'frost') {
        context.fillStyle = definition.color
        context.beginPath()
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
          const px = x + Math.cos(angle) * 18
          const py = y - 6 + Math.sin(angle) * 18
          if (i === 0) context.moveTo(px, py)
          else context.lineTo(px, py)
        }
        context.closePath()
        context.fill()
        context.strokeStyle = '#1a4a6b'
        context.lineWidth = 2.5
        context.stroke()
        context.fillStyle = definition.accent
        context.beginPath()
        context.arc(x, y - 6, 8, 0, Math.PI * 2)
        context.fill()
      } else if (tower.kind === 'cannon') {
        context.fillStyle = definition.color
        context.beginPath()
        context.arc(x, y - 6, 20, 0, Math.PI * 2)
        context.fill()
        context.strokeStyle = '#4a2810'
        context.lineWidth = 3
        context.stroke()
        context.strokeStyle = definition.accent
        context.lineWidth = 10
        context.beginPath()
        context.moveTo(x, y - 8)
        context.lineTo(x + 24, y - 16)
        context.stroke()
        context.fillStyle = '#333'
        context.beginPath()
        context.arc(x + 24, y - 16, 5, 0, Math.PI * 2)
        context.fill()
      } else if (tower.kind === 'sun') {
        context.fillStyle = definition.accent
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2
          context.beginPath()
          context.moveTo(x + Math.cos(angle) * 14, y - 6 + Math.sin(angle) * 14)
          context.lineTo(x + Math.cos(angle) * 24, y - 6 + Math.sin(angle) * 24)
          context.lineWidth = 5
          context.strokeStyle = definition.accent
          context.stroke()
        }
        context.fillStyle = definition.color
        context.beginPath()
        context.arc(x, y - 6, 16, 0, Math.PI * 2)
        context.fill()
        context.strokeStyle = '#8a4a0a'
        context.lineWidth = 2.5
        context.stroke()
        context.fillStyle = '#fff5cc'
        context.beginPath()
        context.arc(x - 4, y - 9, 3, 0, Math.PI * 2)
        context.arc(x + 4, y - 9, 3, 0, Math.PI * 2)
        context.fill()
      } else if (tower.kind === 'magic') {
        context.strokeStyle = definition.accent
        context.lineWidth = 2
        context.beginPath()
        context.arc(x, y - 6, 22, 0, Math.PI * 2)
        context.stroke()
        context.fillStyle = definition.color
        context.beginPath()
        context.arc(x, y - 6, 17, 0, Math.PI * 2)
        context.fill()
        context.strokeStyle = '#3a1f5a'
        context.lineWidth = 2.5
        context.stroke()
        context.fillStyle = definition.accent
        context.beginPath()
        context.arc(x - 4, y - 10, 5, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#fff'
        context.beginPath()
        context.arc(x - 5, y - 11, 2, 0, Math.PI * 2)
        context.fill()
      } else {
        context.fillStyle = definition.color
        context.beginPath()
        context.arc(x, y - 6, 18, 0, Math.PI * 2)
        context.fill()
        context.strokeStyle = '#3a4a52'
        context.lineWidth = 2.5
        context.stroke()
        context.fillStyle = definition.accent
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
          const sx = x + Math.cos(angle) * 14
          const sy = y - 6 + Math.sin(angle) * 14
          context.beginPath()
          context.moveTo(sx, sy)
          context.lineTo(sx + Math.cos(angle) * 8, sy + Math.sin(angle) * 8)
          context.lineWidth = 4
          context.strokeStyle = definition.accent
          context.stroke()
        }
      }

      for (let level = 0; level < tower.level; level += 1) {
        context.fillStyle = '#ffe16b'
        context.beginPath()
        context.arc(x - 9 + level * 9, y + 29, 3.2, 0, Math.PI * 2)
        context.fill()
      }
    })

    game.enemies.forEach((enemy) => {
      const position = getEnemyPosition(enemy)
      const x = position.x * TILE_SIZE
      const y = position.y * TILE_SIZE
      const definition = ENEMY_DEFINITIONS[enemy.kind]
      const radius = definition.radius * TILE_SIZE

      context.fillStyle = 'rgba(59, 36, 24, 0.3)'
      context.beginPath()
      context.ellipse(x, y + radius * 0.75, radius, radius * 0.38, 0, 0, Math.PI * 2)
      context.fill()

      if (definition.isFlying) {
        context.fillStyle = 'rgba(255,255,255,0.6)'
        context.beginPath()
        context.ellipse(x - radius * 0.9, y - radius * 0.3, radius * 0.6, radius * 0.35, -0.4, 0, Math.PI * 2)
        context.ellipse(x + radius * 0.9, y - radius * 0.3, radius * 0.6, radius * 0.35, 0.4, 0, Math.PI * 2)
        context.fill()
      }

      if (enemy.slowTimer > 0) {
        context.fillStyle = 'rgba(131, 233, 255, 0.3)'
        context.beginPath()
        context.arc(x, y, radius + 7, 0, Math.PI * 2)
        context.fill()
      }
      if (enemy.burnTimer > 0) {
        context.fillStyle = 'rgba(255, 140, 0, 0.35)'
        context.beginPath()
        context.arc(x, y, radius + 5, 0, Math.PI * 2)
        context.fill()
      }
      if (enemy.stunTimer > 0) {
        context.fillStyle = '#ffd700'
        context.font = 'bold 14px sans-serif'
        context.textAlign = 'center'
        context.fillText('★', x - 8, y - radius - 6)
        context.fillText('★', x + 8, y - radius - 6)
        context.textAlign = 'start'
      }

      context.fillStyle = definition.color
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = enemy.kind === 'boss' ? '#ffcf5e' : '#3d2b28'
      context.lineWidth = enemy.kind === 'boss' ? 5 : 3
      context.stroke()

      if (enemy.kind === 'splitter') {
        context.strokeStyle = '#2a5a30'
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(x - radius * 0.5, y - radius * 0.5)
        context.lineTo(x + radius * 0.3, y + radius * 0.4)
        context.moveTo(x + radius * 0.4, y - radius * 0.3)
        context.lineTo(x - radius * 0.2, y + radius * 0.5)
        context.stroke()
      }

      context.fillStyle = '#fff7dc'
      context.beginPath()
      context.arc(
        x - radius * 0.35,
        y - radius * 0.15,
        Math.max(2.4, radius * 0.12),
        0,
        Math.PI * 2,
      )
      context.arc(
        x + radius * 0.35,
        y - radius * 0.15,
        Math.max(2.4, radius * 0.12),
        0,
        Math.PI * 2,
      )
      context.fill()
      context.fillStyle = '#333'
      context.beginPath()
      context.arc(
        x - radius * 0.32,
        y - radius * 0.12,
        Math.max(1.2, radius * 0.06),
        0,
        Math.PI * 2,
      )
      context.arc(
        x + radius * 0.38,
        y - radius * 0.12,
        Math.max(1.2, radius * 0.06),
        0,
        Math.PI * 2,
      )
      context.fill()

      const barWidth = Math.max(34, radius * 2.2)
      context.fillStyle = 'rgba(36, 33, 29, 0.72)'
      context.fillRect(x - barWidth / 2, y - radius - 13, barWidth, 6)
      context.fillStyle = enemy.kind === 'boss' ? '#ffcf5e' : '#b6ef72'
      context.fillRect(
        x - barWidth / 2,
        y - radius - 13,
        barWidth * Math.max(0, enemy.hp / enemy.maxHp),
        6,
      )
    })

    game.shots.forEach((shot) => {
      context.strokeStyle = TOWER_DEFINITIONS[shot.kind].accent
      context.globalAlpha = Math.max(0, shot.life / shot.maxLife)
      context.lineWidth = shot.isChain ? 3 : shot.kind === 'cannon' ? 7 : 4
      if (shot.kind === 'cannon') {
        context.beginPath()
        context.moveTo(shot.fromX * TILE_SIZE, shot.fromY * TILE_SIZE)
        context.lineTo(shot.targetX * TILE_SIZE, shot.targetY * TILE_SIZE)
        context.stroke()
        context.fillStyle = '#ff6b35'
        context.beginPath()
        context.arc(shot.targetX * TILE_SIZE, shot.targetY * TILE_SIZE, 12 * (shot.life / shot.maxLife), 0, Math.PI * 2)
        context.fill()
      } else if (shot.kind === 'magic') {
        context.beginPath()
        context.moveTo(shot.fromX * TILE_SIZE, shot.fromY * TILE_SIZE)
        context.lineTo(shot.targetX * TILE_SIZE, shot.targetY * TILE_SIZE)
        context.stroke()
        context.fillStyle = '#c89bff'
        context.beginPath()
        context.arc(shot.targetX * TILE_SIZE, shot.targetY * TILE_SIZE, 5, 0, Math.PI * 2)
        context.fill()
      } else {
        context.beginPath()
        context.moveTo(shot.fromX * TILE_SIZE, shot.fromY * TILE_SIZE)
        context.lineTo(shot.targetX * TILE_SIZE, shot.targetY * TILE_SIZE)
        context.stroke()
      }
      context.globalAlpha = 1
    })

    game.floatingTexts.forEach((ft) => {
      context.globalAlpha = Math.max(0, ft.life)
      context.fillStyle = ft.color
      context.font = 'bold 16px Nunito, sans-serif'
      context.textAlign = 'center'
      context.fillText(ft.text, ft.x * TILE_SIZE, ft.y * TILE_SIZE)
      context.textAlign = 'start'
      context.globalAlpha = 1
    })

    if (game.phase === 'paused' || game.phase === 'victory' || game.phase === 'defeat') {
      context.fillStyle = 'rgba(22, 43, 36, 0.64)'
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      context.textAlign = 'center'
      context.fillStyle = '#fff4b0'
      context.font = '700 48px Nunito, sans-serif'
      if (game.phase === 'victory') {
        const stars = getStarRating(game)
        context.fillText('胜利！', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30)
        context.fillStyle = '#ffd700'
        context.font = '700 36px Nunito, sans-serif'
        context.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15)
        context.fillStyle = '#ecf8d5'
        context.font = '700 22px Nunito, sans-serif'
        context.fillText(`本局得分 ${game.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 55)
      } else if (game.phase === 'defeat') {
        context.fillText('萝卜被吃掉了', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 8)
        context.fillStyle = '#ecf8d5'
        context.font = '700 22px Nunito, sans-serif'
        context.fillText(`本局得分 ${game.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 36)
      } else {
        context.fillText('暂停中', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 8)
        context.fillStyle = '#ecf8d5'
        context.font = '700 22px Nunito, sans-serif'
        context.fillText('点击继续，让时间重新流动', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 36)
      }
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

    const tower = game.towers.find((item) => item.column === column && item.row === row)
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
    setGame((current) => placeTower(current, selectedKind, column, row))
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
    setGame((current) => startNextWave(current))
    setSelectedTowerId(null)
    setNotice(`第 ${game.wave + 1} 波正在接近！`)
  }

  const pauseGame = () => {
    setGame((current) => togglePause(current))
    setNotice(game.phase === 'paused' ? '战斗继续。' : '战斗已暂停。')
  }

  const handleSkill = (skill: SkillKind) => {
    if (game.skillCooldowns[skill] > 0) {
      setNotice(`${SKILL_DEFINITIONS[skill].name}冷却中，还需 ${Math.ceil(game.skillCooldowns[skill])} 秒`)
      return
    }
    if (game.phase !== 'wave' && game.phase !== 'ready') return
    setGame((current) => useSkill(current, skill))
    setNotice(`释放了${SKILL_DEFINITIONS[skill].name}！`)
  }

  const handleCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key >= '1' && event.key <= '6') {
      const idx = Number(event.key) - 1
      if (idx < TOWER_ORDER.length) {
        setSelectedKind(TOWER_ORDER[idx])
        setSelectedTowerId(null)
      }
    } else if (event.key === 'q' || event.key === 'Q') {
      handleSkill('freeze')
    } else if (event.key === 'w' || event.key === 'W') {
      handleSkill('gold')
    } else if (event.key === 'e' || event.key === 'E') {
      handleSkill('bomb')
    } else if (
      event.key.toLowerCase() === 'p' &&
      (game.phase === 'wave' || game.phase === 'paused')
    ) {
      pauseGame()
    } else if (event.code === 'Space' && game.phase === 'ready') {
      event.preventDefault()
      beginWave()
    } else if (event.key === 'Escape') {
      setSelectedTowerId(null)
    }
  }

  const upcomingEnemies = game.phase === 'ready' && game.wave < WAVES.length ? WAVES[game.wave] : []
  const starRating = getStarRating(game)

  return (
    <div className="font-game text-[#183f32]">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['☀', '金币', game.gold],
          ['♥', '萝卜', game.lives],
          ['◆', '波次', `${game.wave}/${WAVES.length}`],
          ['★', '得分', game.score],
          ['⚡', '连击', game.combo > 0 ? `x${game.combo}` : '-'],
        ].map(([icon, label, value]) => (
          <div
            key={label}
            className="rounded-lg border-2 border-[#7aa452] bg-[#eff7cd] px-3 py-2 shadow-[0_3px_0_#456d3e]"
          >
            <div className="text-[11px] font-black uppercase tracking-wider text-[#517044]">
              {icon} {label}
            </div>
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
          onPointerMove={(event) => handleCanvasPointer(event.clientX, event.clientY)}
          onPointerUp={(event) => handleCanvasPointer(event.clientX, event.clientY, true)}
          onPointerLeave={() => setHoverTile(null)}
          onKeyDown={handleCanvasKeyDown}
        />
      </div>

      <div
        className="mt-4 rounded-lg border-2 border-[#8bab58] bg-[#f4f5ca] px-4 py-3 text-sm font-extrabold text-[#3d603b]"
        aria-live="polite"
      >
        <span className="mr-2 text-[#c2702d]">▸</span>
        {notice}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-[#d9f99d]">
              选择防御塔
            </h2>
            <span className="hidden text-xs font-bold text-[#9dbe8b] sm:inline">
              快捷键 1-6
            </span>
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
                    <span className="text-base font-black text-[#294a35]">
                      {index + 1}. {tower.name}
                    </span>
                    <span className="rounded bg-[#315a3b] px-2 py-1 text-xs font-black text-[#f9eb7e]">
                      ☀ {tower.cost}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-bold leading-4 text-[#52704d]">
                    {tower.description}
                  </p>
                  <div className="mt-1.5 flex gap-1.5 text-[10px] font-black">
                    {!tower.canHitAir && (
                      <span className="rounded bg-[#c44] px-1.5 py-0.5 text-white">不可对空</span>
                    )}
                    {tower.splash && (
                      <span className="rounded bg-[#e98a2f] px-1.5 py-0.5 text-white">范围</span>
                    )}
                    {tower.chainCount && (
                      <span className="rounded bg-[#6b3fa0] px-1.5 py-0.5 text-white">弹射</span>
                    )}
                    {tower.burnDamage && (
                      <span className="rounded bg-[#d4761a] px-1.5 py-0.5 text-white">灼烧</span>
                    )}
                    {tower.stunDuration && (
                      <span className="rounded bg-[#5a6e7a] px-1.5 py-0.5 text-white">眩晕</span>
                    )}
                    {tower.slowMultiplier && (
                      <span className="rounded bg-[#247aa8] px-1.5 py-0.5 text-white">减速</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-[#d9f99d]">
                主动技能
              </h2>
              <span className="hidden text-xs font-bold text-[#9dbe8b] sm:inline">
                快捷键 Q / W / E
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SKILL_ORDER.map((skill, idx) => {
                const def = SKILL_DEFINITIONS[skill]
                const cd = game.skillCooldowns[skill]
                const ready = cd <= 0
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => handleSkill(skill)}
                    disabled={!ready}
                    className={`relative overflow-hidden rounded-lg border-2 p-3 text-center transition-all ${
                      ready
                        ? 'border-[#769c5c] bg-[#e8f2c8] shadow-[0_3px_0_#3f6842] hover:-translate-y-0.5'
                        : 'border-[#888] bg-[#ccc] opacity-70'
                    }`}
                  >
                    <div className="text-2xl" style={{ color: def.color }}>
                      {def.icon}
                    </div>
                    <div className="mt-1 text-xs font-black text-[#294a35]">{def.name}</div>
                    <div className="mt-0.5 text-[10px] font-bold text-[#52704d]">
                      {['Q', 'W', 'E'][idx]}
                    </div>
                    {!ready && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-lg font-black text-white">{Math.ceil(cd)}s</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="rounded-lg border-2 border-[#6d9357] bg-[#d9e7b5] p-3 shadow-[0_3px_0_#385d3d]">
          {selectedTower && game.phase !== 'victory' && game.phase !== 'defeat' ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-[#5a7047]">
                    已选守卫
                  </div>
                  <div className="mt-1 text-lg font-black text-[#254733]">
                    {TOWER_DEFINITIONS[selectedTower.kind].name}
                  </div>
                </div>
                <span className="rounded bg-[#315a3b] px-2 py-1 text-xs font-black text-[#fff1a1]">
                  Lv.{selectedTower.level}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black text-[#496342]">
                <span>攻击 {Math.round(getTowerStats(selectedTower).damage)}</span>
                <span>范围 {getTowerStats(selectedTower).range.toFixed(1)}</span>
                <span>射速 {(1 / getTowerStats(selectedTower).fireInterval).toFixed(1)}/s</span>
                <span>
                  {TOWER_DEFINITIONS[selectedTower.kind].canHitAir ? '可对空' : '仅地面'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={
                    getUpgradeCost(selectedTower) === null ||
                    game.gold < (getUpgradeCost(selectedTower) ?? Infinity)
                  }
                  onClick={() => {
                    const cost = getUpgradeCost(selectedTower)
                    setGame((current) => upgradeTower(current, selectedTower.id))
                    setNotice(
                      cost === null
                        ? '这座塔已经满级。'
                        : `${TOWER_DEFINITIONS[selectedTower.kind].name}升级完成。`,
                    )
                  }}
                  className="rounded-md bg-[#277443] px-2 py-2 text-xs font-black text-white shadow-[0_3px_0_#17472b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {getUpgradeCost(selectedTower) === null
                    ? '已满级'
                    : `升级 ☀ ${getUpgradeCost(selectedTower)}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGame((current) => sellTower(current, selectedTower.id))
                    setSelectedTowerId(null)
                    setNotice('守卫已回收，返还了 70% 金币。')
                  }}
                  className="rounded-md bg-[#a85d32] px-2 py-2 text-xs font-black text-white shadow-[0_3px_0_#67351f]"
                >
                  出售 ☀ {Math.round(selectedTower.invested * 0.7)}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs font-black uppercase tracking-wider text-[#5a7047]">
                下一波侦察
              </div>
              <div className="mt-2 min-h-12 text-sm font-black leading-6 text-[#31523a]">
                {game.phase === 'ready' && upcomingEnemies.length > 0
                  ? `${upcomingEnemies.length} 个敌人 · ${Array.from(new Set(upcomingEnemies))
                      .map((kind) => ENEMY_DEFINITIONS[kind].name)
                      .join(' / ')}`
                  : game.phase === 'wave'
                    ? `场上 ${game.enemies.length} 个敌人，尚有 ${game.spawnQueue.length} 个接近中`
                    : game.phase === 'victory'
                      ? `评级：${starRating}星 · 击杀 ${game.kills} · 剩余生命 ${game.lives}/${INITIAL_LIVES}`
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
                      onClick={() => setSpeed((current) => (current === 1 ? 2 : 1))}
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
        操作：点击草地建塔 · 点击防御塔升级/出售 · 1-6选塔 · Q/W/E技能 · 空格开波 · P暂停
      </p>
    </div>
  )
}
