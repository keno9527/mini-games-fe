import { parseBoard } from './engine'

// Original teaching positions, ordered by the shortest forced win in red moves.
export const levels = [
  {
    id: 'rook-ladder',
    name: '双车锁宫',
    theme: '双车配合',
    moves: 1,
    tip: '一车封住退路，另一车沿底线完成最后一击。',
    fen: '4k4/R8/1R7/9/9/4P4/9/9/9/4K4',
  },
  {
    id: 'cannon-screen',
    name: '借马架炮',
    theme: '炮架运用',
    moves: 1,
    tip: '炮需要一个炮架。留意中路的红马，以及保护它的车。',
    fen: '3aka3/R3N4/9/9/C8/9/9/9/9/4K4',
  },
  {
    id: 'rook-pursuit',
    name: '双车追将',
    theme: '连续将军',
    moves: 2,
    tip: '先用一辆车压缩将的空间，再让另一辆车接力。',
    fen: '4k4/9/R8/1R7/9/4P4/9/9/9/4K4',
  },
  {
    id: 'horse-cannon',
    name: '马炮合围',
    theme: '马炮配合',
    moves: 2,
    tip: '马既能控制落点，也能成为炮架。试着让两枚棋子相互配合。',
    fen: '3a5/3k4C/9/3N5/9/9/9/9/9/4K4',
  },
  {
    id: 'pawn-assault',
    name: '小兵破阵',
    theme: '过河兵',
    moves: 2,
    tip: '过河兵可以横走。利用小兵控制九宫，再让车完成围堵。',
    fen: '3a5/5k1PR/P8/9/9/9/9/9/9/4K4',
  },
  {
    id: 'rook-horse',
    name: '车马联攻',
    theme: '三步谋杀',
    moves: 3,
    tip: '车先切入要道，迫使黑将移动，再寻找马能控制的关键位置。',
    fen: '4ka3/9/R8/9/6N2/9/9/9/9/3K5',
  },
  {
    id: 'cannon-net',
    name: '马炮织网',
    theme: '封锁退路',
    moves: 3,
    tip: '别急着移动炮。先考虑马能否一边将军，一边封住黑将的退路。',
    fen: '3a5/3k1C3/9/7N1/9/9/9/9/9/4K4',
  },
  {
    id: 'twin-horses',
    name: '双马归槽',
    theme: '双马协作',
    moves: 3,
    tip: '两匹马要轮流控制九宫。注意马腿，也别忘了帅能限制黑将所在的纵线。',
    fen: '3k1a3/9/9/5N3/2N6/9/9/9/9/5K3',
  },
].map((level) => ({ ...level, board: parseBoard(level.fen) }))

export type Level = (typeof levels)[number]
