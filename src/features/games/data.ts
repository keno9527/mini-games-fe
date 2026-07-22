import type { Game, PlayRankItem } from '../../types'

export const gameCatalog: Game[] = [
  {
    id: 'minesweeper',
    name: '扫雷',
    description: '经典扫雷：左键揭开、右键插旗。含简单、中等、复杂三档盘面与雷数。',
    coverImage: '/covers/minesweeper.svg',
    tags: ['益智', '经典'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'snake',
    name: '贪吃蛇',
    description: '吃食物变长，别撞墙和自己。三档难度对应不同场地大小与速度。',
    coverImage: '/covers/snake.svg',
    tags: ['休闲', '经典'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: '24points',
    name: '24点',
    description: '用四张牌凑 24。三档难度对应不同时长挑战。',
    coverImage: '/covers/24points.svg',
    tags: ['益智', '数学'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'memory',
    name: '记忆翻牌',
    description: '翻开找相同一对。三档难度对应不同对数。',
    coverImage: '/covers/memory.svg',
    tags: ['记忆', '益智'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'whack-a-mole',
    name: '打地鼠',
    description: '限时点击地鼠。三档难度对应洞数、时长与出现速度。',
    coverImage: '/covers/whack-a-mole.svg',
    tags: ['反应', '休闲'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'slide-puzzle',
    name: '数字华容道',
    description: '滑动方块复原顺序。三档对应 3x3、4x4、5x5 盘面。',
    coverImage: '/covers/slide-puzzle.svg',
    tags: ['益智', '经典'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'reaction-test',
    name: '反应测试',
    description: '变绿后尽快点击，多回合累计得分。三档对应回合数与惩罚力度。',
    coverImage: '/covers/reaction-test.svg',
    tags: ['反应', '休闲'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'tic-tac-toe',
    name: '井字棋',
    description: '先手 X 对战电脑 O。简单随机、中等会堵、复杂为极小化极大最优走法。',
    coverImage: '/covers/tic-tac-toe.svg',
    tags: ['益智', '对战'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'tetris',
    name: '俄罗斯方块',
    description: '下落方块，旋转拼消。方向键平移/旋转/加速，空格硬降。三档对应起始速度与加速节奏。',
    coverImage: '/covers/tetris.svg',
    tags: ['经典', '消除'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'breakout',
    name: '打砖块',
    description: '鼠标控制挡板，物理反弹小球清空砖墙。三档对应砖墙行数、挡板大小与球速。',
    coverImage: '/covers/breakout.svg',
    tags: ['反应', '物理'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'wordle',
    name: '猜词',
    description: '按字母位置反馈颜色线索。简单 4 字母、中等 5 字母、复杂 6 字母且次数更少。',
    coverImage: '/covers/wordle.svg',
    tags: ['文字', '推理'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'gomoku',
    name: '五子棋',
    description: '15x15 棋盘，你执黑先手。简单随机、中等会守必杀、复杂启用棋形评估。',
    coverImage: '/covers/gomoku.svg',
    tags: ['对战', '策略'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'starlight-catcher',
    name: '星光收集局',
    description: '移动星环、接住星光、避开陨石，在 40 秒里完成一场轻快治愈的街机挑战。',
    coverImage: '/covers/starlight-catcher.svg',
    tags: ['治愈', '街机', '反应', '外部游戏'],
    difficulties: ['简单'],
    externalUrl: 'https://starlight-catcher-20260721.dalio-liu.chatgpt.site',
    externalLabel: '去收集星光',
  },
]

export const defaultPlayRanking: PlayRankItem[] = [
  { gameId: 'starlight-catcher', gameName: '星光收集局', playCount: 1396 },
  { gameId: 'snake', gameName: '贪吃蛇', playCount: 1268 },
  { gameId: 'minesweeper', gameName: '扫雷', playCount: 986 },
  { gameId: 'tetris', gameName: '俄罗斯方块', playCount: 872 },
  { gameId: 'memory', gameName: '记忆翻牌', playCount: 765 },
]

export function getCatalogGame(id: string): Game | undefined {
  return gameCatalog.find(game => game.id === id)
}
