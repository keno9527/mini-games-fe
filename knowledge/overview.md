# 服务总览

## 服务用途

mini-games-fe 是一个纯前端的小游戏聚合广场（Game Hub）。用户可以在浏览器中直接选择并游玩多款内置小游戏，系统在本地记录玩家身份、对局战绩和游戏内成长，并提供热门排行榜。

- **仓库**：git@github.com:keno9527/mini-games-fe.git
- **主分支**：main
- **产物形态**：静态站点（SPA），构建为 `dist/client/`，并附带一个 Cloudflare Sites Worker（`dist/server/index.js`）用于 history fallback。

## 核心职责

1. **游戏广场展示**：首页以卡片网格展示所有游戏，含封面渐变、图标、标签、难度。
2. **游戏运行时**：每个游戏通过 `manifest.ts` 声明元数据并懒加载，在 `GameDetail` 页面挂载运行。
3. **本地数据持久化**：用户、对局记录、游戏内成长（如引力墓场的解锁档案）均存储于浏览器 `localStorage`。
4. **战绩与排行**：聚合本地对局记录生成个人统计与全服（本地）热门排行榜。

## 上下游

### 上游（调用方）

- 终端用户的浏览器（Chrome / Edge / Safari 等现代浏览器）。
- 无服务端调用方；项目不依赖任何后端 HTTP 服务。

### 下游（被依赖方）

| 类型 | 名称 | 用途 | 详见 |
|------|------|------|------|
| 浏览器存储 | `localStorage` | 用户、记录、成长存档 | [contracts/apis.md](./contracts/apis.md) |
| 外部链接 | starlight-catcher | 一款外部游戏，以跳转方式接入广场 | [contracts/dependencies.md](./contracts/dependencies.md) |
| Google Fonts | Nunito / Press Start 2P / VT323 | 字体资源（在 `index.html` 中通过 CDN 引入） | [contracts/dependencies.md](./contracts/dependencies.md) |

## 技术栈

- React 19 + TypeScript
- Vite 8（构建，dev 端口 5183）
- React Router 7（HashRouter）
- Zustand 5（当前用户状态，带 persist 中间件）
- Tailwind CSS 3（样式，含自定义 fun-* / crt-* 设计令牌）
- 路径别名 `@/` → `src/`
- 测试：Node 内置 `node:test` + `tsx`
