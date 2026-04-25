# Mini Games FE

一个基于 React + TypeScript + Vite 构建的小游戏合集前端项目，内置多款经典休闲小游戏，开箱即玩。

## 技术栈

- **框架**：React 19 + TypeScript
- **构建工具**：Vite 8
- **路由**：React Router 7
- **状态管理**：Zustand
- **样式**：Tailwind CSS 3
- **HTTP 请求**：Axios

## 游戏列表

项目内置以下小游戏（位于 `src/games/`）：

- 打砖块 Breakout
- 2048
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
├── api/          # 接口请求
├── assets/       # 静态资源
├── components/   # 通用组件（GameCard / Header / UserSelector）
├── games/        # 各个小游戏组件
├── pages/        # 页面（Home / GameDetail / Profile）
├── store/        # Zustand 状态管理
├── types/        # TypeScript 类型定义
├── App.tsx
└── main.tsx
```

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
