# Mini Games FE

一个基于 React + TypeScript + Vite 构建的小游戏合集前端项目，内置多款经典休闲小游戏，开箱即玩。

## 技术栈

- **框架**：React 19 + TypeScript
- **构建工具**：Vite 8
- **路由**：React Router 7
- **状态管理**：Zustand
- **样式**：Tailwind CSS 3
- **数据**：前端配置文件 + localStorage

## 游戏列表

项目内置以下小游戏（位于 `src/games/`）：

- 坦克大战 Tank Battle
- 绿野防线 Tower Defense
- 引力墓场 Gravity Graveyard
- 打砖块 Breakout
- 五子棋 Gomoku
- 记忆翻牌 Memory Card
- 扫雷 Minesweeper
- 反应力测试 Reaction Test
- 华容道 Slide Puzzle
- 贪吃蛇 Snake
- 俄罗斯方块 Tetris
- 井字棋 Tic-Tac-Toe
- 24 点 Twenty-Four Points
- 打地鼠 Whack-A-Mole
- 猜单词 Wordle

## 目录结构

```
src/
├── api/          # 前端本地数据读写封装（保留异步接口）
├── assets/       # 静态资源
├── components/   # 通用组件（GameCard / Header / UserSelector）
├── features/     # 广场领域配置（游戏清单 / 展示配置）
├── games/        # 游戏模块注册表与各游戏独立目录
├── pages/        # 页面（Home / GameDetail / Profile）
├── store/        # Zustand 状态管理
├── types/        # TypeScript 类型定义
├── App.tsx
└── main.tsx
```

每个本地游戏目录通过 `manifest.ts` 声明广场元数据、视觉配置和懒加载入口，具体实现从该目录的 `index.tsx` 进入。新增或优化游戏时，游戏内改动保持在对应目录，主框架只通过 `src/games/registry.ts` 读取统一接口。

## 快速开始

### 环境要求

- Node.js 18+
- npm / pnpm / yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产包

```bash
npm run build
```

### 预览构建产物

```bash
npm run preview
```

## 许可证

仅用于学习与交流。
