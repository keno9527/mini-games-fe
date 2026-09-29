# 分层验证链路与排障

根据症状定位代码与存储层。玩家文件、浏览器备份和游戏内存是不同状态，不能通过清空 localStorage 统一重置。

## 第 1 层：类型与构建

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run lint
npm run build
```

app 类型检查覆盖 `src/` 和 manifest 类型契约；`npm run build` 还检查 Vite 配置所引用的 Node 侧代码。Hooks 警告需结合闭包、ref 与清理逻辑判断，不应直接忽略。

## 第 2 层：数据层（玩家文件与浏览器存储）

### 定位顺序

1. 检查 Network 中 `/__player-data/players`：应返回 JSON。无法连接或返回 HTML 时，先确认通过本机 dev / preview 访问；错误状态见 [API 契约](../contracts/apis.md#错误与客户端行为)。
2. 检查是否成功选择并加载玩家，以及 `data/players/<id>.json` 的版本、归属和归档标记。当前用户恢复入口为 `src/store/userStore.ts:17`。
3. 检查结算是否触发、`SaveStatus` 是否存在待保存记录。`stageProgress` 只暂存，只有结算成功才写入文件。
4. 根据 [存储键清单](../architecture/data-flow.md#7-localstorage-键总览) 检查浏览器备份、旧数据或游戏专属副本，避免把不同来源当作同一份数据。

### 常见症状

| 现象                  | 核对与处理                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| 提示缺少文件存档服务  | 静态托管不包含接口；在仓库运行 dev / preview 后通过本机地址访问。局域网 Host 会被拒绝                       |
| 玩家列表整体读取失败  | 列表会解析目录中的全部 JSON；按错误里的玩家 ID 查找损坏文件。先备份原文件，再依据 schema 或已知有效版本修复 |
| 提示同名或玩家已归档  | 使用活跃玩家或不同名称；归档保留历史，当前没有解除归档接口，不能当作已删除空档案                            |
| 结算待保存 / 响应丢失 | 恢复文件服务后使用全局“重试保存”，沿用队列里的记录 ID；不要重新生成一局来替代重试                           |
| 排行少于预期          | 只计算未归档玩家、已注册游戏的已保存记录，首页还过滤隐藏游戏；不会统计仅打开页面或未结算的游玩              |

### 备份与恢复边界

文件服务对损坏 JSON 报错并保留原文件；临时文件写入后 rename，串行队列只保护单个仓库实例（`scripts/player-data.ts:20`、`scripts/player-data.ts:59`）。避免多个服务进程同时修改同一存档目录。

在有价值的数据上操作前备份玩家文件和相关浏览器数据。清除 localStorage 不会清除已保存的 JSON，但会删除待提交备份、偏好和仅浏览器存储的编辑器内容；不应作为通用首步。正常 UI 测试会写入仓库中的玩家文件，优先使用隔离的临时 checkout 和测试玩家；自动化文件服务测试使用临时目录。

## 第 3 层：游戏挂载

| 现象                  | 核对点                                                                             |
| --------------------- | ---------------------------------------------------------------------------------- |
| 首页没有游戏          | 先查 `src/games/registry.ts:18`，再查 `src/pages/Home.tsx:8` 隐藏名单              |
| 游戏详情空白 / 不启动 | 检查玩家档案加载、manifest runtime.load 和默认导出，再检查懒加载 chunk 请求        |
| 切换玩家状态串用      | `src/pages/GameDetail.tsx:65` 按游戏与玩家 ID 重建组件；检查游戏外部缓存和清理逻辑 |
| Canvas 点击偏移       | 区分内部画布坐标与 CSS 尺寸，按 `getBoundingClientRect()` 映射指针                 |

## 第 4 层：游戏循环与输入

| 范围                | 排查入口                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------- |
| RAF、键盘与可见性   | 检查暂停、blur 清键和 unmount 清理；独立 runtime 需销毁循环与订阅                           |
| 音频                | 检查用户手势解锁、静音设置与资源请求；浏览器手动验证仍有必要                                |
| 手柄连接 / 无响应   | 选择玩家后访问 `/#/gamepad`；检查安全上下文、API 支持和 mapping，绑定或返回前台后先释放按键 |
| 坦克双人加入 / 重连 | 检查 TankLobby 槽位与显式加入状态；连接设备不自动等于已分配玩家                             |

共用输入的事实来源为 `src/features/gamepad/monitor.ts:75`、`src/features/gamepad/players.ts:50` 和 `src/games/tank-battle/core/TankLobby.ts`，测试分组见 [测试手册](./testing.md)。

## 第 5 层：视觉与布局

先按 [前端页面与样式架构](../architecture/frontend-presentation.md#样式来源与生效范围) 定位全站外壳、页面或游戏规则，检查选择器优先级、变量继承和当前媒体/容器条件。Tailwind 类不生效时再核对 `tailwind.config.js:3` 的 content 范围；字体问题检查 Google Fonts 网络请求和后备字体栈。

游戏主题污染按钮或其他页面时，检查 `--gs-*` 的继承范围与专用 CSS 作用域。尺寸和状态行为的预期以 [交互与视觉约定](../contracts/ui-conventions.md) 为准，浏览器验证步骤见 [UI 走查手册](./ui-review.md)。构建成功不能替代 Canvas、音频、触屏或真实手柄验证。

## 快速自检命令

```bash
npx tsx --tsconfig tsconfig.app.json --test tests/player-files.test.ts tests/player-session.test.ts tests/game-play-stats.test.ts
npm run build
npm test
```

先运行与症状相关的测试，涉及共用机制时再运行完整回归。不要将 Node 测试通过解释为线上发布或真实设备已验证。
