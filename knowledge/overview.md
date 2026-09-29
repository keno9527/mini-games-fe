# 服务总览

## 服务用途

mini-games-fe 是一个在浏览器中运行的小游戏聚合广场（Game Hub）。当前完整流程依赖本机 Vite 开发或预览服务：玩家先创建或选择档案，游戏结算后将战绩与进度写入项目中的玩家文件。

- **仓库**：git@github.com:keno9527/mini-games-fe.git
- **主分支**：main
- **产物形态**：客户端 SPA 输出到 `dist/client/`，静态资源 Worker 输出到 `dist/server/index.js`。构建产物不包含本机文件存档接口，运行边界见 [系统上下文](./architecture/system-context.md)。

## 核心职责

1. **游戏广场展示**：从注册清单读取游戏，首页过滤隐藏条目，展示卡片与热门排行。
2. **游戏运行时**：通过 `manifest.ts` 声明元数据和运行方式；内置游戏懒加载，外链游戏由统一入口跳转。
3. **玩家与存档**：按玩家隔离战绩和主要进度，提供档案恢复、归档、旧数据导入及保存失败重试。
4. **战绩与排行**：从已保存的结算记录聚合个人统计和本机玩家热门排行，不使用种子排行数据。

## 上下游

### 上游（调用方）

终端用户的浏览器通过鼠标、键盘、触屏或受支持的手柄操作页面。应用使用本地玩家身份，无账号密码认证。

### 下游（被依赖方）

| 类型           | 名称                     | 用途                                       | 详见                                    |
| -------------- | ------------------------ | ------------------------------------------ | --------------------------------------- |
| 本机 HTTP 服务 | `/__player-data/players` | Vite 中间件读写 `data/players/*.json`      | [API 契约](./contracts/apis.md)         |
| 浏览器存储     | localStorage             | 待保存结算备份、偏好、兼容进度及编辑器数据 | [数据流](./architecture/data-flow.md)   |
| 字体资源       | Google Fonts             | Nunito / Press Start 2P / VT323            | [依赖清单](./contracts/dependencies.md) |

## 技术栈

| 范围           | 技术与来源                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| UI 与样式      | React 19、TypeScript、Tailwind CSS 3；`package.json:19`、`tailwind.config.js:1`                                        |
| 路由与状态     | React Router 7（HashRouter）、Zustand 5（内存用户状态，不使用 persist）；`src/App.tsx:12`、`src/store/userStore.ts:13` |
| 构建与本机服务 | Vite 8，开发端口 5183，别名 `@/` 指向 `src/`；`vite.config.ts:6`                                                       |
| 测试           | Node 内置 `node:test` + `tsx`；运行方式见 [测试手册](./runbooks/testing.md)                                            |
