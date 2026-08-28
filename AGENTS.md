# AGENTS.md

本文件为在本仓库中工作的 AI Agent 提供项目级说明与约定（L0 入口）。

## 项目简介

- 仓库名称：mini-games-fe
- 仓库地址：git@github.com:keno9527/mini-games-fe.git
- 主分支：main
- 技术栈：React 19 + TypeScript + Vite 8 + React Router 7 + Zustand + Tailwind CSS 3
- 数据：纯前端，localStorage 持久化，无后端服务

## 开发约定

- 优先编辑已有文件，避免新建无关文件。
- 不要主动创建文档类文件（如 README、*.md），除非用户明确要求。
- 保持改动聚焦：只做用户要求的事，避免过度工程化。
- 代码引用请使用 `文件路径:行号` 的格式，便于跳转。

## 目录结构（常用）

- 源码目录：`src/`
- 游戏注册与配置：`src/games/<game-id>/manifest.ts`
- 广场清单与排行辅助：`src/features/games/`
- 游戏实现：`src/games/<game-id>/`（所有游戏含 `manifest.ts`；仅 `embedded` 运行时需要 `index.tsx`）
- 本地数据封装：`src/api/`
- 配置目录：`.trae/rules/`（包含 workspace_rules.md）

## 运行与构建

- 安装依赖：`npm install`
- 本地启动：`npm run dev`（端口 5183）
- 类型检查：`npx tsc -p tsconfig.app.json --noEmit`
- 运行测试：`npm test`
- 构建产物：`dist/client/`（附带 `dist/server/` Worker）

## 提交与分支

- 提交信息遵循已有风格（参考 `git log`）。
- 仅在用户明确要求时才创建 commit 或 push。

## 知识库

详细工程文档位于 `knowledge/`，按以下分类组织：

- `knowledge/overview.md` — 服务用途、职责、上下游总览
- `knowledge/architecture/` — 系统边界、模块分层、数据流
- `knowledge/domain/` — 领域实体（Game / User / GameRecord 等）
- `knowledge/contracts/` — 本地 API 契约、依赖清单、生命周期事件
- `knowledge/runbooks/` — 开发、排障、发布、测试手册

完整导航表与维护约定见 [knowledge/README.md](knowledge/README.md)。新增或重命名知识库文档时，**只更新该 README 的导航表**，本文件保持不变。

## 其他

- 遵循 `.trae/rules/workspace_rules.md` 中的工作区规则，其优先级高于默认行为。
