# 领域实体

全局领域类型定义于 `src/types/index.ts`。游戏内部实体（如坦克、子弹、塔防敌人等）定义在各自游戏目录内，不在此跨游戏共享。

## Game

广场中的一个游戏条目。

```ts
interface Game {
  id: string             // 唯一标识，如 'tank-battle'；外部游戏同样需要 id
  name: string           // 展示名
  description: string    // 卡片简介
  tags: string[]         // 分类标签，用于筛选与展示
  difficulties: string[] // 难度档位，如 ['简单','中等','复杂']
  externalUrl?: string   // 存在时表示外部游戏，点击跳转而非挂载
  externalLabel?: string // 外部游戏按钮文案
}
```

内部游戏的 `Game` 由各 `manifest.ts` 的 `game` 字段提供，经 `src/games/registry.ts` 聚合；外部游戏在 `src/features/games/data.ts` 的 `externalGames` 中声明。

## User

本地玩家。

```ts
interface User {
  id: string
  name: string
  avatar: string
  createdAt: string  // ISO 时间
}
```

用户通过 `UserSelector` 组件在本地创建/切换，无密码认证。当前登录用户保存在 Zustand store（`mini-game-user`）。

## GameRecord

单局战绩，是排行与统计的数据源。

```ts
interface GameRecord {
  id: string
  userId: string
  gameId: string
  score: number
  duration: number       // 秒
  playedAt: string       // ISO 时间
  result: 'win' | 'lose' | 'complete'
}
```

- `win` / `lose`：有明确胜负的游戏（如井字棋、塔防、坦克大战）。
- `complete`：以分数结算的无尽/闯关游戏（如俄罗斯方块、贪吃蛇、24 点）。

## GameStat

单个游戏在某用户下的聚合统计。

```ts
interface GameStat {
  gameId: string
  gameName: string
  playCount: number
  bestScore: number
  totalTime: number
}
```

## UserStats

用户的总览统计，由 `getUserStats` 实时聚合 `GameRecord` 得出，不单独持久化。

```ts
interface UserStats {
  userId: string
  userName: string
  totalGames: number
  totalTime: number
  totalScore: number
  gameStats: GameStat[]   // 按 playCount 降序
}
```

## PlayRankItem

热门排行榜条目。

```ts
interface PlayRankItem {
  gameId: string
  gameName: string
  playCount: number
}
```

由 `defaultPlayRanking`（种子数据）与本地记录计数合并生成。

## 游戏注册接口

`src/games/manifest.ts` 定义了游戏模块的注册契约，不属于持久化实体，但是游戏域的核心接口：

```ts
interface GameManifest {
  game: Game
  presentation: GamePresentation  // { coverGradient, icon }
  load: () => Promise<GameModule> // 懒加载
}
```

## 游戏内成长实体（引力墓场专属）

`src/games/gravity-graveyard/progression.ts` 定义了跨局持久化的成长结构，仅该游戏使用：

```ts
interface GameProgression {
  liturgies: string[]  // 已解锁模块
  tools: string[]      // 已解锁引力工具
  ships: string[]      // 已解锁飞船
}
```
