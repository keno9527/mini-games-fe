# 测试

## 测试框架

使用 Node 内置 `node:test`、`node:assert/strict` 和 tsx。运行时测试位于 `tests/*.test.ts`；`tests/game-manifest.typecheck.ts` 由 app TypeScript 配置编译检查，不由 npm test 执行。

文件服务测试通过 `tests/helpers/player-server.ts:7` 启动临时 HTTP 服务，将存档写入系统临时目录并在结束后清理，不写入项目的 `data/players/`。

## 运行测试

```bash
npm test
```

`package.json:13` 中的实际命令是 `tsx --tsconfig tsconfig.app.json --test tests/*.test.ts`。显式 tsconfig 用于解析 `@/` 别名。

单文件和玩家链路测试示例：

```bash
npx tsx --tsconfig tsconfig.app.json --test tests/gravity-graveyard.test.ts
npx tsx --tsconfig tsconfig.app.json --test tests/player-files.test.ts tests/player-session.test.ts tests/game-play-stats.test.ts
```

## 现有测试

以下按契约定位测试。测试文件清单以 `rg --files tests` 为准，执行数量与结果以当次测试报告为准。

### 注册与玩家数据

| 契约                                                                          | 文件                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| manifest 元数据、内置游戏加载和运行时销毁                                     | `tests/game-modules.test.ts`                                                                      |
| 编译期拒绝非 HTTPS 外链、混合 runtime 字段                                    | `tests/game-manifest.typecheck.ts`                                                                |
| 内部路由、外部新标签页、未注册游戏入口                                        | `tests/game-launch-link.test.ts`                                                                  |
| 暂存不落盘、玩家隔离、结算幂等、并发、响应丢失重试、迁移、损坏文件、HTTP 限制 | `tests/player-files.test.ts`                                                                      |
| 恢复上次玩家、加载进度、切换和归档失败分支；排行聚合与计时规则；成长暂存隔离  | `tests/player-session.test.ts`、`tests/game-play-stats.test.ts`、`tests/game-progression.test.ts` |

`game-play-stats` 同时测试内存 tracker 与文件排行；tracker 测试中的开始/暂停计数不能解释为当前持久化排行口径。

### 手柄与坦克运行时

| 契约                                      | 文件                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 设备监控、状态变化、异常与资源释放        | `tests/gamepad.test.ts`                                                                                                      |
| 双人独立绑定、断连、恢复时释放输入        | `tests/gamepad-players.test.ts`                                                                                              |
| 显式加入、重连槽位、菜单/运行时流程       | `tests/tank-lobby.test.ts`、`tests/tank-lobby-runtime.test.ts`                                                               |
| 战斗系统、双人协作、战役、分玩家/模式进度 | `tests/tank-battle.test.ts`、`tests/tank-battle-coop.test.ts`、`tests/tank-campaigns.test.ts`、`tests/tank-progress.test.ts` |
| 地图校验、导入导出、编辑、草稿存储        | `tests/tank-map-editor.test.ts`                                                                                              |

### 游戏引擎与关卡

| 范围                                         | 文件                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 打砖块物理、编辑器、音频生命周期、按关卡结算 | `tests/breakout.test.ts`、`tests/breakout-editor.test.ts`、`tests/breakout-audio.test.ts`、`tests/breakout-settlement.test.ts` |
| 扫雷基础规则、逻辑关卡、进度                 | `tests/minesweeper.test.ts`、`tests/minesweeper-logic.test.ts`、`tests/minesweeper-progress.test.ts`                           |
| 五子棋残局、象棋、斗兽棋                     | `tests/gomoku-puzzles.test.ts`、`tests/xiangqi.test.ts`、`tests/animal-chess.test.ts`                                          |
| 贪吃蛇冒险、引力墓场、折光回廊               | `tests/snake-adventure.test.ts`、`tests/gravity-graveyard.test.ts`、`tests/laser-mirror.test.ts`                               |

测试覆盖这些已定义行为，不意味着所有游戏和浏览器交互都有自动化覆盖。

## 编写测试的约定

1. 游戏引擎优先验证纯函数、边界和不变量；运行时资源测试使用最小浏览器 mock。
2. 玩家 HTTP 与文件行为复用临时服务 helper，覆盖真实请求、落盘、重试和隔离；不要使用正式玩家文件造数。
3. 全局 fetch、localStorage、window、RAF 等 mock 应在结束后恢复，避免用例互相污染。
4. manifest 的类型排斥规则放入 typecheck 文件；运行时测试通过不代表这些规则已验证。

## 实测参数示例

### 运行全部测试

```bash
npm test
```

检查命令退出码和最终 tests/pass/fail/skipped 汇总；不要用文档中固定的测试数量判定通过。全量测试不启动真实浏览器，不能证明视觉、音频或物理手柄已验证。

### 类型检查（独立于测试）

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

app 检查覆盖 `src/` 与 manifest 类型契约；build 使用 `tsc -b` 检查项目引用后生成产物。普通 `*.test.ts` 通过 tsx 运行，不全部纳入 app 编译检查（`tsconfig.app.json:26`）。

### 文档与浏览器验证

```bash
npx prettier --check 'knowledge/**/*.md'
git diff --check
```

文档还需核对相对链接、代码引用、API 字段和实际配置。真实浏览器验证覆盖玩家入口、结算保存提示、刷新恢复、Canvas/DOM 交互和设备输入，入口见 [发布后验证](./release.md#发布后验证)。
