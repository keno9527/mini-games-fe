# 模块划分与分层依赖

## 分层总览

项目采用“广场框架 + 游戏模块”的结构。浏览器层负责路由、玩家入口、游戏运行与结算；本机 Vite 中间件负责文件读写，双方共用玩家 schema。

```text
App / pages / components
  ├─ store/userStore → api/playerFiles → 同源 HTTP
  ├─ features/games → games/registry → manifest → 懒加载游戏
  └─ 游戏 → api/index / hooks → api/playerFiles
                                  ↓
                         features/players/schema
                                  ↑
Vite → scripts/player-data → data/players/*.json
```

这是关键调用关系，具体调用与状态变化见 [数据流](./data-flow.md)。游戏目录内部不应反向依赖页面或其他游戏的内部实现；共用输入能力放在 `src/features/gamepad/`。

## 目录职责

| 目录                                     | 职责                                  | 关键入口                                                                             |
| ---------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/pages/`                             | 广场、游戏详情、个人战绩、手柄诊断    | `Home.tsx:24`、`GameDetail.tsx:10`、`Profile.tsx`、`GamepadTest.tsx`                 |
| `src/components/`                        | 通用 UI、玩家准入、保存反馈           | `PlayerGate.tsx:5`、`UserSelector.tsx:13`、`SaveStatus.tsx:5`                        |
| `src/features/games/`                    | 注册清单适配、展示辅助、排行比较      | `data.ts:4`、`catalog.ts:33`、`playStats.ts:55`                                      |
| `src/features/players/`                  | 文件 schema、校验、合并及旧数据迁移   | `schema.ts:8`、`migration.ts:22`                                                     |
| `src/features/gamepad/`                  | 手柄监控与玩家绑定                    | `monitor.ts:96`、`players.ts:35`                                                     |
| `src/games/`                             | manifest、注册表与游戏实现            | `manifest.ts:37`、`registry.ts:18`                                                   |
| `src/api/`                               | HTTP 客户端、内存进度、结算队列与统计 | `playerFiles.ts:55`、`index.ts:28`                                                   |
| `src/store/`、`src/hooks/`、`src/types/` | 当前玩家、跨游戏 hook、共享类型       | `userStore.ts:13`、`useGameRecord.ts:32`、`useGamePlay.ts:5`、`src/types/index.ts:1` |
| `scripts/`、`data/players/`              | 本机文件服务、构建脚本与持久化数据    | `scripts/player-data.ts:20`、`scripts/prepare-sites-worker.mjs:7`                    |

## 游戏模块契约

每个游戏目录必须包含默认导出的 `manifest.ts`，契约定义见 [领域实体](../domain/entities.md#游戏注册接口) 和 `src/games/manifest.ts:37`。

`embedded` 游戏接收 `{ userId?, gameId }`。虽然类型允许省略 `userId`，当前应用会先完成玩家选择和档案加载，`GameDetail` 使用游戏 ID 与玩家 ID 组成的 key 挂载游戏，切换玩家时重建游戏实例（`src/pages/GameDetail.tsx:65`）。游戏按自身结算粒度调用 `createRecord`；进度暂存和持久化的区别见 [数据流](./data-flow.md#4-对局与战绩提交流)。

`external` 游戏提供 HTTPS 地址，由统一启动入口打开新标签页，不挂载本地组件。注册、首页隐藏和移除注册的不同效果见 [开发手册](../runbooks/development.md#添加一个新游戏)。

### 游戏内部分层（以 tank-battle 为例）

| 子目录               | 职责                                         |
| -------------------- | -------------------------------------------- |
| `core/`              | 游戏循环、输入、音频、几何工具与玩家加入大厅 |
| `entity/`、`system/` | 实体定义、移动、AI、生成、碰撞等规则         |
| `render/`、`scene/`  | Canvas 渲染与场景切换                        |
| `data/`、`editor/`   | 战役和关卡数据、自定义地图编辑               |

简单游戏可集中实现；包含关卡、解题、进度等独立逻辑的游戏按职责拆分。知识库记录共用契约，各游戏算法以就近源码和测试为准。

## 路径别名

- `@/*` 指向 `src/*`，配置于 `tsconfig.app.json:17` 与 `vite.config.ts:8`，两处需保持一致。
- 测试通过 `tsx --tsconfig tsconfig.app.json` 解析别名，命令见 [测试手册](../runbooks/testing.md)。

## 构建输出

`npm run build` 执行类型检查、客户端构建和静态 Worker 生成。`scripts/player-data.ts` 通过 Vite 插件运行，不会随静态 Worker 一起提供服务。环境能力见 [系统上下文](./system-context.md#运行环境)。
