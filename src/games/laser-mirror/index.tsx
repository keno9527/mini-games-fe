import { useGamePlay } from '@/hooks/useGamePlay'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useGameRecord } from '@/hooks/useGameRecord'
import {
  findHint,
  positionKey,
  rotateMirror,
  starsFor,
  traceLaser,
  type Mirror,
  type Position,
} from './engine'
import { LASER_LEVELS } from './levels'
import { readProgress, recordCompletion, saveProgress } from './progression'
import '../game-surfaces.css'

interface Props {
  userId?: string
  gameId: string
}

const directionGlyph = { N: '↑', E: '→', S: '↓', W: '←' } as const

export default function LaserMirror({ userId, gameId }: Props) {
  const [levelIndex, setLevelIndex] = useState(0)
  const play = useGamePlay(gameId)
  const level = LASER_LEVELS[levelIndex]
  const [mirrors, setMirrors] = useState<Mirror[]>(() => level.mirrors.map((item) => ({ ...item })))
  const [history, setHistory] = useState<Mirror[][]>([])
  const [moves, setMoves] = useState(0)
  const [usedHint, setUsedHint] = useState(false)
  const [settled, setSettled] = useState(false)
  const [progression, setProgression] = useState(() => readProgress(gameId, userId))
  const { start, reset: resetRecord, submit } = useGameRecord({ userId, gameId })
  const trace = useMemo(() => traceLaser(level, mirrors), [level, mirrors])
  const stars = starsFor(moves, level.par, usedHint)

  const loadLevel = useCallback(
    (index: number) => {
      const next = LASER_LEVELS[index]
      if (!next || index >= progression.unlocked) return
      play.stop()
      setLevelIndex(index)
      setMirrors(next.mirrors.map((item) => ({ ...item })))
      setHistory([])
      setMoves(0)
      setUsedHint(false)
      setSettled(false)
      resetRecord()
      start()
    },
    [progression.unlocked, resetRecord, start, play],
  )

  useEffect(() => {
    start()
  }, [start])

  useEffect(() => {
    if (!trace.solved || settled) return
    play.stop()
    setSettled(true)
    const next = recordCompletion(
      progression,
      level.id,
      levelIndex,
      moves,
      stars,
      LASER_LEVELS.length,
    )
    setProgression(next)
    saveProgress(gameId, userId, next)
    void submit({ score: stars * 1000 + Math.max(0, 250 - moves * 10), result: 'win' })
  }, [
    gameId,
    level.id,
    levelIndex,
    moves,
    progression,
    settled,
    stars,
    submit,
    trace.solved,
    play,
    userId,
  ])

  const turnMirror = (mirrorIndex: number) => {
    if (settled) return
    play.start()
    setHistory((current) => [...current, mirrors.map((item) => ({ ...item }))])
    setMirrors((current) =>
      current.map((mirror, index) => (index === mirrorIndex ? rotateMirror(mirror) : mirror)),
    )
    setMoves((current) => current + 1)
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous || settled) return
    setMirrors(previous)
    setHistory((current) => current.slice(0, -1))
    setMoves((current) => Math.max(0, current - 1))
  }

  const reset = () => {
    play.restart()
    setMirrors(level.mirrors.map((item) => ({ ...item })))
    setHistory([])
    setMoves(0)
    setUsedHint(false)
    setSettled(false)
    resetRecord()
    start()
  }

  const hint = () => {
    const index = findHint(level, mirrors)
    if (index === undefined || settled) return
    play.start()
    setHistory((current) => [...current, mirrors.map((item) => ({ ...item }))])
    setMirrors((current) =>
      current.map((mirror, mirrorIndex) =>
        mirrorIndex === index ? { ...mirror, orientation: level.solution[index] } : mirror,
      ),
    )
    setUsedHint(true)
  }

  const gridStyle = {
    '--laser-cols': level.cols,
  } as CSSProperties & Record<'--laser-cols', number>

  return (
    <section className="game-surface laser-room">
      <header className="gs-heading">
        <div>
          <span className="gs-eyebrow">OPTICAL PUZZLE · {level.difficulty}</span>
          <h2>{level.name}</h2>
        </div>
        <span className="laser-level-count">
          {levelIndex + 1} / {LASER_LEVELS.length}
        </span>
      </header>

      <div className="gs-toolbar">
        <div className="laser-levels" aria-label="选择关卡">
          {LASER_LEVELS.map((item, index) => {
            const result = progression.results[item.id]
            const unlocked = index < progression.unlocked
            return (
              <button
                type="button"
                key={item.id}
                disabled={!unlocked}
                aria-pressed={index === levelIndex}
                aria-label={`${item.name}${unlocked ? '' : '，未解锁'}`}
                onClick={() => loadLevel(index)}
              >
                <span>{unlocked ? index + 1 : '·'}</span>
                <small>{result ? '★'.repeat(result.stars) : item.difficulty.slice(0, 1)}</small>
              </button>
            )
          })}
        </div>
      </div>

      <div className="gs-metrics">
        <div>
          <span>步数</span>
          <strong>{moves}</strong>
        </div>
        <div>
          <span>标准</span>
          <strong>{level.par}</strong>
        </div>
        <div>
          <span>水晶</span>
          <strong>
            {trace.litCrystals.size}/{level.crystals.length}
          </strong>
        </div>
      </div>

      <div className="gs-play-layout laser-layout">
        <div>
          <div className="laser-board-wrap">
            <div className="laser-board" style={gridStyle} role="grid" aria-label={level.name}>
              {Array.from({ length: level.rows * level.cols }, (_, cellIndex) => {
                const position: Position = {
                  row: Math.floor(cellIndex / level.cols),
                  col: cellIndex % level.cols,
                }
                const key = positionKey(position)
                const mirrorIndex = mirrors.findIndex((item) => positionKey(item) === key)
                const mirror = mirrorIndex >= 0 ? mirrors[mirrorIndex] : undefined
                const emitter = level.emitters.find((item) => positionKey(item) === key)
                const crystal = level.crystals.some((item) => positionKey(item) === key)
                const wall = level.walls?.some((item) => positionKey(item) === key)
                const splitter = level.splitters?.some((item) => positionKey(item) === key)
                const lit = trace.litCrystals.has(key)
                const energized = trace.energized.has(key)
                const beamDirections = trace.edges
                  .filter((edge) => positionKey(edge.from) === key || positionKey(edge.to) === key)
                  .map((edge) => edge.direction)
                const horizontalBeam = beamDirections.some(
                  (direction) => direction === 'E' || direction === 'W',
                )
                const verticalBeam = beamDirections.some(
                  (direction) => direction === 'N' || direction === 'S',
                )

                return (
                  <button
                    type="button"
                    role="gridcell"
                    key={key}
                    className={`laser-cell${energized ? ' is-energized' : ''}${lit ? ' is-lit' : ''}`}
                    disabled={!mirror || settled}
                    aria-label={mirror ? `镜面 ${mirror.orientation}，点击旋转` : undefined}
                    onClick={() => mirror && turnMirror(mirrorIndex)}
                  >
                    {wall && <span className="laser-wall">▦</span>}
                    {emitter && (
                      <span className="laser-emitter">{directionGlyph[emitter.direction]}</span>
                    )}
                    {mirror && <span className="laser-mirror">{mirror.orientation}</span>}
                    {splitter && <span className="laser-splitter">◇</span>}
                    {crystal && <span className="laser-crystal">◆</span>}
                    {horizontalBeam && <span className="laser-beam is-horizontal" />}
                    {verticalBeam && <span className="laser-beam is-vertical" />}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="laser-description">{level.description}</p>
        </div>

        <aside className="gs-sidebar">
          <div className="gs-panel">
            <span className="gs-eyebrow">当前光路</span>
            <h3>{trace.solved ? `${'★'.repeat(stars)} 通关` : '调整镜面'}</h3>
            <p>
              {trace.solved ? `使用 ${moves} 步点亮全部水晶。` : '点击镜面旋转；墙体会吸收光束。'}
            </p>
          </div>
          <button type="button" className="gs-primary" onClick={hint} disabled={settled}>
            提示
          </button>
          <button
            type="button"
            className="gs-secondary"
            onClick={undo}
            disabled={!history.length || settled}
          >
            撤销
          </button>
          <button type="button" className="gs-secondary" onClick={reset}>
            重置
          </button>
          {settled && levelIndex + 1 < LASER_LEVELS.length && (
            <button type="button" className="gs-primary" onClick={() => loadLevel(levelIndex + 1)}>
              下一关
            </button>
          )}
        </aside>
      </div>

      <footer className="gs-footer">
        <span>镜面 / 与 \ 会改变光束方向</span>
        <span>{usedHint ? '已使用提示 · 本局最高 1 星' : '未使用提示'}</span>
      </footer>
    </section>
  )
}
