# 模块划分与分层依赖

## 分层总览

项目采用"广场框架 + 游戏插件"的结构。广场层提供路由、数据、通用组件；游戏层通过统一的 manifest 接口注册，彼此隔离。

```
┌─────────────────────────────────────────────────────┐
│  pages/        页面：Home / GameDetail / Profile     │  路由层
├─────────────────────────────────────────────────────┤
│  components/   通用组件：GameCard / Header / ...      │  视图层
│  features/     广场领域配置：catalog / data           │
├─────────────────────────────────────────────────────┤
│  games/        游戏注册表 + 各游戏独立目录             │  游戏运行时
│   ├── registry.ts      聚合所有 manifest，懒加载组件   │
│   └── <game>/          每个游戏自包含实现              │
├─────────────────────────────────────────────────────┤
│  api/          localStorage 异步封装（getGames 等）    │  数据层
│  store/        Zustand 当前用户（persist）            │
│  hooks/        跨游戏复用 hook（useGameRecord）        │
│  types/        全局 TypeScript 类型                   │
└─────────────────────────────────────────────────────┘
```

依赖方向：`pages → components/features/games → api/store/hooks/types`。游戏目录内部不应反向依赖页面或其他游戏。

## 目录职责

| 目录                  | 职责                | 关键文件                                                                    |
| --------------------- | ------------------- | --------------------------------------------------------------------------- |
| `src/pages/`          | 路由页面            | `Home.tsx` 广场首页、`GameDetail.tsx` 游戏详情/挂载、`Profile.tsx` 个人战绩 |
| `src/components/`     | 无业务状态的通用 UI | `GameCard.tsx`、`Header.tsx`、`Skeleton.tsx`、`UserSelector.tsx`            |
| `src/features/games/` | 广场领域配置        | `data.ts` 游戏清单+排行种子、`catalog.ts` 展示与战绩文案辅助                |
| `src/games/`          | 游戏注册表与实现    | `registry.ts`、`manifest.ts`（接口定义）、各 `<game>/`                      |
| `src/api/`            | 数据访问            | `index.ts` 封装 localStorage，暴露 Promise 接口                             |
| `src/store/`          | 全局状态            | `userStore.ts` 当前登录用户（Zustand + persist）                            |
| `src/hooks/`          | 复用 hook           | `useGameRecord.ts` 统一战绩提交（防重、计时）                               |
| `src/types/`          | 全局类型            | `index.ts` 定义 Game / User / GameRecord 等                                 |

## 游戏模块契约

每个游戏目录必须包含 `manifest.ts`，默认导出一个满足 `GameManifest` 的对象。契约的唯一文档定义见 [领域实体](../domain/entities.md#游戏注册接口)，代码定义见 `src/games/manifest.ts`。

`embedded` 游戏入口组件接收 `GameComponentProps`（`{ userId?, gameId }`），自行管理内部状态，并在对局结束时调用 `createRecord` 提交战绩。`external` 游戏只提供安全跳转，不挂载本地组件。

### 游戏内部分层（以 tank-battle 为例）

复杂游戏可在自身目录内进一步分层，不影响广场：

- `core/`：游戏循环、输入、音频、几何工具
- `entity/`：实体定义（Tank / Bullet / ...）
- `system/`：逻辑系统（移动 / AI / 生成 / 碰撞）
- `render/`：Canvas 渲染
- `scene/`：场景管理（标题 / 战斗 / 结算）
- `data/`：关卡、精灵、数值配置

简单游戏可单文件实现（如 `gomoku/index.tsx`）。

## 路径别名

- `@/*` → `src/*`（配置于 `tsconfig.app.json` 与 `vite.config.ts`，两处需保持一致）。
- 游戏内部相对路径与别名混用均可，跨目录引用优先使用 `@/`。

## 构建输出

- `vite build` 将客户端产物输出到 `dist/client/`。
- `scripts/prepare-sites-worker.mjs` 在构建后生成 `dist/server/index.js`（Cloudflare Sites Worker，处理 SPA fallback）。
