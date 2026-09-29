# 本地开发与构建规则

## 环境要求

- Node.js 满足 `package.json:6` 的 `^20.19.0 || ^22.13.0 || >=24`。
- 使用 npm 和仓库 `package-lock.json`；从锁文件安装用 `npm ci`，需要更新依赖时用 `npm install`。
- 从项目根目录启动 Vite，通过本机地址访问。玩家文件服务的环境限制见 [系统上下文](../architecture/system-context.md)。

## 常用命令

```bash
npm ci
npm run dev
npm run build
npm run preview
npm test
npm run lint
npm run format:check
```

开发默认端口为 5183，以 Vite 实际输出为准。预览需先构建。dev / preview 都挂载文件接口，正常使用可能修改 `data/players/*.json`；提交前检查 diff，避免把测试游玩的存档混入代码或文档提交。

`npm run format:check` 的现有 glob 不递归覆盖 knowledge；检查知识库可执行：

```bash
npx prettier --check 'knowledge/**/*.md'
```

## 开发约定

### 路径别名

`@/` 指向 `src/`，别名同时配置于 `vite.config.ts:8` 和 `tsconfig.app.json:17`。测试使用显式 tsconfig，见 [测试手册](./testing.md)。

### 添加一个新游戏

1. 在 `src/games/<game-id>/manifest.ts` 声明元数据、展示配置和 runtime，并在 `src/games/registry.ts:18` 注册。
2. embedded 提供默认导出组件，由 runtime.load 懒加载；external 声明 HTTPS href 和 `openIn: 'new-tab'`，不需要本地入口组件。
3. 当前应用会先加载玩家档案再挂载游戏。接入进度时区分暂存和结算提交，核对字段合并语义、结算粒度和资源清理；见 [实体](../domain/entities.md) 与 [事件契约](../contracts/events.md)。
4. 补充相关引擎/契约测试，执行最小相关测试和类型检查；涉及共用注册、存档或运行时的修改还需验证受影响调用方。

| 操作                   | 当前效果                                                 |
| ---------------------- | -------------------------------------------------------- |
| 注册游戏               | 进入 API 游戏清单，可解析 manifest 和组件                |
| 加入首页 hiddenGameIds | 首页卡片和排行隐藏；不移除注册，详情路由仍可访问         |
| 移除注册               | 无法从注册表启动，热门排行排除；玩家历史仍保留在个人统计 |

隐藏策略见 `src/pages/Home.tsx:8`。新增游戏不要求维护一份重复的游戏清单；只有共用契约、存储、依赖或环境能力变化时更新相应知识主题。

### 代码风格

- 项目启用 `noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`；没有配置 TypeScript `strict: true`，不要将这些选项等同于完整 strict 模式（`tsconfig.app.json:21`）。
- 使用函数组件和 Hooks；高频游戏循环用 ref 管理可变状态，避免每帧触发 React 渲染。
- 提交前按改动范围运行检查；检查命令和覆盖关系见 [测试手册](./testing.md)。
- 文档维护和提交授权遵循根目录 `AGENTS.md`。

### 样式

Tailwind 工具类、fun/CRT 令牌和字体配置见 `tailwind.config.js:1`；全局布局见 `src/index.css`，游戏共用表面样式见 `src/games/game-surfaces.css`。新增页面优先核对现有布局与样式入口。

## 构建产物

`npm run build` 依次执行 `tsc -b`、`vite build`、`scripts/prepare-sites-worker.mjs`。客户端输出到 `dist/client/`，静态 Worker 输出到 `dist/server/index.js`。本机文件服务没有作为独立生产 API 打包，部署限制见 [发布手册](./release.md)。
