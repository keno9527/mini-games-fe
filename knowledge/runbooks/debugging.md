# 分层验证链路与排障

当游戏或广场出现问题时，按以下层次自底向上排查。

## 第 1 层：类型与构建

```bash
npx tsc --noEmit      # 类型检查，零错误通过
npm run lint          # ESLint
```

- TS 报错优先修复，类型错误常对应 prop 传递或游戏状态字段不匹配。
- `react-hooks/exhaustive-deps` 警告多出现于游戏主循环 `useCallback`，需确认是否为有意省略（游戏中常用 ref 规避闭包陷阱）。

## 第 2 层：数据层（localStorage）

广场数据问题（游戏列表缺失、战绩不记录、排行异常）排查：

1. 打开 DevTools → Application → Local Storage。
2. 检查以下键：
   - `mini-games-local-users`：用户列表是否存在。
   - `mini-games-local-records`：对局记录数组，每条含 `userId/gameId/score/result`。
   - `mini-game-user`：Zustand 持久化的当前用户。
   - `mini-games-local-progression:<gameId>`：引力墓场成长存档。
3. 数据损坏时可删除对应键重置（会丢失本地进度）。

常见问题：
- **战绩不记录**：确认当前已选择用户（`currentUser` 非空）；游戏组件通过 `userId` prop 判断，未登录时 `createRecord` 直接跳过。
- **游戏不在列表**：确认 `src/games/registry.ts` 已 import 该 manifest 并加入 `gameManifests` 数组。

## 第 3 层：游戏挂载

游戏白屏/不启动：

1. 确认 `manifest.ts` 的 `load` 返回 `import('./index.tsx')`，且 `index.tsx` 有默认导出。
2. `GameDetail.tsx` 通过 `React.lazy` 加载，用 `<Suspense>` 包裹；检查网络面板是否有 chunk 加载失败。
3. Canvas 游戏检查画布尺寸：`canvas.width/height` 为内部坐标系，CSS 控制显示大小，鼠标坐标需经 `getBoundingClientRect()` 缩放映射。

## 第 4 层：游戏循环与输入

游戏卡顿/输入无响应：

- **RAF 循环**：确认 `requestAnimationFrame` 在 unmount 时被 `cancelAnimationFrame` 取消；坦克大战还监听 `visibilitychange` 在切后台时暂停。
- **键盘事件**：监听挂在 `window` 上的需在 cleanup 中 `removeEventListener`；按键"粘住"通常是缺少 keyup/blur 重置（参考打砖块的 `keysRef` + `blur` 清空）。
- **音频**：浏览器要求用户手势后才能启动 `AudioContext`；坦克大战在 `input.onFirstInteraction` 中 `audio.unlock()`。
- **Canvas 游戏**：内部坐标系常量（如打砖块 `W=480 H=520`）与渲染尺寸解耦，不要在游戏逻辑中读取 DOM 实际像素。

## 第 5 层：视觉与布局

- Tailwind 类不生效：确认内容文件路径在 `tailwind.config.js` 的 `content` 范围内（`./src/**/*.{js,ts,jsx,tsx}`）。
- 字体未加载：检查网络是否能访问 Google Fonts；失败时自动回退系统字体，不影响功能。

## 快速自检命令

```bash
npm run build && npm test   # 构建 + 测试，合并验证一次改动是否破坏契约
```
