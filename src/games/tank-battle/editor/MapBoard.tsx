import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { FIELD_PIXELS, GRID_SIZE, CELL_SIZE } from '@/games/tank-battle/constants.ts'
import { Base } from '@/games/tank-battle/entity/Base.ts'
import { drawBase, drawTerrainCell, drawTreeCell } from '@/games/tank-battle/render/drawSprites.ts'
import { TerrainGrid } from '@/games/tank-battle/system/TerrainGrid.ts'
import { TerrainKind } from '@/games/tank-battle/types.ts'
import { paintLine, protectedCell } from './maps.ts'

const TILE_LABELS: Readonly<Record<string, string>> = {
  '.': '空地',
  '#': '砖墙',
  '@': '钢墙',
  '~': '水面',
  '*': '草丛',
  '%': '冰面',
  '^': '上半砖墙',
  v: '下半砖墙',
  '<': '左半砖墙',
  '>': '右半砖墙',
  t: '上半钢墙',
  b: '下半钢墙',
  l: '左半钢墙',
  r: '右半钢墙',
}
export function MapPreview({
  terrain,
  label = '地图预览',
}: {
  terrain: readonly string[]
  label?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = ref.current?.getContext('2d')
    if (!context) return
    context.imageSmoothingEnabled = false
    context.fillStyle = '#000'
    context.fillRect(0, 0, FIELD_PIXELS, FIELD_PIXELS)
    const grid = new TerrainGrid(terrain)
    grid.forEachCell((x, y, kind, mask) => {
      if (kind === TerrainKind.TREE) drawTreeCell(context, x, y)
      else drawTerrainCell(context, x, y, kind, mask, 0)
    })
    drawBase(context, new Base())
  }, [terrain])
  return <canvas ref={ref} width={FIELD_PIXELS} height={FIELD_PIXELS} aria-label={label} />
}
interface MapBoardProps {
  terrain: readonly string[]
  brush: string
  active: boolean
  onBegin: () => void
  onPaint: (terrain: readonly string[]) => void
  onEnd: () => void
}
export function MapBoard({ terrain, brush, active, onBegin, onPaint, onEnd }: MapBoardProps) {
  const stroke = useRef<{
    id: number
    tile: string
    last: readonly [number, number]
    terrain: readonly string[]
  } | null>(null)
  const [cursor, setCursor] = useState<readonly [number, number]>([4, 10])
  const [hint, setHint] = useState('选择地形后点击或拖动绘制。')
  const point = (event: PointerEvent<HTMLDivElement>): readonly [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect()
    return [
      Math.max(0, Math.min(12, Math.floor(((event.clientX - rect.left) / rect.width) * GRID_SIZE))),
      Math.max(0, Math.min(12, Math.floor(((event.clientY - rect.top) / rect.height) * GRID_SIZE))),
    ]
  }
  const describe = (x: number, y: number) =>
    `第 ${y + 1} 行，第 ${x + 1} 列：${protectedCell(x, y) ?? TILE_LABELS[terrain[y][x]]}`
  const finish = () => {
    if (!stroke.current) return
    stroke.current = null
    onEnd()
  }
  return (
    <div>
      <div
        className="tank-editor-board"
        aria-label="地图画板"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (!active || event.button !== 0 || stroke.current) return
          event.preventDefault()
          const [x, y] = point(event)
          setCursor([x, y])
          setHint(describe(x, y))
          if (protectedCell(x, y)) {
            setHint(`${describe(x, y)}，固定位置不可绘制。`)
            return
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          onBegin()
          const next = paintLine(terrain, [x, y], [x, y], brush)
          stroke.current = { id: event.pointerId, tile: brush, last: [x, y], terrain: next }
          onPaint(next)
        }}
        onPointerMove={(event) => {
          const cell = point(event)
          setCursor(cell)
          const current = stroke.current
          if (!current || current.id !== event.pointerId) return
          const next = paintLine(current.terrain, current.last, cell, current.tile)
          current.last = cell
          current.terrain = next
          onPaint(next)
        }}
        onPointerUp={(event) => {
          if (stroke.current?.id === event.pointerId) finish()
        }}
        onPointerCancel={(event) => {
          if (stroke.current?.id === event.pointerId) finish()
        }}
        onLostPointerCapture={finish}
      >
        <MapPreview terrain={terrain} label="编辑中的地图地形" />
        <div className="tank-editor-grid" role="group" aria-label="13 行 13 列地形格">
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
            const x = index % GRID_SIZE,
              y = Math.floor(index / GRID_SIZE)
            const lock = protectedCell(x, y)
            return (
              <button
                key={index}
                type="button"
                aria-label={describe(x, y)}
                aria-disabled={Boolean(lock)}
                tabIndex={cursor[0] === x && cursor[1] === y ? 0 : -1}
                className={`${lock ? 'is-locked' : ''} ${cursor[0] === x && cursor[1] === y ? 'is-cursor' : ''}`}
                onFocus={() => {
                  setCursor([x, y])
                  setHint(describe(x, y))
                }}
                onClick={(event) => {
                  if (event.detail !== 0 || lock || !active) return
                  onBegin()
                  onPaint(paintLine(terrain, [x, y], [x, y], brush))
                  onEnd()
                }}
                onKeyDown={(event) => {
                  const directions: Record<string, readonly [number, number]> = {
                    ArrowUp: [0, -1],
                    ArrowRight: [1, 0],
                    ArrowDown: [0, 1],
                    ArrowLeft: [-1, 0],
                  }
                  const delta = directions[event.key]
                  if (!delta) return
                  event.preventDefault()
                  const nx = Math.max(0, Math.min(12, x + delta[0])),
                    ny = Math.max(0, Math.min(12, y + delta[1]))
                  const buttons = event.currentTarget.parentElement?.querySelectorAll('button')
                  buttons?.[ny * GRID_SIZE + nx]?.focus()
                }}
              >
                {lock === '敌军出生点'
                  ? '敌'
                  : lock?.startsWith('玩家 ')
                    ? `${lock[3]}P`
                    : lock === '老鹰基地'
                      ? ''
                      : lock
                        ? '·'
                        : ''}
              </button>
            )
          })}
        </div>
      </div>
      <p className="tank-editor-coordinate" role="status">
        {hint}
      </p>
      <p className="tank-editor-help">
        标记区域固定。键盘：方向键选格，空格绘制。一次拖动可整体撤销。
      </p>
    </div>
  )
}

export function TileSwatch({ tile }: { tile: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = ref.current?.getContext('2d')
    if (!context) return
    const grid = new TerrainGrid([tile])
    context.clearRect(0, 0, CELL_SIZE, CELL_SIZE)
    context.fillStyle = '#000'
    context.fillRect(0, 0, CELL_SIZE, CELL_SIZE)
    const kind = grid.getKind(0, 0)
    if (kind === TerrainKind.TREE) drawTreeCell(context, 0, 0)
    else drawTerrainCell(context, 0, 0, kind, grid.getWallMask(0, 0), 0)
  }, [tile])
  return <canvas ref={ref} width={CELL_SIZE} height={CELL_SIZE} aria-hidden="true" />
}
