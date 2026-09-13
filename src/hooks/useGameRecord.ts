import { useCallback, useRef } from 'react'
import { createRecord } from '@/api'
import type { GameRecord } from '@/types'

type RecordResult = GameRecord['result']

interface UseGameRecordOptions {
  userId?: string
  gameId: string
}

interface SubmitOptions {
  score: number
  result?: RecordResult
  /** 不传则自动使用 start() 之后的经过时间 */
  duration?: number
}

/**
 * 统一封装游戏记录提交：防重复提交、自动计时、错误静默。
 *
 * 用法：
 *   const record = useGameRecord({ userId, gameId })
 *   record.start()                        // 开局时开始计时
 *   record.submit({ score, result })      // 结束时提交，duration 自动计算
 *   record.reset()                        // 重开时重置状态
 *
 * 对于运行时内部已计算 duration 的场景（如 tank-battle），可传入 duration：
 *   record.submit({ score, result, duration })
 */
export function useGameRecord({ userId, gameId }: UseGameRecordOptions) {
  const startTimeRef = useRef(0)
  const submittedRef = useRef(false)

  const start = useCallback(() => {
    startTimeRef.current = Date.now()
    submittedRef.current = false
  }, [])

  const reset = useCallback(() => {
    startTimeRef.current = 0
    submittedRef.current = false
  }, [])

  const submit = useCallback(
    async ({ score, result = 'complete', duration }: SubmitOptions) => {
      if (!userId || submittedRef.current) return
      submittedRef.current = true
      const dur = duration ?? Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
      try {
        await createRecord(userId, { gameId, score, duration: dur, result })
      } catch {
        // 记录提交失败不影响游戏体验，静默处理
      }
    },
    [userId, gameId],
  )

  return { start, reset, submit }
}
