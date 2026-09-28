import type { Direction, Position, SnakeLevel } from './levels'

export interface SnakeState {
  snake: Position[]
  direction: Direction
  apples: Position[]
  keys: string[]
  gem: boolean
  moves: number
  status: 'playing' | 'won' | 'lost'
  message: string
}

export const samePosition = (a: Position, b: Position) => a.x === b.x && a.y === b.y
const delta: Record<Direction, Position> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
}
const opposite: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
}

export function positions(level: SnakeLevel, symbol: string): Position[] {
  return level.map.flatMap((row, y) =>
    [...row].flatMap((tile, x) => (tile === symbol ? [{ x, y }] : [])),
  )
}

export function createState(level: SnakeLevel): SnakeState {
  return {
    snake: [...positions(level, '^'), ...positions(level, 's')],
    direction: 'UP',
    apples: positions(level, 'o'),
    keys: [],
    gem: false,
    moves: 0,
    status: 'playing',
    message: level.hint,
  }
}

// Buffer two corners, validating against the last queued turn, not a teleported neck.
export function queueDirection(
  direction: Direction,
  queue: Direction[],
  next: Direction,
): Direction[] {
  const previous = queue.at(-1) ?? direction
  if (queue.length >= 2 || next === previous || next === opposite[previous]) return queue
  return [...queue, next]
}

export function step(level: SnakeLevel, state: SnakeState, input = state.direction): SnakeState {
  if (state.status !== 'playing') return state
  const direction = input === opposite[state.direction] ? state.direction : input
  const offset = delta[direction]
  const entry = { x: state.snake[0].x + offset.x, y: state.snake[0].y + offset.y }
  const tileAt = (p: Position) => level.map[p.y]?.[p.x] ?? '#'
  const entrance = tileAt(entry)
  const destination = entrance === 'P' ? 'Q' : entrance === 'Q' ? 'P' : null
  const next = destination ? positions(level, destination)[0] : entry
  if (!next) return { ...state, status: 'lost', message: '传送门没有对应出口。' }

  for (const point of [entry, next]) {
    const tile = tileAt(point)
    const cause =
      tile === '#'
        ? '碰到墙了，换条路线再试一次。'
        : ['A', 'B'].includes(tile) && !state.keys.includes(tile.toLowerCase())
          ? `门 ${tile} 还没打开，先找到钥匙 ${tile.toLowerCase()}。`
          : state.snake.some((segment) => samePosition(segment, point))
            ? '碰到自己的身体了，转弯时多留一点空间。'
            : ''
    if (cause) return { ...state, direction, status: 'lost', message: cause }
  }

  const tile = tileAt(next)
  const ate = state.apples.some((apple) => samePosition(apple, next))
  const apples = state.apples.filter((apple) => !samePosition(apple, next))
  const foundKey = ['a', 'b'].includes(tile) && !state.keys.includes(tile)
  const foundGem = tile === '*' && !state.gem
  const won = tile === 'E' && apples.length === 0
  const message = won
    ? '苹果收齐，顺利到家！'
    : foundKey
      ? `拿到钥匙 ${tile}，门 ${tile.toUpperCase()} 已经打开！`
      : ate && apples.length === 0
        ? '苹果收齐了！去亮起的出口 E。'
        : foundGem
          ? '宝石到手！带着它走到出口。'
          : destination
            ? `已从 ${entrance} 到达 ${destination}，朝向不变。`
            : state.message
  return {
    snake: [next, ...(ate ? state.snake : state.snake.slice(0, -1))],
    direction,
    apples,
    keys: foundKey ? [...state.keys, tile] : state.keys,
    gem: state.gem || foundGem,
    moves: state.moves + 1,
    status: won ? 'won' : 'playing',
    message,
  }
}
