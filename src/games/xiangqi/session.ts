import { applyMove, isInCheck, legalMoves, type Board, type Move } from './engine'
import type { Level } from './levels'

export interface Session {
  board: Board
  phase: 'red' | 'black' | 'won' | 'lost'
  moves: number
  limit: number
  lastMove: Move | null
  history: { board: Board; lastMove: Move | null }[]
  reason: string
}

export function newSession(level: Level): Session {
  return {
    board: level.board,
    phase: 'red',
    moves: 0,
    limit: level.moves,
    lastMove: null,
    history: [],
    reason: '',
  }
}

export function sessionReducer(
  state: Session,
  action: { type: 'move'; move: Move } | { type: 'undo' },
): Session {
  if (state.phase === 'won' || state.phase === 'lost') return state
  if (action.type === 'undo') {
    const previous = state.history.at(-1)
    return previous
      ? {
          ...state,
          ...previous,
          phase: 'red',
          moves: state.moves - 1,
          history: state.history.slice(0, -1),
          reason: '',
        }
      : state
  }
  const { move } = action
  if (!legalMoves(state.board, state.phase).some((m) => m.from === move.from && m.to === move.to))
    return state
  const board = applyMove(state.board, move)
  const red = state.phase === 'red'
  const moves = state.moves + (red ? 1 : 0)
  const next = {
    ...state,
    board,
    moves,
    lastMove: move,
    history: red
      ? [...state.history, { board: state.board, lastMove: state.lastMove }]
      : state.history,
  }
  const opponent = red ? 'black' : 'red'
  if (!legalMoves(board, opponent).length) {
    return {
      ...next,
      phase: red ? 'won' : 'lost',
      reason: isInCheck(board, opponent)
        ? red
          ? '黑将已被将死。'
          : '红帅被将死了。'
        : red
          ? '黑方无合法着法，困毙获胜。'
          : '红方无合法着法，已被困毙。',
    }
  }
  if (red && moves >= state.limit)
    return { ...next, phase: 'lost', reason: `${state.limit} 步已用完，黑方仍有合法应对。` }
  return { ...next, phase: opponent }
}
