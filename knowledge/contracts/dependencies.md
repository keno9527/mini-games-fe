# 下游依赖清单

## npm 运行时依赖

定义于 `package.json` 的 `dependencies`：

| 包 | 版本 | 用途 |
|----|------|------|
| `react` | ^19.2.4 | UI 框架 |
| `react-dom` | ^19.2.4 | React DOM 渲染器 |
| `react-router-dom` | ^7.6.0 | 路由（使用 `HashRouter`） |
| `zustand` | ^5.0.5 | 全局状态（当前用户），使用 `persist` 中间件 |

## npm 开发依赖（关键项）

| 包 | 用途 |
|----|------|
| `vite` | 构建工具与 dev server |
| `@vitejs/plugin-react` | Vite 的 React 插件 |
| `typescript` | 类型检查（`tsc -b`） |
| `tailwindcss` / `postcss` / `autoprefixer` | 样式管线 |
| `eslint` + `typescript-eslint` + `eslint-plugin-react-hooks` / `react-refresh` | 代码检查 |
| `prettier` + `eslint-config-prettier` | 代码格式化 |
| `tsx` | 运行 TypeScript 测试文件 |
| `@types/node` | Node 类型（构建脚本与测试使用） |

Node 版本要求：18+（使用了 `node:test`、`node:fs/promises` 等内置模块）。

## 外部网络依赖

| 资源 | URL | 用途 | 降级策略 |
|------|-----|------|----------|
| Google Fonts | `https://fonts.googleapis.com` | Nunito / Press Start 2P / VT323 字体 | 加载失败时使用 `system-ui` / `monospace` 回退（Tailwind font-family 已配置兜底） |
| starlight-catcher | `https://starlight-catcher-20260721.dalio-liu.chatgpt.site` | 外部游戏，新标签页打开 | 仅一个跳转链接，不影响本站功能 |

## localStorage 依赖

数据层完全依赖浏览器 `localStorage`，无 IndexedDB / cookie / 服务端存储。键清单见 [architecture/data-flow.md#7-localstorage-键总览](../architecture/data-flow.md)。

清除浏览器数据会导致用户、战绩、成长全部丢失，无云端恢复途径。

## 构建产物依赖

构建脚本 `scripts/prepare-sites-worker.mjs` 在 `vite build` 后生成 `dist/server/index.js`，该 Worker 面向 Cloudflare Sites 部署（依赖 `env.ASSETS` 绑定）。若部署到其他静态托管平台，该文件可忽略，仅需部署 `dist/client/`。
