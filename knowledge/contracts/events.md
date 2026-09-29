# 游戏生命周期事件与回调

## 游戏组件 Props

```ts
interface GameComponentProps {
  userId?: string
  gameId: string
}
```

类型定义于 `src/games/manifest.ts:4`。类型层面 userId 可选，当前应用入口则要求档案加载完成；玩家切换时通过组件 key 重建游戏，见 [模块划分](../architecture/module-map.md#游戏模块契约)。

游戏内部状态机自行管理（例如 idle、playing、paused、won/lost），跨边界结算通过直接函数调用完成，没有通用事件总线。

按钮文案、状态展示、弹层和游戏主画面自定义边界见 [交互与视觉约定](./ui-conventions.md)。UI 中的“通关”和文件保存成功分别表达，保存状态遵循以下运行契约。

### 战绩提交事件

| 触发时机                   | 调用与约束                                                                    |
| -------------------------- | ----------------------------------------------------------------------------- |
| 游戏定义的胜利、失败或完成 | `createRecord` 提交 score、duration、result，可附关卡、战役和模式             |
| 同一局/关卡重复通知        | 游戏需防重；可使用 `useGameRecord`，每次开局调用 `start()` 重置计时和提交标记 |
| 已有暂存进度的结算         | `createRecord` 同时提交当前进度快照；单纯暂存不会写文件                       |
| 文件保存失败               | 全局 `SaveStatus` 显示错误和 pending 数，提供重试；有 pending 时监听离开页面  |

`src/hooks/useGameRecord.ts:32` 默认按 start 后经过的墙钟时间计算 duration，也允许显式传入游戏自身计时。不要将其默认时间理解为自动扣除了暂停或后台时长。各游戏应按自己的规则选择计时来源。

`useGamePlay` 只在内存跟踪开始、暂停、可见性和卸载，不写持久化统计；排行来自结算记录（`src/hooks/useGamePlay.ts:4`）。重试和幂等规则见 [数据流](../architecture/data-flow.md#防重与失败恢复)。

### tank-battle 的 onGameOver 回调

`mountTankBattle` 接收画布、容器和 `TankBattleOptions`，返回带 `destroy()` 的控制句柄（`src/games/tank-battle/runtime.ts:34`）。

| 回调 / 选项组                                                 | 用途                           |
| ------------------------------------------------------------- | ------------------------------ |
| campaignId、initialProgress、onCampaignChange、onStageReached | 战役与单人/双人进度            |
| onControllersChange、onMenuChange、onStateChange              | 控制器、大厅菜单、运行状态同步 |
| initialHighScore、onGameOver                                  | 注入高分和接收结算             |
| customLevel                                                   | 自定义地图试玩                 |

完整类型见 `src/games/tank-battle/runtime.ts:55`。React 包装在 `onGameOver` 中提交关卡、战役及 single/coop/practice 模式；自定义地图试玩跳过战绩提交（`src/games/tank-battle/index.tsx:194`）。

## 广场框架事件

| 事件源         | 处理                                                     |
| -------------- | -------------------------------------------------------- |
| HashRouter     | 四条路由由 `src/App.tsx:17` 定义                         |
| 当前玩家变化   | 页面读取 Zustand 状态；GameDetail 重建玩家对应的游戏组件 |
| 保存状态变化   | `subscribeSaves` 通知 `SaveStatus`；用户可重试待保存结算 |
| 浏览器 storage | 首页重新拉取排行；不等同于文件系统实时订阅               |
| 游戏组件卸载   | 游戏自身清理循环、监听、音频和其他运行资源               |

## 浏览器事件

### 键鼠、触屏与页面可见性

| 事件                      | 典型用途                                   |
| ------------------------- | ------------------------------------------ |
| keydown / keyup           | 方向、动作与菜单操作                       |
| pointermove / pointerdown | 指针控制和触屏操作                         |
| visibilitychange / blur   | 游戏按需暂停或清空按键，避免后台继续输入   |
| beforeunload              | 全局提示待保存结算；不是文件保存成功的保证 |

具体监听以各游戏实现为准。坦克运行时在 `src/games/tank-battle/runtime.ts:406` 注册可见性监听，并在销毁时移除。

### 共用手柄能力

`src/features/gamepad/monitor.ts:75` 封装浏览器 Gamepad API，监控连接、焦点和可见性；不安全上下文或 API 不支持时返回明确状态，不启动轮询。销毁时取消 RAF 并解除监听。

`src/features/gamepad/players.ts:50` 只绑定 standard mapping 设备，避免重复绑定；绑定或焦点恢复后需先释放控制输入，设备断开时释放相应绑定。坦克的加入/重连大厅另由 `src/games/tank-battle/core/TankLobby.ts` 管理，测试入口见 [测试手册](../runbooks/testing.md)。

## 跨游戏约定

- 组件卸载时释放持有的 RAF、事件订阅、音频及 Worker 等资源；独立 runtime 应暴露统一销毁入口。
- 玩家身份、文件存档和共用输入通过 props、`src/api/` 和共用模块协作，避免直接依赖其他游戏内部状态。
- 结算粒度、计时方式和进度字段要与游戏规则一致，并由相应测试验证；函数名包含 save 不代表已经落盘。
