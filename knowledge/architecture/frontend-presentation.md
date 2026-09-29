# 前端页面与样式架构

本文记录当前实现，用于定位页面外壳、展示字段与样式来源。新增和改动页面的目标规范见 [交互与视觉约定](../contracts/ui-conventions.md)，验收见 [UI 走查手册](../runbooks/ui-review.md)。当前实现中的游戏主题差异按目标规范判定是否待对齐。

## 页面与组件职责

`src/App.tsx:12` 使用 HashRouter；Header、SaveStatus 位于路由外层，PlayerGate 在玩家档案准备完成后放行页面。

```text
App
├─ Header：全站导航与当前玩家入口
├─ SaveStatus：待保存结算、失败原因、重试
└─ PlayerGate：恢复玩家 / 选择玩家 / 加载档案
   ├─ /             Home：游戏列表与热门排行
   ├─ /profile      Profile：玩家管理与个人战绩
   ├─ /gamepad      GamepadTest：设备状态与输入诊断
   └─ /game/:id     GameDetail：返回入口、标题、加载占位
                    └─ game-stage → 懒加载游戏
```

| 层级     | 当前职责与边界                                                                 | 源码入口                                                                 |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 全站外壳 | 纸质背景、导航、玩家准入和保存反馈；导航当前项使用 `aria-current`              | `src/App.tsx:13`、`src/components/Header.tsx:9`                          |
| 普通页面 | `.page-shell` 提供宽度、间距与文字基线；首页、战绩页分别组织内容               | `src/index.css:167`、`src/pages/Home.tsx:60`、`src/pages/Profile.tsx:73` |
| 游戏详情 | `.game-page-toolbar` 提供标题与返回首页链接；`.game-stage` 承载游戏            | `src/pages/GameDetail.tsx:45`、`src/index.css:81`                        |
| 游戏内部 | 自行组织棋盘、画布、操作区、关卡和结果展示；当前存在共用样式与独立样式两种路径 | `src/games/game-surfaces.css:2`、`src/games/xiangqi/xiangqi.css:5`       |

详情页的“返回”链接固定指向首页；其语义不是浏览器历史后退。切换玩家时游戏按 `${id}:${currentUser.id}` 重建（`src/pages/GameDetail.tsx:47`、`src/pages/GameDetail.tsx:66`）。

## 样式来源与生效范围

| 来源                               | 当前覆盖内容                                                            | 使用时需核对                                         |
| ---------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/main.tsx:3` → `src/index.css` | Tailwind 指令、全站背景、导航、页面外壳、卡片、战绩、玩家入口、保存提示 | 当前广场视觉的主要来源是显式 CSS                     |
| `tailwind.config.js:3`             | content 扫描、fun/CRT 颜色、字体、阴影和动画工具类                      | 令牌存在不代表页面正在使用；需检查消费位置和计算样式 |
| `src/games/game-surfaces.css:2`    | `.game-surface`、`.gs-*` 共用控件，以及多款游戏专用规则                 | 文件同时承载通用与专用样式；并非所有游戏都导入       |
| `src/games/<id>/*.css`             | 棋盘、画布、主题、布局、输入控件及断点覆盖                              | 当前为普通 CSS；导入到游戏组件不会自动产生作用域隔离 |
| `src/pages/gamepad-test.css`       | 手柄诊断页状态面板与设备展示                                            | 与全站页面外壳共同生效                               |

`.game-surface` 当前提供 `--gs-bg`、`--gs-panel`、`--gs-text`、`--gs-muted`、`--gs-line`、`--gs-accent`、`--gs-on-accent`，按钮和面板通过这些变量着色。部分游戏会覆盖整套变量，例如折光回廊与俄罗斯方块（`src/games/game-surfaces.css:245`、`src/games/game-surfaces.css:830`）。这会同时改变游戏主画面和共用控件的外观。

目标规范要求游戏主画面与共用操作区分开控制主题，当前变量继承方式存在待对齐项。仓库尚无独立、覆盖全部页面的 UI 令牌模块；文档中的统一参数不能当作已经存在的 CSS 变量或组件 API。

排查覆盖时按“元素类名 → 匹配规则与变量继承 → 选择器优先级与源顺序 → 当前媒体/容器条件”检查。游戏专用规则应落在游戏根类名或 `.game-page--<id>` 下，避免使用无作用域的元素选择器影响其他路由。

## 当前布局与视觉基线

以下数值描述当前代码，作为定位和对照依据。目标控件参数以 [交互与视觉约定](../contracts/ui-conventions.md#视觉与控件基线) 为准。

| 区域           | 当前默认值                                                                                             | 来源                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 页面背景与导航 | 背景 `#f3f0e8` 叠加纸质纹理；导航 `#25483e`                                                            | `src/index.css:9`、`src/index.css:20`、`src/index.css:26`           |
| 普通页面       | 最大宽度 1600px；桌面内边距 `32px 4% 40px`；页面间距 24px；窄屏收紧                                    | `src/index.css:167`、`src/index.css:193`                            |
| 首页卡片       | 背景 `#fcfaf4`、边框 `#ded7c7`、圆角 10px、内边距 18px；标题 20px 宋体字族、描述 14px                  | `src/index.css:230`、`src/index.css:272`                            |
| 游戏容器       | `.game-stage` 最大宽度 1280px，桌面内边距 `24px 32px 40px`；游戏可有专用覆盖                           | `src/index.css:109`、`src/games/xiangqi/xiangqi.css:1`              |
| 共用游戏控件   | `.gs-primary/.gs-secondary` 字号 12px、内边距 `12px 18px`、圆角 6px；`.gs-panel` 圆角 7px、内边距 17px | `src/games/game-surfaces.css:139`、`src/games/game-surfaces.css:98` |

### 响应式条件的分工

| 条件           | 当前例子                                                                          | 解决的问题                                                                                                |
| -------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 视口宽度       | 首页卡片从 4 列在 1279/1050/600px 阈值下逐步变为 3/2/1 列；760px 以下排行移到下方 | 页面整体空间分配，见 `src/index.css:225`、`src/index.css:388`                                             |
| 内容容器宽度   | 战绩内容在容器不超过 620px 时重排；共用游戏布局在容器不超过 580px 时改为单列      | 侧栏存在时的真实可用宽度，见 `src/index.css:603`、`src/index.css:769`、`src/games/game-surfaces.css:1275` |
| 视口高度与方向 | 象棋棋盘宽度关联 `100svh`；坦克还有横屏、低高度适配                               | 棋盘和画布的可视面积，见 `src/games/xiangqi/xiangqi.css:6`、`src/games/tank-battle/tank-battle.css:737`   |
| 输入设备       | 坦克在视口不超过 700px 或 `pointer: coarse` 时展示触屏操作区                      | 输入可用性，见 `src/games/tank-battle/tank-battle.css:10`                                                 |

这些条件承担不同职责。页面断点、游戏容器断点和输入设备条件分别判断；游戏画面尺寸可按棋盘比例、画布坐标与可视高度定义。

## 展示配置到页面的映射

`GamePresentation` 在 `src/games/manifest.ts:9` 声明，但首页卡片仅消费部分字段。

| 字段 / 来源                         | 当前展示效果                                                             | 证据                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `game.name / description / tags`    | 卡片标题、描述、标签                                                     | `src/components/GameCard.tsx:46`                                     |
| `presentation.badge / actionLabel`  | 卡片徽标和底部动作文案；动作默认“开始游戏”                               | `src/components/GameCard.tsx:39`                                     |
| `presentation.variant`              | 生成 `library-card--default/featured` 类名；当前未定义相应变体的专用 CSS | `src/components/GameCard.tsx:41`、`src/index.css:230`                |
| `presentation.coverGradient / icon` | 首页卡片未消费；`icon` 被战绩标题辅助函数读取                            | `src/components/GameCard.tsx:38`、`src/features/games/catalog.ts:37` |
| `GameIcon` 映射                     | 首页与排行使用 Phosphor duotone 图标，未知 ID 回退为 GameController      | `src/components/GameCard.tsx:18`、`src/pages/Home.tsx:104`           |

因此，仅修改 manifest 的封面渐变或图标不能改变当前首页卡片对应的视觉。新增展示能力时需同时核对声明、消费组件与样式选择器。

## 现状差异与验证边界

详情标题栏的统一操作布局待对齐：当前 `GameDetail` 外壳提供标题与返回入口，各游戏自行组织操作控件（`src/pages/GameDetail.tsx:45`）；目标规范要求空间足够时标题居左、操作组同一行靠右，见 [标题栏与操作组](../contracts/ui-conventions.md#标题栏与操作组)。

| 项目           | 已确认现状                                                                                      | 状态                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 游戏控件主题   | `--gs-*` 允许主题覆盖；象棋、坦克等还有独立控件样式                                             | 相对统一控件规范待对齐                                                                                                                       |
| 状态反馈       | 玩家加载、首页加载、保存失败已有 status/alert；首页排行请求错误被忽略，初次失败会落到空排行文案 | 排行错误与空状态区分待对齐，见 `src/pages/Home.tsx:43`、`src/pages/Home.tsx:96`                                                              |
| 确认交互       | 玩家归档与打砖块编辑器退出使用 `window.confirm`；象棋选关采用原生 `dialog`                      | 确认层外观待对齐，见 `src/components/UserSelector.tsx:102`、`src/games/breakout/LevelEditor.tsx:141`、`src/games/xiangqi/LevelPicker.tsx:50` |
| 保存与离开     | SaveStatus 显示 pending 和重试，并监听 `beforeunload`；尚无覆盖全部游戏的 SPA 路由离开保护      | 数据保存含义已确认，跨路由保护覆盖待确认，见 `src/components/SaveStatus.tsx:5`                                                               |
| 视觉与可访问性 | 存在 focus-visible、减少动效规则和部分语义标注                                                  | 全页面对比度、真实触屏与键盘操作覆盖待浏览器验证                                                                                             |

上述是源码核对范围内的现状；完整游戏清单逐页走查结果以 [UI 走查手册](../runbooks/ui-review.md) 的当次记录为准。
