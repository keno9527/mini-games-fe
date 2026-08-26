import { useEffect, useRef } from 'react'
import { createRecord, getUserStats } from '../../api'
import type { GameComponentProps } from '../manifest'
import { mountTankBattle, type TankBattleHandle } from './runtime.ts'

export default function TankBattle({ userId, gameId }: GameComponentProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return

    let game: TankBattleHandle | undefined
    let cancelled = false

    const startGame = async () => {
      let initialHighScore = 0
      if (userId) {
        try {
          const stats = await getUserStats(userId)
          initialHighScore = stats.gameStats.find(stat => stat.gameId === gameId)?.bestScore ?? 0
        } catch {
          // 战绩读取失败时从 0 开始，不影响游戏本体。
        }
      }

      if (cancelled) return
      game = mountTankBattle(canvas, stage, {
        initialHighScore,
        onGameOver: result => {
          if (!userId) return
          createRecord(userId, {
            gameId,
            score: result.score,
            duration: result.duration,
            result: result.victory ? 'win' : 'lose',
          }).catch(() => {})
        },
      })
    }

    void startGame()
    return () => {
      cancelled = true
      game?.destroy()
    }
  }, [gameId, userId])

  return (
    <section className="overflow-hidden rounded-lg border-4 border-[#4d4d4d] bg-black shadow-[0_8px_0_#050505]">
      <div
        ref={stageRef}
        className="flex min-h-[240px] w-full items-center justify-center overflow-auto bg-black p-3 md:p-5"
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          className="block max-w-none [image-rendering:pixelated]"
          aria-label="坦克大战游戏画布"
        />
      </div>
      <div className="grid gap-2 border-t-2 border-[#343434] bg-[#111] px-4 py-3 font-mono-crt text-sm tracking-wide text-[#d8d8d8] md:grid-cols-2">
        <p>移动：方向键 / WASD</p>
        <p>开火：空格 / J　暂停：P / Esc</p>
      </div>
    </section>
  )
}
