# 数据流

## 1. 应用启动

1. `index.html` 加载 `src/main.tsx`。
2. `main.tsx` 挂载 `<App />`，`App.tsx` 配置 `HashRouter` 与三条路由：`/`、`/game/:id`、`/profile`。
3. `src/store/userStore.ts` 的 Zustand store 从 `localStorage`（key: `mini-game-user`）恢复当前用户。

## 2. 广场首页加载

```
Home.tsx
  ├─ getGames()          → features/games/data.ts: gameCatalog
  │                       （registry 聚合全部 manifest）
  ├─ getPlayRanking()    → api/index.ts: 合并 defaultPlayRanking 与本地记录
  └─ 渲染 GameCard 网格 + 排行榜侧栏
```

- `getGames()` 直接返回 `gameCatalog` 常量（同步值包装为 Promise）。
- `getPlayRanking()` 读取 `localStorage` 中的对局记录，按 `gameId` 聚合计数，与种子排行合并后排序。
- 已下架游戏的历史记录仍保留并参与统计；首页排行保留该条目，但不再链接到无效的游戏详情页。

## 3. 进入游戏

```
用户点击 GameCard / 排行榜条目
  └─ GameLaunchLink
       ├─ embedded → Link to /game/:id
       │                  └─ GameDetail → getGameComponent → <Suspense>
       ├─ external → <a target="_blank" rel="noreferrer">
       └─ 已下架 → <span aria-disabled="true">
```

- `embedded` 游戏通过 `runtime.load` 按需加载，未访问的游戏不进入主包。
- `external` 游戏由统一启动入口打开外部站点，不经过 `GameDetail`。卡片和排行榜不直接判断运行方式。

## 4. 对局与战绩提交流

游戏内部运行时（Canvas/DOM）独立于广场框架。对局结束时通过 `src/api/index.ts` 的 `createRecord` 写入：

```
游戏组件
  └─ createRecord(userId, { gameId, score, duration, result })
       ├─ 校验 user 与 game 存在
       ├─ 生成 record id（crypto.randomUUID 或时间戳兜底）
       ├─ 追加到 localStorage key: mini-games-local-records
       └─ 返回 GameRecord
```

部分游戏使用 `src/hooks/useGameRecord.ts` 统一封装（防重复提交 + 自动计时）；其余游戏内联了等价逻辑。

## 5. 个人统计

`Profile.tsx` 调用 `getUserStats(userId)`：

- 读取该用户的全部 `GameRecord`；
- 按 `gameId` 聚合：`playCount`、`bestScore`、`totalTime`；
- 返回 `UserStats`，按游玩次数排序。

## 6. 游戏内成长

部分游戏有独立的跨局成长系统，不与战绩记录混用：

```
gravity-graveyard/progression.ts
  ├─ getGameProgression(gameId)  读 localStorage key: mini-games-local-progression:<gameId>
  └─ saveGameProgression(...)    写回（去重 + 容错）
```

存储结构：`{ liturgies: string[], tools: string[], ships: string[] }`，记录已解锁的模块/工具/飞船。

折光回廊按游戏和用户隔离关卡进度：

```
laser-mirror/progression.ts
  ├─ readProgress(gameId, userId?)  读取已解锁关卡、星级与最佳步数
  ├─ recordCompletion(...)          以更高星级、更少步数合并通关结果
  └─ saveProgress(...)              写回 localStorage，存储失败不阻断游戏
```

## 7. localStorage 键总览

| Key                                                | 写入方                                   | 内容                            |
| -------------------------------------------------- | ---------------------------------------- | ------------------------------- |
| `mini-games-local-users`                           | `api/index.ts`                           | 用户列表                        |
| `mini-games-local-records`                         | `api/index.ts`                           | 全部对局记录                    |
| `mini-game-user`                                   | `store/userStore.ts`                     | 当前登录用户（Zustand persist） |
| `mini-games-local-progression:<gameId>`            | `games/gravity-graveyard/progression.ts` | 游戏内成长                      |
| `mini-games-laser-mirror:<gameId>:<userId\|guest>` | `games/laser-mirror/progression.ts`      | 关卡解锁、星级与最佳步数        |
