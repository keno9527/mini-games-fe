import { solve, type Board, type Side } from './engine'

self.onmessage = (event: MessageEvent<{ board: Board; side: Side; remaining: number }>) => {
  const { board, side, remaining } = event.data
  self.postMessage(solve(board, side, remaining))
}
