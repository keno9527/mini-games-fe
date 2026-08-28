# 事件与回调

本项目无 MQ / 消息总线。"事件"指前端游戏生命周期中广场框架与游戏模块之间的回调约定，以及少量浏览器事件。

## 游戏模块生命周期回调

游戏入口组件接收 `GameComponentProps`（见 `src/games/manifest.ts`）：

```ts
interface GameComponentProps {
  userId?: string   // 当前用户；未登录时为 undefined
  gameId: string    // 游戏自身 id，用于提交战绩
}
```

游戏组件内部自行管理状态机（典型状态：`idle → playing → won/lost`），并在对局结束时调用 `createRecord`。这不是事件总线，而是直接的函数调用。

### 战绩提交事件

| 触发时机 | 调用 | 参数 |
|----------|------|------|
| 游戏胜利 | `createRecord(userId, { result: 'win', ... })` | score / duration |
| 游戏失败 | `createRecord(userId, { result: 'lose', ... })` | score / duration |
| 闯关/无尽结束 | `createRecord(userId, { result: 'complete', ... })` | score / duration |

提交需防重复：游戏组件应使用 `submittedRef`（或复用 `useGameRecord` hook）保证一局只提交一次。提交失败应静默处理，不阻塞游戏 UI。

### tank-battle 的 onGameOver 回调

坦克大战通过独立 runtime 挂载（`src/games/tank-battle/runtime.ts`），其 `mountTankBattle` 接收选项：

```ts
interface TankBattleOptions {
  initialHighScore?: number
  onGameOver?: (result: TankBattleResult) => void
}
```

`onGameOver` 在游戏结束（胜利或失败）时触发，`TankBattleResult` 含 `score`、`duration`、`victory`，由 React 包装组件（`index.tsx`）转调 `createRecord`。

## 广场框架事件

| 事件源 | 事件 | 处理方 |
|--------|------|--------|
| React Router | 路由变化 `/`、`/game/:id`、`/profile` | `App.tsx` 路由表 |
| GameDetail 卸载 | 游戏组件 unmount | 游戏内部 `useEffect` cleanup 取消 RAF / 移除监听 / 释放音频 |
| Zustand store | `currentUser` 变化 | Header / GameDetail / Profile 响应式更新 |

## 浏览器事件

游戏内部监听的浏览器事件（以各游戏实现为准）：

- `keydown` / `keyup`：方向键、WASD、空格等（如贪吃蛇、俄罗斯方块、打砖块、坦克大战）。
- `pointermove` / `pointerdown`：鼠标/触屏控制（如打砖块挡板、引力墓场锚点）。
- `visibilitychange`：页面切后台时暂停游戏循环（坦克大战 `runtime.ts` 实现）。
- `beforeunload` / `blur`：清空按键状态，避免按键"卡住"（打砖块实现）。

## 跨游戏约定

- 游戏组件被卸载时**必须**释放所有资源：`cancelAnimationFrame`、`removeEventListener`、关闭 `AudioContext`。tank-battle 的 `runtime.ts` 通过返回 `destroy()` 句柄示范了这一约定。
- 游戏不应直接修改广场状态或调用其他游戏的内部模块；所有跨边界通信通过 props 与 `src/api/` 完成。
