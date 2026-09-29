# API 契约

`src/api/index.ts:11` 提供 Promise 形式的游戏、玩家和统计接口。其中游戏清单来自内存配置，玩家数据通过 `src/api/playerFiles.ts:55` 访问本机 HTTP 中间件。文件实体与合并规则见 [领域实体](../domain/entities.md)。

## 域名信息

接口使用同源相对路径 `/__player-data/players`。Vite dev / preview 负责提供服务；Host 限制及静态托管边界见 [系统上下文](../architecture/system-context.md)。

### HTTP 路由

相对于 `/__player-data/players`，路由由 `scripts/player-data.ts:153` 定义：

| 方法   | 路径                | 请求体                      | 成功响应                                      |
| ------ | ------------------- | --------------------------- | --------------------------------------------- |
| GET    | 空路径              | 无                          | 200，未归档的 `PlayerFile[]`                  |
| POST   | 空路径              | `{ name, avatar? }`         | 201，新建 `PlayerFile`                        |
| GET    | `/:id`              | 无                          | 200，`PlayerFile`；此路由本身可读取已归档文件 |
| DELETE | `/:id`              | 无                          | 200，标记 `archived: true` 的完整档案         |
| POST   | `/:id/settlements`  | `Settlement`                | 200，合并后的 `PlayerFile`                    |
| POST   | `/import`           | 旧数据转换出的 `PlayerFile` | 200，已导入的 `PlayerFile`                    |
| POST   | `/:id/import-guest` | 归属该玩家的 `PlayerFile`   | 200，已认领游客进度的 `PlayerFile`            |

写入 JSON 体的路由要求 `Content-Type: application/json`，请求体不超过 5 MB。响应为 JSON，设置 `Cache-Control: no-store`。

### 错误与客户端行为

| 状态 / 条件             | 含义                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| 400                     | JSON、ID、schema、归属、记录冲突等校验失败；未单独标状态的文件读写异常也走此分支 |
| 403 / 404               | 非本机或跨站请求 / 文件或接口不存在                                              |
| 409                     | 活跃玩家同名、归档玩家结算或导入冲突                                             |
| 413 / 415               | 请求体超过限制 / 非 JSON Content-Type                                            |
| 网络错误 / 非 JSON 响应 | 客户端分别提示无法连接文件服务 / 当前页面缺少文件服务                            |

失败响应为 `{ error: string }`。`fileRequest` 将服务端错误转为异常，不把静态站点的 HTML 回退误当作空档案。不能只靠函数返回 Promise 推断其不依赖网络。

## 游戏

### getGames()

```ts
getGames(): Promise<Game[]>
```

返回全部已注册游戏的元数据。首页隐藏过滤由 `Home` 执行，不影响此函数。返回实体不包含 runtime（`src/features/games/data.ts:4`）。

### getGame(id)

```ts
getGame(id: string): Promise<Game>
```

按 ID 读取注册清单，不存在时抛出 `Error('游戏不存在')`。

## 用户

### getUsers()

```ts
getUsers(): Promise<User[]>
```

读取未归档玩家文件列表并提取 `player`。服务端列表会解析目录中的 JSON；损坏档案导致请求报错，不静默隐藏（`scripts/player-data.ts:54`）。

### createUser(name, avatar?)

```ts
createUser(name: string, avatar?: string): Promise<User>
```

去除名称首尾空格，默认 avatar 为 `default`。服务端校验名称、检查同名，生成 UUID 和创建时间；创建空 `games` 的版本 1 文件。函数只返回用户，选择前仍需 `loadPlayerFile` 加载档案（`src/components/UserSelector.tsx:51`）。

### deleteUser(id)

```ts
deleteUser(id: string): Promise<void>
```

将档案标为归档，保留文件、战绩和进度。归档玩家退出列表和排行，不能继续提交结算。当前没有解除归档的 HTTP 路由。

### 档案加载与旧数据导入

| 入口                          | 行为                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `loadPlayerFile(id)`          | 请求、校验并缓存档案；拒绝归档玩家；恢复属于该玩家的待保存进度。`src/api/playerFiles.ts:79`       |
| `importLegacyPlayer(player)`  | 从浏览器旧数据构造文件，保持身份和记录 ID，调用 `/import`。`src/features/players/migration.ts:72` |
| `importGuestProgress(player)` | 将兼容的游客进度归属已有玩家，调用 `/:id/import-guest`。`src/features/players/migration.ts:89`    |

服务端以 `legacyImported` / `guestImported` 分别去重导入；成功不会删除浏览器原始数据。具体迁移范围见 [数据流](../architecture/data-flow.md#旧数据迁移)。

## 战绩

### getRecords(userId)

```ts
getRecords(userId: string): Promise<GameRecord[]>
```

读取玩家文件，合并所有游戏记录，按 `playedAt`、`id` 升序返回。

### createRecord(userId, data)

```ts
createRecord(
  userId: string,
  data: Pick<GameRecord, 'gameId' | 'score' | 'duration' | 'result'> &
    Partial<Pick<GameRecord, 'id' | 'level' | 'campaignId' | 'mode'>>,
): Promise<GameRecord>
```

`src/api/index.ts:77` 校验玩家 ID 格式和游戏存在；规范化 score/duration，生成默认 UUID 和当前 `playedAt`，将记录与该游戏当前缓存进度一起交给 `commitSettlement`。仅在文件接口成功后返回记录，失败时抛出异常并保留待提交结算。

服务端校验字段与归属，按记录 ID 防重，合并规则见 [领域实体](../domain/entities.md#progressdata-与合并规则)。网络重试应通过 `retrySaves()` 发送已有快照；重新调用 `createRecord` 会生成新的时间或 ID，不能视为同一结算的重试。

### getUserStats(id)

```ts
getUserStats(id: string): Promise<UserStats>
```

聚合文件中的已保存战绩：总场次、时长、分数、按游戏分组的统计。`gameStats` 按次数降序；历史游戏无法解析名称时回退为 ID。文件不存在或损坏时沿用文件接口错误。

## 排行榜

### getPlayRanking()

```ts
getPlayRanking(): Promise<PlayRankItem[]>
```

从未归档玩家文件统计已结算记录，排除未注册游戏和零记录游戏，没有种子数据。按次数降序、总时长降序、游戏 ID 字典序排列；首页再过滤隐藏游戏，展示前五名（`src/api/index.ts:96`、`src/pages/Home.tsx:43`）。

## 游戏内成长 API

```ts
readPlayerProgress(gameId: string, userId?: string): ProgressData
stageProgress(gameId: string, userId: string | undefined, progress: ProgressData): void
commitSettlement(settlement: Settlement): Promise<void>
retrySaves(): Promise<void>
```

上述函数定义于 `src/api/playerFiles.ts:88`。读取返回克隆数据，未加载档案时为空对象；暂存要求有效且已加载的玩家，校验并合并到内存。`stageProgress` 自身不写文件；结算负责提交快照，`retrySaves` 串行重试当前 pending 项。

各游戏 `progression.ts` / `progress.ts` 在此基础上解释游戏字段。引力墓场的读写入口均支持 `userId`；折光回廊等读取玩家缓存；扫雷、五子棋及编辑器仍有浏览器存储分支。边界和键清单统一见 [数据流](../architecture/data-flow.md#6-游戏内成长)。
