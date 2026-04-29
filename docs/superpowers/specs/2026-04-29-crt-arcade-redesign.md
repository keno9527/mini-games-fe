# CRT Arcade 复古街机风 · 全站视觉重设计

> **Status**: Approved Design · Ready for Planning
> **Date**: 2026-04-29
> **Owner**: keno9527
> **Target**: `mini-games-fe` 全站（所有页面 + Header + 卡片组件）

---

## 1. 背景与目标

### 1.1 背景
当前 `mini-games-fe` 使用"暖橙奶油色 + 卡通手绘阴影"风格，定位温馨休闲。用户反馈**"交互不够酷炫"**，希望注入强视觉辨识度与游戏气质。

经 brainstorming 探索，选定 **方案 1 · CRT Arcade 街机主机风**：

- **暗底（#0a0e27）** + **霓虹多色（粉/青/黄/绿/紫）** + **像素字体**
- 局部 CRT 特效（扫描线、发光、曲面屏外壳），仅用于游戏相关视觉区
- 适度动效（hover 发光、点击像素飞散、loading 进度条）

### 1.2 目标
1. 将整站视觉语言统一重构为 CRT Arcade 风格
2. 保证中文正文可读性（VT323 + Nunito 900 混排）
3. 尽量通过 Tailwind 设计 Token 替换实现，减少业务组件结构改动
4. 不影响各游戏 Canvas 内部渲染（仅包装外壳变化）

### 1.3 非目标（YAGNI）
- ❌ 不重绘现有游戏封面 SVG（复用 `public/covers/*.svg`）
- ❌ 不引入动效库（framer-motion 等）；仅用 CSS `@keyframes`
- ❌ 不做深浅色主题切换（单一暗色主题）
- ❌ 不改动 Zustand/API/路由结构

---

## 2. 设计令牌（Design Tokens）

### 2.1 色彩系统

| Token             | HEX        | 用途                             |
| ----------------- | ---------- | -------------------------------- |
| `crt-bg-deep`     | `#0a0e27`  | 页面底色                         |
| `crt-bg-card`     | `#0f1440`  | 卡片底色                         |
| `crt-bg-card-2`   | `#151a3a`  | 次级卡片 / hover 态              |
| `crt-border`      | `#252a5a`  | 分隔线 / 次要边框                |
| `crt-neon-pink`   | `#ff2e88`  | 主 CTA / 第一名高亮 / 强调       |
| `crt-neon-cyan`   | `#00f0ff`  | 卡片主边框 / 链接 / 标题         |
| `crt-neon-yellow` | `#ffd23f`  | 分数 / 徽章 / 冠军               |
| `crt-neon-green`  | `#39ff14`  | Canvas 内容 / 成功态 / 输入焦点  |
| `crt-neon-purple` | `#b026ff`  | 装饰渐变 / 二级 CTA              |
| `crt-text-main`   | `#f0f0ff`  | 主要文本                         |
| `crt-text-muted`  | `#8888b8`  | 次要文本                         |

实现：在 `tailwind.config.js` `theme.extend.colors` 下新增 `crt.*` 子命名空间，不删除旧的 `fun.*`（保留向后兼容，但不再使用）。

### 2.2 字体系统

| 层级           | 字体                   | 用途                                    |
| -------------- | ---------------------- | --------------------------------------- |
| 标题 / Logo    | **Press Start 2P**     | 英文标题、导航、按钮文案、Logo          |
| 数据 / 命令行  | **VT323**              | 分数、ID、说明性英文、终端感文本        |
| 中文正文       | **Nunito 900** (系统)  | 所有中文内容（游戏名、描述、提示）      |

- 字体通过 Google Fonts 引入 `index.html`
- Tailwind 新增 `font-pixel` / `font-mono-crt` / `font-body` 三个 family

### 2.3 阴影系统

| Token             | CSS                                            | 用途                      |
| ----------------- | ---------------------------------------------- | ------------------------- |
| `shadow-crt-card` | `4px 4px 0 #ff2e88`                            | 游戏卡片标准阴影          |
| `shadow-crt-lift` | `6px 6px 0 #ff2e88`                            | 卡片 hover 态             |
| `shadow-neon-c`   | `0 0 12px #00f0ffaa`                           | 青色发光                  |
| `shadow-neon-p`   | `0 0 12px #ff2e88aa`                           | 粉色发光                  |
| `shadow-neon-y`   | `0 0 12px #ffd23faa`                           | 黄色发光                  |

### 2.4 边框 / 圆角

- **圆角**：默认 `0`（硬边）；仅 `Header`、`CRT 游戏屏` 允许最多 `rounded-lg`
- **边框**：全站 `border-2`（2px 硬边），`border-4` 仅用于 CRT 游戏屏外壳

---

## 3. 组件级设计规范

### 3.1 Header（`src/components/Header.tsx`）

```
┌────────────────────────────────────────────────────────┐
│ GAME▫HALL    [HOME] [RANK] [ABOUT]     [🟪] PLAYER_01 │
└────────────────────────────────────────────────────────┘
  Press Start 2P    Press Start 2P           pixel avatar + VT323
  青色+粉色          active 青描边框           黄边框粉底发光
```

- 背景：`bg-crt-bg-deep` + `border-b-2 border-crt-neon-cyan`
- Logo：`GAME` 青色发光 + `HALL` 粉色发光，字号 14px
- 导航：hover 态出现青色边框 + 青色发光
- 用户区：`UserSelector` 替换为像素头像（26×26，image-rendering: pixelated）+ VT323 用户名

### 3.2 GameCard（`src/components/GameCard.tsx`）

```
┌──────────────────┐
│┌────────────────┐│ ← cover: 渐变 + 叠加扫描线
││     [🎮]       ││
│└────────────────┘│
│ TETRIS     [NEW!]│ ← Press Start 2P 10px · 黄色闪烁角标
│ Stack blocks...  │ ← VT323 13px · muted
│ [PUZZLE][HOT]    │ ← 黄色 tag
│ [▶ PLAY NOW]     │ ← 黄底黑字发光按钮
└──────────────────┘
  青描边 + 粉色 4px 偏移阴影
```

- 根容器：`bg-crt-bg-card border-2 border-crt-neon-cyan shadow-crt-card`
- Hover：`shadow-crt-lift` + transform `translate(-2px, -2px)`（让阴影"显露"更多）
- `NEW!` 角标：仅当 `game.isNew`（前端约定字段，可先 mock）时出现，`animate-blink`
- Cover：保留现有 `coverColors` 渐变映射 + 叠加 CRT 扫描线 (`::after` repeating linear-gradient)
- `PLAY NOW` 按钮：`bg-crt-neon-yellow text-crt-bg-deep shadow-neon-y`

### 3.3 Home Hero（`src/pages/Home.tsx`）

- 删除 emoji 装饰 `✨`
- 主标题 `欢迎来到 游戏大厅！` → **`GAME HALL`** 像素字（保留中文副标题作为二级信息）
- 副标题改为命令行风：`> INSERT COIN TO PLAY_`（带闪烁光标）
- 中文提示 `快来选一个游戏开始玩吧` 保留为三级文本（Nunito 900，muted 色）

### 3.4 排行榜侧栏

- 容器：`border-crt-neon-yellow shadow-[3px_3px_0_#ff2e88]`
- 第一名：`text-crt-neon-pink` + 皇冠保留
- 排名数字：Press Start 2P 10px，`01` `02` 补零两位
- 游戏名：VT323 14px，next-to-none 行距

### 3.5 GameDetail（`src/pages/GameDetail.tsx`）

- **CRT 曲面屏外壳**：
  - `border-4 border-black rounded-2xl` + `shadow-[inset_0_0_40px_#00f0ff33,_0_0_30px_#ff2e8855]`
  - 内部 Canvas 容器外围再包一层 `inset-4` 的黑色圆角子区
  - `::after` 叠加扫描线（`repeating-linear-gradient` 黑色 2px 间隔）
- **分数面板**：3 列 Grid，每格 `border-2 border-crt-neon-cyan`
  - Label: Press Start 2P 7px 青色
  - Value: Press Start 2P 14px 黄色发光
- **控制按钮**：START（主 CTA 粉色发光）/ PAUSE / RESET
- **玩法说明**：`border-l-4 border-crt-neon-yellow bg-crt-neon-yellow/5` + VT323 字体

### 3.6 Profile（`src/pages/Profile.tsx`）

- **用户卡**：深卡底 + 粉描边 + 青阴影
  - 头像：80×80 `image-rendering: pixelated` + 粉紫渐变 + 黄框 + 粉色发光
  - EXP 进度条：12px 高，青粉条纹填充（`repeating-linear-gradient`）
- **数据块**：3 列 Grid，每格粉色发光数值
- **成就墙**：4×2 Grid
  - 已解锁：`border-crt-neon-yellow shadow-neon-y`
  - 未解锁：`border-crt-border` + 显示 🔒???

### 3.7 全局组件

| 组件          | 设计                                                        |
| ------------- | ----------------------------------------------------------- |
| 按钮 Primary  | 黄底黑字 + Press Start 2P + 黄色发光                        |
| 按钮 Ghost    | 粉色描边粉色字，hover 填充                                  |
| 输入框        | 黑底 + 青色 2px 描边 + VT323 绿色文字 + 青色光标            |
| Tab           | 粉色描边 → active 粉色填充 + 发光                           |
| Loading       | `▓▓▓▓▒▒▒▒` 字符进度条 + `NOW LOADING` 像素字                |
| Empty State   | `GAME OVER` / `NO DATA FOUND` 像素字 + muted 色 + 虚线框    |
| Toast/Alert   | 成功：绿描边 + 绿字；错误：粉描边 + 粉字                    |

---

## 4. 动效规范（CSS Only）

| 动效            | 触发                          | 实现                                                 |
| --------------- | ----------------------------- | ---------------------------------------------------- |
| `animate-blink` | `NEW!` 角标 / Hero 光标       | `@keyframes blink { 50% { opacity: 0 } }` 1s steps(2) |
| 卡片 hover 上浮 | GameCard hover                | `transition transform 150ms`                         |
| 按钮发光呼吸    | Primary CTA                   | `box-shadow` 0→12px 黄色循环 2s                       |
| Tab 切换        | 分类 tab 切换                 | 仅颜色过渡 100ms，无位移                             |

**性能/无障碍**：所有动效在 `prefers-reduced-motion: reduce` 下关闭（只保留颜色态）。

---

## 5. 文件改动清单

### 5.1 新增 / 修改

| 文件                                 | 变更                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `tailwind.config.js`                 | 新增 `crt.*` 色板 / 三套 fontFamily / 霓虹阴影 / `animate-blink` keyframes |
| `index.html`                         | 引入 Google Fonts (Press Start 2P, VT323)                                  |
| `src/index.css`                      | 全局 body 背景 / 默认字体 / 扫描线 utility / `prefers-reduced-motion`       |
| `src/components/Header.tsx`          | 视觉重写（结构保留）                                                        |
| `src/components/GameCard.tsx`        | 视觉重写（结构保留；`coverColors` 映射改为霓虹渐变）                        |
| `src/components/Skeleton.tsx`        | 改为像素进度条 `NOW LOADING` 样式                                          |
| `src/components/UserSelector.tsx`    | 像素头像 + VT323 字体                                                      |
| `src/pages/Home.tsx`                 | Hero 文案改造 + tab / 排行榜样式重写                                        |
| `src/pages/GameDetail.tsx`           | CRT 外壳 + 分数面板 + 控制按钮 + 规则块                                     |
| `src/pages/Profile.tsx`              | 用户卡 + 数据块 + 成就墙                                                    |
| `src/App.css`                        | 清理旧的奶油色自定义样式                                                    |

### 5.2 不改动

- `src/api/**`、`src/store/**`、`src/types/**`
- `src/games/**`（Canvas 内部）
- `public/covers/*.svg`
- Vite / TS 配置

---

## 6. 风险与权衡

| 风险                                                 | 对策                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| 中文 + Press Start 2P 混排不协调                     | 中文走 Nunito 900，Press Start 2P 仅用于 Logo/英文标题/按钮      |
| Google Fonts 加载慢影响首屏                          | 使用 `&display=swap` + `preconnect`                              |
| 暗色主题下游戏封面 SVG 对比度下降                    | 封面底色统一覆盖霓虹渐变，SVG 仅作剪影                            |
| 过多发光阴影导致 GPU/电池消耗                        | hover 时才放大发光，静默态维持中等光晕；`prefers-reduced-motion` 下停用 |
| GameDetail CRT 外壳在小屏挤压游戏 Canvas             | 外壳 padding 4px，小于 768px 时退化为 border-2 无圆角             |
| 旧 fun 色 token 仍被部分游戏内部引用                 | 保留 `fun.*` token 不删除，本期仅新增 `crt.*`                     |

---

## 7. 验收标准（Acceptance Criteria）

- [ ] 所有 `src/pages/*.tsx` 与 `src/components/*.tsx` 不再出现硬编码 `fun-*` 色；替换为 `crt-*` token
- [ ] `tailwind.config.js` 中 `crt.*` Token、三套字体、两个霓虹阴影 Token 落地
- [ ] `index.html` 成功加载 Press Start 2P + VT323
- [ ] Home 首屏可见：霓虹 Logo、命令行副标题、粉青卡片阴影、黄色排行榜
- [ ] GameDetail 打开任一游戏，可见 CRT 曲面屏外壳 + 3 列分数面板 + 发光 START 按钮
- [ ] Profile 打开可见像素头像 + EXP 条纹进度条 + 4×2 成就墙
- [ ] `prefers-reduced-motion: reduce` 下所有动画停用
- [ ] `npm run build` 通过，`npm run lint`（若有）通过
- [ ] 所有游戏（Tetris/Snake/2048 等 13 款）进入后 Canvas 正常渲染，无样式污染

---

## 8. 里程碑建议（供 writing-plans 参考）

1. **M1 · Tokens & Fonts**：tailwind.config、index.html、index.css
2. **M2 · 通用组件**：Header / Skeleton / UserSelector / GameCard
3. **M3 · 页面改造**：Home（Hero + Tabs + 排行榜）
4. **M4 · 游戏页**：GameDetail（CRT 外壳、分数、控制、规则）
5. **M5 · 个人页**：Profile（用户卡、数据、成就）
6. **M6 · 验收 & 回归**：手动过 13 款游戏 + lint + build

---

## 9. 参考资料

- 视觉 mockup：`.superpowers/brainstorm/29233-1777448197/crt-arcade-full-mockup.html`
- 风格对比：`.superpowers/brainstorm/29233-1777448197/pixel-styles-comparison.html`
- 字体：[Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) · [VT323](https://fonts.google.com/specimen/VT323)
