# 前端项目协作规则

当前工作区仅保留 `mini-games-fe` 前端项目。

## 1. 目录映射与身份
- **前端 (当前项目)**: `/Users/bytedance/Codebases/mini-games/mini-games-fe`
  - 技术栈: React, TypeScript, Vite, Tailwind CSS
  - 职责: 用户界面、交互逻辑、游戏实现、本地数据配置和 localStorage 持久化

## 2. 交互与修改规则
- **前端指令**: 当用户指令涉及 "前端", "UI", "React", "组件", "页面", "样式", "交互" 等关键词时，请**严格**在当前 `mini-games-fe` 目录下（通常是 `src/` 子目录）进行搜索、编辑和命令执行。
- **数据指令**: 游戏列表与展示配置位于 `src/features/games/`；玩家、记录、统计和排行榜通过 `src/api/` 封装 localStorage 读写。
- **后端指令**: 当前仓库不保留后端代码。需要重新接入后端时，先确认 API 契约和迁移边界。

## 3. 开发注意事项
- **源码位置**: 前端核心代码位于 `src/` 目录下，执行 npm 命令时请务必确保 CWD 是 `.../mini-games-fe`。
- **启动前端**: 在 `mini-games-fe` 目录下执行 `npm run dev`。
