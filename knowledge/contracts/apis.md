# API 契约

本项目无后端 HTTP 服务。`src/api/index.ts` 是对 `localStorage` 的异步封装，统一返回 Promise，以便未来替换为真实接口时调用方无需改动。

所有函数定义于 `src/api/index.ts`。

## 域名信息

- 不适用（纯前端，无 API 域名）。
- 数据存储于浏览器 `localStorage`，同源策略下隔离。

## 游戏

### getGames()

```ts
getGames(): Promise<Game[]>
```

返回全部游戏清单（内部注册 + 外部游戏）。当前为同步常量 `gameCatalog` 的 Promise 包装。

### getGame(id)

```ts
getGame(id: string): Promise<Game>
```

按 id 获取单个游戏；不存在时抛出 `Error('game not found')`。

## 用户

### getUsers()

```ts
getUsers(): Promise<User[]>
```

返回本地全部用户。

### createUser(name, avatar?)

```ts
createUser(name: string, avatar?: string): Promise<User>
```

创建用户。`name` 去空格后不能为空，否则抛出 `Error('user name is required')`。

### deleteUser(id)

```ts
deleteUser(id: string): Promise<void>
```

删除用户，同时级联删除该用户的全部对局记录。

## 战绩

### getRecords(userId)

```ts
getRecords(userId: string): Promise<GameRecord[]>
```

返回指定用户的全部对局记录。

### createRecord(userId, data)

```ts
createRecord(
  userId: string,
  data: { gameId: string; score: number; duration: number; result: 'win' | 'lose' | 'complete' }
): Promise<GameRecord>
```

提交一条对局记录。

- 校验用户与游戏存在，否则分别抛出 `Error('user not found')` / `Error('game not found')`。
- `score` 与 `duration` 会被 `Math.round` 并 `Math.max(0, ...)` 规范化。
- 自动生成 `id`（优先 `crypto.randomUUID`）与 `playedAt`（ISO 时间）。

### getUserStats(id)

```ts
getUserStats(id: string): Promise<UserStats>
```

聚合用户战绩：总场次、总时长、总分、按游戏分组的 `GameStat[]`（按游玩次数降序）。用户不存在时抛出 `Error('user not found')`。

## 排行榜

### getPlayRanking()

```ts
getPlayRanking(): Promise<PlayRankItem[]>
```

返回热门排行。合并 `defaultPlayRanking` 种子数据与本地 `GameRecord` 计数（种子数据作为基数，本地记录在此之上累加），按 `playCount` 降序。

## 游戏内成长 API

引力墓场的跨局成长不走 `src/api/`，而由 `src/games/gravity-graveyard/progression.ts` 直接读写 localStorage：

```ts
getGameProgression(gameId: string): GameProgression
saveGameProgression(gameId: string, progression: GameProgression): void
```

详见 [domain/entities.md](../domain/entities.md) 中的 `GameProgression`。
