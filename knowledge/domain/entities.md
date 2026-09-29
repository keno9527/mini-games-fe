# 领域实体

共享展示与战绩类型定义于 `src/types/index.ts:1`，玩家文件及运行时校验定义于 `src/features/players/schema.ts:3`。游戏内部实体保留在各游戏目录。

## Game

```ts
interface Game {
  id: string
  name: string
  description: string
  tags: string[]
  difficulties: string[]
}
```

`Game` 来自各 manifest 的 `game` 字段，由注册表聚合。运行方式属于 manifest 的 `runtime`；首页隐藏名单属于展示策略，均不是 `Game` 的持久化字段。

## User

```ts
interface User {
  id: string
  name: string
  avatar: string
  createdAt: string // 可解析的时间字符串；创建时生成 ISO 时间
}
```

本机玩家无密码认证。用户信息保存在 `PlayerFile.player`，当前选择保存在 Zustand 内存中。玩家名称去空格后为 1–20 个字符，活跃玩家之间不允许忽略大小写的同名；创建时服务端生成 UUID（`src/features/players/schema.ts:34`、`scripts/player-data.ts:71`）。

## GameRecord

```ts
interface GameRecord {
  id: string
  userId: string
  gameId: string
  score: number
  duration: number // 秒
  playedAt: string
  result: 'win' | 'lose' | 'complete'
  level?: number
  campaignId?: string
  mode?: 'single' | 'coop' | 'practice'
}
```

一条记录代表游戏定义的一次结算，不一定代表一次页面访问或完整战役。例如打砖块按关卡尝试结算。`win` / `lose` 表示胜负，`complete` 表示完成；具体触发由游戏规则决定。

服务端要求分数和时长为非负安全整数、关卡为正安全整数，校验玩家和游戏归属，并要求同一玩家文件内记录 ID 唯一。ID 还承担结算幂等键的作用（`src/features/players/schema.ts:44`、`src/features/players/schema.ts:140`）。

## PlayerFile 与 Settlement

```ts
type ProgressData = Record<string, unknown>
interface PlayerGame {
  progress: ProgressData
  records: GameRecord[]
}
interface PlayerFile {
  version: 1
  player: User
  games: Record<string, PlayerGame>
  archived?: boolean
  legacyImported?: boolean
  guestImported?: boolean
}
interface Settlement {
  record: GameRecord
  progress: ProgressData
}
```

文件路径为 `data/players/<player.id>.json`。`parsePlayerFile` 只接受版本 1，校验文件内部归属和记录 ID；文件仓库另检查文件名与玩家 ID 一致。`archived` 保留档案但使其退出列表和排行，并阻止新结算；导入标记用于区分旧玩家导入与游客认领（`src/features/players/schema.ts:115`、`scripts/player-data.ts:95`）。

## ProgressData 与合并规则

`ProgressData` 是经过运行时校验的 JSON 对象。值支持嵌套对象、字符串数组、字符串、布尔值、null 和有限非负数；拒绝危险键、过深对象及超限数组（`src/features/players/schema.ts:72`）。不能因为 TypeScript 类型为 `unknown` 就存入任意运行时对象。

| 同字段旧值与新值 | 合并规则                                                       |
| ---------------- | -------------------------------------------------------------- |
| 都是对象         | 递归合并                                                       |
| 都是数组         | 去重并集                                                       |
| 都是数值         | 默认取最大值；`bestMoves` 取最小值；`lastPlayedLevel` 使用新值 |
| 其他情况         | 使用新值                                                       |

规则定义于 `src/features/players/schema.ts:95`，由客户端暂存和服务端结算共用。新增进度字段需核对其语义是否适合上述规则；它不是任意状态快照的覆盖协议。

## GameStat

```ts
interface GameStat {
  gameId: string
  gameName: string
  playCount: number
  bestScore: number
  totalTime: number
}
```

单个游戏在某玩家下的已保存记录聚合。

## UserStats

```ts
interface UserStats {
  userId: string
  userName: string
  totalGames: number
  totalTime: number
  totalScore: number
  gameStats: GameStat[]
}
```

实时从文件记录聚合，不单独持久化。`gameStats` 按次数降序，已移除注册的游戏仍保留在个人统计中（`src/api/index.ts:28`）。

## PlayRankItem

```ts
interface PlayRankItem {
  gameId: string
  gameName: string
  playCount: number
  totalDuration: number
}
```

来自未归档玩家的已保存结算，排除未注册游戏，没有种子数据。具体排序与首页过滤见 [数据流](../architecture/data-flow.md#2-广场首页加载)。

## 游戏注册接口

`src/games/manifest.ts:37` 定义注册契约：

```ts
interface GameManifest {
  game: Game
  presentation: GamePresentation
  runtime:
    | {
        kind: 'embedded'
        load: () => Promise<GameModule>
        href?: never
        openIn?: never
      }
    | {
        kind: 'external'
        href: `https://${string}`
        openIn: 'new-tab'
        load?: never
      }
}
```

`GamePresentation` 声明封面渐变、图标及可选徽标、按钮文案、展示变体。实际展示取决于消费方：首页卡片使用徽标、动作文案和变体类名，未消费封面渐变与图标字段；详细映射见 [前端页面与样式架构](../architecture/frontend-presentation.md#展示配置到页面的映射)。

`GameModule` 默认导出接收 `GameComponentProps` 的 React 组件。`embedded` 懒加载模块，`external` 在新标签页打开 HTTPS 站点。

## 游戏内成长实体（引力墓场专属）

```ts
interface GameProgression {
  liturgies: string[]
  tools: string[]
  ships: string[]
}
```

该结构记录解锁模块、工具和飞船。`src/games/gravity-graveyard/progression.ts:20` 按玩家和游戏从缓存读取、去重，并通过 `stageProgress` 暂存；持久化遵循共用结算流程。其他游戏的进度字段以各自模块为准，工程级存储差异见 [数据流](../architecture/data-flow.md#6-游戏内成长)。
