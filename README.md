# Mini Games FE

一个基于 React + TypeScript + Vite 构建的小游戏合集。通过本机开发或预览服务选择玩家、游玩并保存结算记录。

## 技术栈

- **框架**：React 19 + TypeScript
- **构建工具**：Vite 8
- **路由**：React Router 7
- **状态管理**：Zustand
- **样式**：Tailwind CSS 3
- **数据**：游戏配置 + 本机玩家文件存档，localStorage 用于辅助存储；边界见 [系统上下文](knowledge/architecture/system-context.md)。

## 游戏列表

项目内置以下小游戏（位于 `src/games/`）：

- 象棋残局 Xiangqi Endgames
- 坦克大战 Tank Battle
- 引力墓场 Gravity Graveyard
- 折光回廊 Laser Mirror
- 打砖块 Breakout
- 五子棋 Gomoku
- 记忆翻牌 Memory Card
- 扫雷 Minesweeper
- 贪吃蛇 Snake
- 俄罗斯方块 Tetris
- 24 点 Twenty-Four Points
- 打地鼠 Whack-A-Mole
- 斗兽棋 Animal Chess

注册清单以 `src/games/registry.ts:18` 为准；首页另按 `src/pages/Home.tsx:8` 的隐藏名单过滤，注册不等于首页展示。

## 目录结构

```
src/
├── api/          # 玩家文件 HTTP 客户端、结算队列与统计
├── components/   # 通用组件、玩家入口和保存状态
├── features/     # 游戏清单、玩家 schema/迁移、手柄能力
├── games/        # 游戏模块注册表与各游戏独立目录
├── pages/        # 页面（Home / GameDetail / Profile / GamepadTest）
├── store/        # Zustand 状态管理
├── types/        # TypeScript 类型定义
├── App.tsx
└── main.tsx
```

每个本地游戏目录通过 `manifest.ts` 声明广场元数据、视觉配置和懒加载入口，具体实现从该目录的 `index.tsx` 进入。新增或优化游戏时，游戏内改动保持在对应目录，主框架只通过 `src/games/registry.ts` 读取统一接口。

`scripts/player-data.ts` 为 Vite 提供文件存档接口，`data/players/` 保存玩家 JSON 文件。工程结构、接口、数据流与排障入口见 [知识库](knowledge/README.md)。

## 快速开始

### 环境要求

- Node.js 满足 `^20.19.0 || ^22.13.0 || >=24`（见 `package.json`）
- npm（使用仓库内的 `package-lock.json`）

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

默认访问 `http://localhost:5183`，先创建或选择玩家。文件接口仅接受本机 Host 和同源请求；通过局域网 IP 访问不支持玩家存档。

### 构建生产包

```bash
npm run build
```

### 预览构建产物

```bash
npm run preview
```

开发与预览服务均提供文件存档接口。`dist/client/` 和 `dist/server/index.js` 只包含静态应用与资源 Worker，单独上传它们不能完成当前玩家选择和存档流程，详见 [发布说明](knowledge/runbooks/release.md)。

## 许可证

仅用于学习与交流。
