# knowledge/

本目录沉淀 mini-games-fe 的工程结构、页面与交互规范、玩家与游戏模型、各游戏产品规则、跨模块契约及运行手册。当前应用由浏览器 SPA 与本机文件存档中间件协作运行。

## 导航表

| 层级     | 文件                                                                             | 内容                                                          |
| -------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| L1 索引  | [README.md](./README.md)                                                         | 导航与维护约定                                                |
| L1 总览  | [overview.md](./overview.md)                                                     | 用途、职责、上下游与技术栈                                    |
| 架构     | [architecture/system-context.md](./architecture/system-context.md)               | 本机服务、浏览器、静态产物的边界与待确认部署目标              |
| 架构     | [architecture/module-map.md](./architecture/module-map.md)                       | 模块职责、依赖与游戏接入边界                                  |
| 架构     | [architecture/frontend-presentation.md](./architecture/frontend-presentation.md) | 页面外壳、样式来源、展示字段、响应式现状与待对齐项            |
| 架构     | [architecture/data-flow.md](./architecture/data-flow.md)                         | 玩家恢复、结算保存/重试、迁移、统计与存储归属                 |
| 领域     | [domain/entities.md](./domain/entities.md)                                       | Game、User、GameRecord、PlayerFile、Settlement 与进度合并规则 |
| 契约     | [contracts/apis.md](./contracts/apis.md)                                         | 本机 HTTP 路由、客户端函数、错误与归档语义                    |
| 契约     | [contracts/dependencies.md](./contracts/dependencies.md)                         | 包依赖、网络、存储与构建依赖                                  |
| 契约     | [contracts/events.md](./contracts/events.md)                                     | 游戏结算、计时、输入、保存反馈与资源清理                      |
| 契约     | [contracts/ui-conventions.md](./contracts/ui-conventions.md)                     | 统一视觉与控件、交互语义、游戏主画面自定义边界                |
| 运维     | [runbooks/development.md](./runbooks/development.md)                             | 开发命令、游戏接入、显示/隐藏与代码约定                       |
| 运维     | [runbooks/debugging.md](./runbooks/debugging.md)                                 | 类型、文件服务、玩家数据、游戏和输入排障                      |
| 运维     | [runbooks/release.md](./runbooks/release.md)                                     | 构建产物、部署能力边界与验证步骤                              |
| 运维     | [runbooks/testing.md](./runbooks/testing.md)                                     | 契约对应测试、隔离数据与检查命令                              |
| 运维     | [runbooks/ui-review.md](./runbooks/ui-review.md)                                 | 页面状态、视觉、响应式与输入验收                              |
| 游戏产品 | [games/24points/design.md](./games/24points/design.md)                           | 24点：功能、玩法、评价、进度与边界                            |
| 游戏产品 | [games/memory/design.md](./games/memory/design.md)                               | 记忆翻牌：功能、玩法、评价、进度与边界                        |
| 游戏产品 | [games/whack-a-mole/design.md](./games/whack-a-mole/design.md)                   | 打地鼠：功能、玩法、评价、进度与边界                          |
| 游戏产品 | [games/tetris/design.md](./games/tetris/design.md)                               | 俄罗斯方块：功能、玩法、评价、进度与边界                      |
| 游戏产品 | [games/animal-chess/design.md](./games/animal-chess/design.md)                   | 斗兽棋：功能、玩法、评价、进度与边界                          |
| 游戏产品 | [games/snake/design.md](./games/snake/design.md)                                 | 贪吃蛇：功能、玩法、评价、进度与边界                          |
| 游戏产品 | [games/minesweeper/design.md](./games/minesweeper/design.md)                     | 扫雷：功能、玩法、评价、进度与边界                            |
| 游戏产品 | [games/laser-mirror/design.md](./games/laser-mirror/design.md)                   | 折光回廊：功能、玩法、评价、进度与边界                        |
| 游戏产品 | [games/xiangqi/design.md](./games/xiangqi/design.md)                             | 中国象棋 · 残局闯关：功能、玩法、评价、进度与边界             |
| 游戏产品 | [games/gomoku/design.md](./games/gomoku/design.md)                               | 五子棋：功能、玩法、评价、进度与边界                          |
| 游戏产品 | [games/gravity-graveyard/design.md](./games/gravity-graveyard/design.md)         | 引力墓场：功能、玩法、评价、进度与边界                        |
| 游戏产品 | [games/breakout/design.md](./games/breakout/design.md)                           | 打砖块：功能、玩法、评价、进度与边界                          |
| 游戏产品 | [games/breakout-mobile/design.md](./games/breakout-mobile/design.md)             | 打砖块（手机端）：功能、玩法、评价、进度与边界                |
| 游戏产品 | [games/tank-battle/design.md](./games/tank-battle/design.md)                     | 坦克大战：功能、玩法、评价、进度与边界                        |

## 维护约定

### 事实与归属

1. **真实来源**：同时核对 `src/`、`scripts/`、Vite/TypeScript/package 配置及对应测试。以实际实现说明当前行为；未核对环境或尚未确定的目标明确标为待确认。
2. **单一权威**：实体和合并规则由领域文档定义，接口由 API 契约定义，状态流转和存储键由数据流定义，环境能力由系统上下文定义；页面和样式现状由前端页面架构定义，目标交互与视觉规则由 UI 契约定义。其他文件引用这些主题，避免复制完整规则。
3. **导航唯一**：本表是知识库文档清单的唯一来源。新增、删除或重命名时只更新本表；根 AGENTS 保留分类入口。入口中的系统边界事实发生变化时仍需同步修正。
4. **就近与范围**：跨游戏机制由现有架构、领域与契约文档维护；各游戏的定位、功能、玩法、评价、进度边界与已确认设计决策由 `games/<game-id>/design.md` 维护。算法、完整数值表与逐关数据保留在实现及测试，产品文档引用其来源。没有依据的设计动机标为待确认，不能由当前代码反推为已确认决策。
5. **可核对**：引用源码使用 `文件路径:行号`；修改后检查链接、引用和相关命令。区分运行时测试、类型检查、构建与真实浏览器验证，不使用固定通过数量代替当次结果。

### 变更触发与更新位置

| 变化                                           | 真实来源                                                   | 对应文档                                                  |
| ---------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| 游戏模式、玩法、胜负、评价、关卡解锁或辅助规则 | 各游戏实际入口、规则与进度模块、对应测试                   | 对应 `games/<game-id>/design.md`；新增游戏时同步本表导航  |
| 玩家 schema、记录字段、归档或进度合并          | `src/features/players/schema.ts`、`scripts/player-data.ts` | 领域实体、API、数据流和相关排障                           |
| 存储介质、结算队列、迁移或玩家准入             | `src/api/`、`src/store/`、玩家组件、各游戏进度模块         | 数据流、API、事件、排障；影响系统边界时同步总览与入口说明 |
| 注册、隐藏、运行时或共用输入                   | registry、Home、manifest、gamepad、游戏 runtime            | 模块划分、开发、事件及测试入口                            |
| 页面外壳、展示字段、共用控件或交互规范         | App、pages、components、manifest 消费方、全局及游戏 CSS    | 前端页面架构、交互与视觉约定、UI 走查                     |
| 依赖、脚本、Vite 插件或部署环境                | package、Vite 配置、构建/文件服务脚本                      | 系统上下文、依赖、开发与发布                              |
| 测试入口或覆盖变化                             | `tests/`、tsconfig、package scripts                        | 测试手册与受影响契约                                      |
