# CRT Arcade 复古街机风 · 全站视觉重设计 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 mini-games-fe 全站视觉重构为 CRT Arcade 复古街机风（暗底 + 霓虹 + 像素字体），替换当前奶油色卡通风格。

**Architecture:** 设计令牌（Tailwind theme）驱动的纯 CSS/Tailwind 改造。全程保留现有组件结构、路由、状态管理、API；只替换 className 与少量展示结构。新增 `crt.*` 色板与字体，旧 `fun.*` token 保留但不再使用。动效纯 CSS @keyframes 实现。

**Tech Stack:** Tailwind CSS 3 / React 19 / TypeScript / Google Fonts (Press Start 2P, VT323) / Vite。

**Spec:** [`docs/superpowers/specs/2026-04-29-crt-arcade-redesign.md`](../specs/2026-04-29-crt-arcade-redesign.md)

---

## File Structure

| 文件                                     | 责任                                                             | 动作      |
| ---------------------------------------- | ---------------------------------------------------------------- | --------- |
| `tailwind.config.js`                     | 新增 `crt.*` 色板、3 套 fontFamily、霓虹阴影、`blink` keyframes   | Modify    |
| `index.html`                             | 引入 Press Start 2P + VT323 Google Fonts                          | Modify    |
| `src/index.css`                          | 暗色 body、扫描线 utility、`prefers-reduced-motion`               | Modify    |
| `src/App.css`                            | 清理旧自定义样式                                                  | Modify    |
| `src/components/Header.tsx`              | 霓虹 Logo + 像素导航 + 像素头像                                   | Modify    |
| `src/components/GameCard.tsx`            | 青边粉阴影 + NEW 角标 + PLAY NOW 发光按钮                         | Modify    |
| `src/components/Skeleton.tsx`            | NOW LOADING 像素进度条                                            | Modify    |
| `src/components/UserSelector.tsx`        | 像素头像 + VT323 字体                                             | Modify    |
| `src/pages/Home.tsx`                     | Hero 改造 + Tab + 排行榜样式                                      | Modify    |
| `src/pages/GameDetail.tsx`               | CRT 曲面屏 + 分数面板 + 发光按钮 + 规则块                         | Modify    |
| `src/pages/Profile.tsx`                  | 像素头像 + EXP 条纹 + 成就墙                                      | Modify    |

---

## Milestones

- **M1** · Tokens & Fonts（Task 1–3）
- **M2** · 通用组件（Task 4–7）
- **M3** · 首页（Task 8）
- **M4** · 游戏详情（Task 9）
- **M5** · 个人页（Task 10）
- **M6** · 验收（Task 11）

---

## Task 1: Tailwind Tokens

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: 读取当前 `tailwind.config.js`**

  确认 `theme.extend.colors.fun.*` / `fontFamily.game` / `boxShadow` 现状。

- [ ] **Step 2: 新增 CRT 设计令牌**

  将 `tailwind.config.js` 修改为：

  ```js
  /** @type {import('tailwindcss').Config} */
  export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
      extend: {
        colors: {
          // 保留旧 fun 色（兼容），新增 crt 色板
          'fun-bg':     '#fff8f3',
          'fun-card':   '#ffffff',
          'fun-border': '#fde8d8',
          'fun-accent': '#ff6b35',
          'fun-purple': '#a855f7',
          'fun-pink':   '#f472b6',
          'fun-sky':    '#38bdf8',
          'fun-yellow': '#fbbf24',
          'fun-green':  '#34d399',
          'fun-text':   '#2d1b69',
          'fun-muted':  '#a094b8',

          crt: {
            'bg-deep':   '#0a0e27',
            'bg-card':   '#0f1440',
            'bg-card-2': '#151a3a',
            border:      '#252a5a',
            pink:        '#ff2e88',
            cyan:        '#00f0ff',
            yellow:      '#ffd23f',
            green:       '#39ff14',
            purple:      '#b026ff',
            text:        '#f0f0ff',
            muted:       '#8888b8',
          },
        },
        fontFamily: {
          game:     ['"Nunito"', '"Segoe UI"', 'system-ui', 'sans-serif'],
          pixel:    ['"Press Start 2P"', 'monospace'],
          'mono-crt': ['"VT323"', 'monospace'],
          body:     ['"Nunito"', '"PingFang SC"', 'system-ui', 'sans-serif'],
        },
        boxShadow: {
          'card':       '4px 4px 0px #fde8d8',
          'card-hover': '6px 6px 0px #fbd0bc',
          'btn':        '3px 3px 0px rgba(0,0,0,0.12)',
          'btn-hover':  '5px 5px 0px rgba(0,0,0,0.12)',
          'crt-card':   '4px 4px 0 #ff2e88',
          'crt-lift':   '6px 6px 0 #ff2e88',
          'neon-c':     '0 0 12px #00f0ffaa',
          'neon-p':     '0 0 12px #ff2e88aa',
          'neon-y':     '0 0 12px #ffd23faa',
        },
        keyframes: {
          blink:   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
          breathe: {
            '0%,100%': { boxShadow: '0 0 6px #ffd23faa' },
            '50%':     { boxShadow: '0 0 18px #ffd23f' },
          },
        },
        animation: {
          blink:   'blink 1s steps(2) infinite',
          breathe: 'breathe 2s ease-in-out infinite',
        },
      },
    },
    plugins: [],
  }
  ```

- [ ] **Step 3: 验证构建**

  Run: `cd /Users/bytedance/Codebases/mini-games-fe && npm run build`
  Expected: PASS，无 Tailwind 配置报错。

- [ ] **Step 4: Commit**

  ```bash
  git add tailwind.config.js
  git commit -m "feat(tokens): add CRT arcade color palette, fonts, shadows, keyframes"
  ```

---

## Task 2: Google Fonts

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 修改 `index.html` `<head>` 中 Google Fonts 链接**

  将现有：
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
  ```
  替换为：
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet" />
  ```

- [ ] **Step 2: 启动 dev server 肉眼验证字体加载**

  Run: `cd /Users/bytedance/Codebases/mini-games-fe && npm run dev`（非阻塞）
  在浏览器 DevTools → Network 中确认 Press Start 2P / VT323 woff2 加载 200。

- [ ] **Step 3: Commit**

  ```bash
  git add index.html
  git commit -m "feat(fonts): load Press Start 2P and VT323 for CRT style"
  ```

---

## Task 3: Global CSS（body 暗色 + 扫描线 + motion）

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.css`

- [ ] **Step 1: 重写 `src/index.css`**

  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background-color: #0a0e27;
    background-image: radial-gradient(ellipse at center, #151a3a 0%, #0a0e27 85%);
    color: #f0f0ff;
    font-family: 'Nunito', 'PingFang SC', 'Segoe UI', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  #root { min-height: 100vh; }

  /* 扫描线 utility（叠加在元素上） */
  .crt-scanlines { position: relative; }
  .crt-scanlines::after {
    content: '';
    position: absolute; inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(0deg,
      rgba(255,255,255,0.03) 0,
      rgba(255,255,255,0.03) 1px,
      transparent 1px,
      transparent 3px);
  }

  /* 游戏屏专用扫描线（更粗） */
  .crt-scanlines-heavy::after {
    content: '';
    position: absolute; inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(0deg,
      rgba(0,0,0,0.4) 0,
      rgba(0,0,0,0.4) 2px,
      transparent 2px,
      transparent 4px);
  }

  /* 滚动条 */
  ::-webkit-scrollbar { width: 10px; }
  ::-webkit-scrollbar-track { background: #0a0e27; }
  ::-webkit-scrollbar-thumb {
    background: #ff2e88;
    border: 2px solid #0a0e27;
  }
  ::-webkit-scrollbar-thumb:hover { background: #00f0ff; }

  /* Reduce motion */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
    }
  }
  ```

- [ ] **Step 2: 清空 `src/App.css`**

  覆写为：
  ```css
  /* App 级自定义样式 —— CRT 风格下已由 Tailwind 与 index.css 接管 */
  ```

- [ ] **Step 3: 运行 dev server 肉眼检查**

  Run: `npm run dev` 并访问 `http://localhost:5173`。
  Expected: body 变黑，滚动条变粉色。

- [ ] **Step 4: Commit**

  ```bash
  git add src/index.css src/App.css
  git commit -m "feat(global): dark CRT base, scanline utility, reduced-motion safeguard"
  ```

---

## Task 4: Header 重写

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: 读取当前 `src/components/Header.tsx` 结构**

  确认 Logo / nav / UserSelector 三段式结构与 props 不变。

- [ ] **Step 2: 替换 Header className 与结构**

  - 外层：`bg-[#070a1e] border-b-2 border-crt-cyan`
  - Logo：改为 `<span class="font-pixel text-crt-cyan" style="text-shadow:0 0 8px #00f0ff">GAME</span><span class="font-pixel text-crt-pink" style="text-shadow:0 0 8px #ff2e88"> HALL</span>`
  - 导航 `<Link>`：`font-pixel text-[9px] text-crt-muted px-2 py-1 border border-transparent hover:border-crt-cyan hover:text-crt-cyan`，active 时 `text-crt-cyan border-crt-cyan`
  - 去掉原 emoji 装饰

- [ ] **Step 3: 运行 dev server 肉眼检查**

  Expected: 顶部出现霓虹双色 "GAME HALL"，导航字体为像素字。

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/Header.tsx
  git commit -m "feat(header): neon logo + pixel nav in CRT style"
  ```

---

## Task 5: UserSelector 像素化

**Files:**
- Modify: `src/components/UserSelector.tsx`

- [ ] **Step 1: 读取当前 UserSelector 结构**

  记录头像渲染方式（emoji/图片）与用户名位置。

- [ ] **Step 2: 替换样式**

  - 头像容器：`w-7 h-7 border-2 border-crt-yellow shadow-neon-p` + `style={{ imageRendering: 'pixelated' }}`
  - 背景：粉紫渐变 `bg-gradient-to-br from-crt-pink to-crt-purple`
  - 用户名：`font-mono-crt text-[15px] text-crt-yellow`
  - 下拉菜单：`bg-crt-bg-card border-2 border-crt-cyan font-mono-crt text-crt-text`

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/UserSelector.tsx
  git commit -m "feat(user-selector): pixel avatar + VT323 username"
  ```

---

## Task 6: GameCard 重写

**Files:**
- Modify: `src/components/GameCard.tsx`

- [ ] **Step 1: 更新 `coverColors` 映射为霓虹渐变**

  ```tsx
  export const coverColors: Record<string, string> = {
    minesweeper:   'from-crt-cyan to-crt-purple',
    snake:         'from-crt-green to-crt-cyan',
    '24points':    'from-crt-yellow to-crt-pink',
    '2048':        'from-crt-yellow to-crt-pink',
    memory:        'from-crt-pink to-crt-purple',
    'whack-a-mole':'from-crt-green to-crt-yellow',
    'slide-puzzle':'from-crt-cyan to-crt-purple',
    'reaction-test':'from-crt-green to-crt-yellow',
    'tic-tac-toe':  'from-crt-purple to-crt-pink',
    tetris:         'from-crt-purple to-crt-pink',
    breakout:       'from-crt-pink to-crt-yellow',
    wordle:         'from-crt-green to-crt-cyan',
    gomoku:         'from-crt-cyan to-crt-purple',
  }
  ```

- [ ] **Step 2: 重写 JSX 主体**

  ```tsx
  return (
    <Link
      to={`/game/${game.id}`}
      className="group block bg-crt-bg-card border-2 border-crt-cyan shadow-crt-card hover:shadow-crt-lift hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150 relative"
    >
      <div className={`bg-gradient-to-br ${gradient} h-32 flex items-center justify-center relative overflow-hidden crt-scanlines`}>
        <span className="text-6xl select-none drop-shadow-[0_0_8px_rgba(0,0,0,0.4)]">{icon}</span>
      </div>
      <div className="p-4">
        <h3 className="font-pixel text-[10px] text-crt-cyan mb-2 tracking-wider">
          {game.name}
        </h3>
        <p className="font-mono-crt text-[13px] text-crt-muted leading-tight line-clamp-2 mb-3 min-h-[34px]">
          {game.description}
        </p>
        <div className="flex flex-wrap gap-1 mb-3">
          {game.tags.map(tag => (
            <span key={tag}
              className="font-mono-crt text-[11px] px-1.5 py-0.5 bg-crt-yellow/10 text-crt-yellow border border-crt-yellow">
              {tag}
            </span>
          ))}
        </div>
        <div className="block w-full font-pixel text-[8px] py-2 text-center bg-crt-yellow text-crt-bg-deep shadow-neon-y tracking-wider">
          ▶ PLAY NOW
        </div>
      </div>
    </Link>
  )
  ```

- [ ] **Step 3: 删除 `difficultyChip` 常量（已不再使用）**

- [ ] **Step 4: 运行 dev server 肉眼检查**

  Expected: Home 页每张卡片：青色硬边 + 粉色 4px 阴影 + 像素字标题 + 黄色 PLAY NOW 按钮。

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/GameCard.tsx
  git commit -m "feat(gamecard): CRT arcade style with neon gradient cover and pixel CTA"
  ```

---

## Task 7: Skeleton 重写

**Files:**
- Modify: `src/components/Skeleton.tsx`

- [ ] **Step 1: 读取当前 Skeleton 结构**

- [ ] **Step 2: 替换 `GameCardSkeleton` 为像素 loading 方框**

  ```tsx
  export function GameCardSkeleton() {
    return (
      <div className="bg-crt-bg-card border-2 border-dashed border-crt-yellow/50 p-6 min-h-[260px] flex flex-col items-center justify-center shadow-crt-card">
        <div className="font-pixel text-[10px] text-crt-yellow mb-3 animate-blink">NOW LOADING</div>
        <div className="font-mono-crt text-[16px] text-crt-cyan tracking-widest">▓▓▓▓▓▒▒▒▒▒</div>
      </div>
    )
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/Skeleton.tsx
  git commit -m "feat(skeleton): pixel NOW LOADING placeholder"
  ```

---

## Task 8: Home 页改造

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: 替换 Hero 区域**

  将现有 `欢迎来到 游戏大厅！` 区块整体替换为：

  ```tsx
  <div className="text-center mb-8">
    <h1 className="font-pixel text-2xl md:text-4xl text-crt-yellow mb-3 tracking-[3px]"
        style={{ textShadow: '0 0 12px #ffd23f, 0 0 24px #ff2e88' }}>
      GAME <span className="text-crt-pink" style={{ textShadow: '0 0 12px #ff2e88' }}>HALL</span>
    </h1>
    <p className="font-mono-crt text-lg text-crt-cyan tracking-wider">
      &gt; INSERT COIN TO PLAY
      <span className="inline-block w-2.5 h-4 bg-crt-cyan ml-1 align-middle animate-blink" />
    </p>
    <p className="font-body font-black text-crt-muted text-sm mt-2">快来选一个游戏开始玩吧</p>
  </div>
  ```

- [ ] **Step 2: 替换分类 Tab 样式**

  ```tsx
  className={`font-pixel text-[8px] px-3 py-2 border-2 transition-all ${
    activeTag === tag
      ? 'bg-crt-pink text-crt-bg-deep border-crt-pink shadow-neon-p'
      : 'border-crt-pink text-crt-pink hover:shadow-neon-p'
  }`}
  ```

- [ ] **Step 3: 替换"全部游戏"子标题与计数徽章**

  - 子标题：`<h2 className="font-pixel text-sm text-crt-cyan tracking-wider">&gt;&gt; {activeTag === '全部' ? 'ALL GAMES' : activeTag}</h2>`
  - 计数：`<span className="font-mono-crt text-sm text-crt-yellow border border-crt-yellow px-2 py-0.5">{filteredGames.length} ITEMS</span>`

- [ ] **Step 4: 替换错误态 UI**

  ```tsx
  <div className="text-center py-20 bg-crt-bg-card border-2 border-crt-pink shadow-crt-card">
    <div className="font-pixel text-crt-pink text-sm mb-3">! ERROR !</div>
    <p className="font-mono-crt text-lg text-crt-pink mb-2">{error}</p>
    <code className="font-mono-crt text-sm text-crt-green bg-black px-3 py-1.5 border border-crt-cyan">
      cd server-go && go run .
    </code>
  </div>
  ```

- [ ] **Step 5: 替换排行榜侧栏**

  - 容器：`bg-crt-bg-card border-2 border-crt-yellow shadow-[3px_3px_0_#ff2e88] p-5 sticky top-6`
  - 标题：`<h3 className="font-pixel text-[10px] text-crt-yellow tracking-wider mb-3" style={{ textShadow: '0 0 6px #ffd23f' }}>★ TOP 5</h3>`
  - rank-tab：复用 tab 样式但更小（粉换青）
  - 列表项：`font-mono-crt text-[14px] text-crt-text`；第一名编号改为 `text-crt-pink`，其他 `text-crt-yellow`；冠军 `👑` 保留
  - 编号格式化：`String(idx + 1).padStart(2, '0')`

- [ ] **Step 6: 运行 dev server 检查**

  Expected: 首页从暖橙变为深蓝暗色、霓虹发光、像素字；排行榜侧栏黄边粉影。

- [ ] **Step 7: Commit**

  ```bash
  git add src/pages/Home.tsx
  git commit -m "feat(home): CRT hero, pixel tabs, neon ranking sidebar"
  ```

---

## Task 9: GameDetail 页改造（CRT 曲面屏）

**Files:**
- Modify: `src/pages/GameDetail.tsx`

- [ ] **Step 1: 读取当前 GameDetail 结构**

  记录：顶部信息、游戏 Canvas 容器、控制按钮、规则说明四大区块。

- [ ] **Step 2: 替换面包屑 / 标题区**

  ```tsx
  <div className="font-mono-crt text-sm text-crt-cyan mb-3">
    <Link to="/" className="text-crt-pink hover:underline">&lt; HOME</Link> / {game.name.toUpperCase()}
  </div>
  <h1 className="font-pixel text-2xl text-crt-yellow tracking-[2px] mb-2"
      style={{ textShadow: '0 0 10px #ffd23f' }}>
    {game.name.toUpperCase()}
  </h1>
  <div className="flex gap-2 mb-4">
    {game.tags.map(t => (
      <span key={t} className="font-mono-crt text-xs px-2 py-0.5 border border-crt-cyan text-crt-cyan">
        {t}
      </span>
    ))}
  </div>
  ```

- [ ] **Step 3: 用 CRT 外壳包裹游戏 Canvas 容器**

  在现有承载游戏的 `<div>` / `<component/>` 外层包一层：

  ```tsx
  <div
    className="relative border-4 border-black rounded-2xl bg-black overflow-hidden mb-4 crt-scanlines-heavy"
    style={{
      boxShadow: 'inset 0 0 40px rgba(0,240,255,0.2), 0 0 30px rgba(255,46,136,0.3)',
    }}
  >
    <div className="m-3.5 rounded-lg overflow-hidden">
      {/* 原来的游戏组件 */}
    </div>
  </div>
  ```

  小屏适配：当 `md:` 以下使用 `border-2 rounded-none`（用响应式 class）。

- [ ] **Step 4: 替换分数/状态面板为 3 列霓虹格**

  ```tsx
  <div className="grid grid-cols-3 gap-3 mb-4">
    <ScoreBox label="SCORE" value={score} />
    <ScoreBox label="LEVEL" value={level} />
    <ScoreBox label="BEST" value={best} />
  </div>
  ```

  在同文件顶部定义：
  ```tsx
  function ScoreBox({ label, value }: { label: string; value: number | string }) {
    return (
      <div className="border-2 border-crt-cyan bg-crt-cyan/5 p-3 text-center">
        <div className="font-pixel text-[7px] text-crt-cyan mb-1 tracking-wider">{label}</div>
        <div className="font-pixel text-sm text-crt-yellow"
             style={{ textShadow: '0 0 6px #ffd23f' }}>{value}</div>
      </div>
    )
  }
  ```

  > 若 GameDetail 当前不暴露 score/level/best，本次只替换外观；字段名保持兼容。

- [ ] **Step 5: 替换控制按钮**

  主按钮：`font-pixel text-[9px] py-2.5 border-2 border-crt-pink bg-crt-pink text-crt-bg-deep shadow-neon-p`
  次按钮：`font-pixel text-[9px] py-2.5 border-2 border-crt-pink text-crt-pink bg-transparent`

- [ ] **Step 6: 替换规则/说明块**

  ```tsx
  <div className="font-pixel text-[10px] text-crt-cyan my-4 tracking-wider">&gt;&gt; HOW TO PLAY</div>
  <div className="font-mono-crt text-[15px] leading-relaxed text-crt-muted border-l-4 border-crt-yellow bg-crt-yellow/5 px-4 py-3">
    {/* 原规则内容 */}
  </div>
  ```

- [ ] **Step 7: 运行 dev server 逐一打开 13 个游戏肉眼检查**

  Run: `npm run dev` 并逐个访问 `/game/tetris`、`/game/snake` 等。
  Expected:
  - CRT 曲面屏外壳出现、Canvas 正常渲染无遮挡
  - 分数面板 3 列、发光 START 按钮
  - 规则块黄色左边框

- [ ] **Step 8: Commit**

  ```bash
  git add src/pages/GameDetail.tsx
  git commit -m "feat(game-detail): CRT bezel around canvas + neon score panel + pixel controls"
  ```

---

## Task 10: Profile 页改造

**Files:**
- Modify: `src/pages/Profile.tsx`

- [ ] **Step 1: 读取当前 Profile 结构**

  记录：用户信息区、统计数据区、历史/成就区。

- [ ] **Step 2: 替换用户卡**

  ```tsx
  <div className="flex gap-4 p-5 border-2 border-crt-pink bg-crt-bg-card shadow-[4px_4px_0_#00f0ff] mb-5">
    <div className="w-20 h-20 border-4 border-crt-yellow shadow-neon-p
                    bg-gradient-to-br from-crt-pink to-crt-purple
                    flex items-center justify-center font-pixel text-white text-xl"
         style={{ imageRendering: 'pixelated' }}>
      {user.name.slice(0, 2).toUpperCase()}
    </div>
    <div className="flex-1">
      <div className="font-pixel text-sm text-crt-yellow mb-1 tracking-wider"
           style={{ textShadow: '0 0 8px #ffd23f' }}>{user.name.toUpperCase()}</div>
      <div className="font-mono-crt text-sm text-crt-muted">&gt; LEVEL <span className="text-crt-cyan">{level}</span> · ID #{user.id}</div>
      <div className="font-mono-crt text-sm text-crt-muted">&gt; JOINED {joinDate}</div>
      <div className="mt-2 h-3 bg-black border-2 border-crt-cyan relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 shadow-neon-c"
             style={{
               width: `${(exp / expMax) * 100}%`,
               background: 'repeating-linear-gradient(90deg, #00f0ff 0 4px, #ff2e88 4px 8px)',
             }} />
      </div>
      <div className="font-mono-crt text-xs text-crt-cyan mt-1">EXP {exp} / {expMax}</div>
    </div>
  </div>
  ```

  > 若当前 Profile 没有 exp/level 字段，用 mock 值 `const level = 12; const exp = 620; const expMax = 1000`。

- [ ] **Step 3: 替换统计数据块为 3 列霓虹格**

  ```tsx
  <div className="grid grid-cols-3 gap-3 mb-5">
    <StatBox label="PLAYED" value={playedCount} />
    <StatBox label="HIGH SCORE" value={highScore} />
    <StatBox label="PLAY TIME" value={playTime} />
  </div>
  ```

  ```tsx
  function StatBox({ label, value }: { label: string; value: number | string }) {
    return (
      <div className="border-2 border-crt-cyan bg-crt-bg-card shadow-[3px_3px_0_#ffd23f] p-4 text-center">
        <div className="font-pixel text-[7px] text-crt-cyan mb-2 tracking-wider">{label}</div>
        <div className="font-pixel text-base text-crt-pink"
             style={{ textShadow: '0 0 8px #ff2e88' }}>{value}</div>
      </div>
    )
  }
  ```

- [ ] **Step 4: 替换历史记录/成就区为成就墙（如当前只有历史记录列表，新增一个成就墙 section）**

  ```tsx
  <div className="font-pixel text-[11px] text-crt-yellow mb-2 tracking-wider"
       style={{ textShadow: '0 0 6px #ffd23f' }}>★ ACHIEVEMENTS</div>
  <div className="grid grid-cols-4 gap-2">
    {achievements.map(a => (
      <div key={a.id}
           className={`aspect-square flex flex-col items-center justify-center border-2 p-2 text-center
             ${a.unlocked
               ? 'border-crt-yellow text-crt-yellow bg-crt-yellow/5 shadow-neon-y'
               : 'border-crt-border text-crt-muted bg-crt-bg-card'}`}>
        <div className="text-xl mb-1">{a.unlocked ? a.icon : '🔒'}</div>
        <div className="font-mono-crt text-[12px]">{a.unlocked ? a.name : '???'}</div>
      </div>
    ))}
  </div>
  ```

  若没有 `achievements` 数据，在组件顶部 mock：

  ```tsx
  const achievements = [
    { id: 1, name: 'FIRST WIN',  icon: '🏆', unlocked: true  },
    { id: 2, name: 'SPEED RUN',  icon: '⚡', unlocked: true  },
    { id: 3, name: 'CENTURY',    icon: '💯', unlocked: true  },
    { id: 4, name: '???',        icon: '🔒', unlocked: false },
    { id: 5, name: 'SNIPER',     icon: '🎯', unlocked: true  },
    { id: 6, name: '???',        icon: '🔒', unlocked: false },
    { id: 7, name: 'ON FIRE',    icon: '🔥', unlocked: true  },
    { id: 8, name: '???',        icon: '🔒', unlocked: false },
  ]
  ```

- [ ] **Step 5: 保留原有"历史记录"列表（如有），仅替换样式**

  列表项：`border-b border-crt-border py-2 font-mono-crt text-crt-text`；分数列 `text-crt-yellow`。

- [ ] **Step 6: 运行 dev server 检查**

  Expected: 用户卡像素头像 + EXP 条纹进度条 + 3 列数据 + 4×2 成就墙。

- [ ] **Step 7: Commit**

  ```bash
  git add src/pages/Profile.tsx
  git commit -m "feat(profile): pixel avatar, EXP bar, neon stat boxes, achievement wall"
  ```

---

## Task 11: 验收与回归

**Files:** 无新增

- [ ] **Step 1: 构建 & Lint**

  Run:
  ```bash
  cd /Users/bytedance/Codebases/mini-games-fe
  npm run build
  npm run lint
  ```
  Expected: 两条命令均 exit 0。

- [ ] **Step 2: 手动回归 13 款游戏**

  逐个访问并快速玩 5 秒：
  - `/game/tetris` `/game/snake` `/game/2048` `/game/minesweeper`
  - `/game/breakout` `/game/gomoku` `/game/memory` `/game/reaction-test`
  - `/game/slide-puzzle` `/game/tic-tac-toe` `/game/whack-a-mole`
  - `/game/wordle` `/game/24points`

  确认每个游戏：Canvas/DOM 能正常渲染，控制能响应，无被 CRT 外壳遮挡的情况。

- [ ] **Step 3: 小屏响应式检查**

  DevTools 切换到 iPhone 12 尺寸，访问 Home / GameDetail / Profile，确认：
  - GameCard 不溢出
  - GameDetail CRT 外壳不压缩 Canvas
  - 排行榜侧栏折叠到底部

- [ ] **Step 4: Reduced-Motion 检查**

  DevTools → Rendering → Emulate CSS `prefers-reduced-motion: reduce`
  Expected: 闪烁光标、NEW! 角标、按钮呼吸全部静止。

- [ ] **Step 5: 搜索残留旧 token**

  Run:
  ```bash
  grep -rn "fun-" src/
  ```
  Expected: 除了 `tailwind.config.js` 中兼容保留的定义外，`src/` 业务代码内应已不再出现 `fun-*` className。若有遗漏，补回替换。

- [ ] **Step 6: Commit 最终里程碑 tag（可选）**

  ```bash
  git tag -a crt-redesign-done -m "CRT Arcade redesign complete"
  ```

- [ ] **Step 7: 推送（等用户明确指令后执行）**

  ```bash
  # git push origin main
  # git push origin crt-redesign-done
  ```

---

## Testing Strategy

- **视觉回归**：逐页肉眼对比 spec mockup（`.superpowers/brainstorm/29233-*/crt-arcade-full-mockup.html`）
- **游戏可用性**：13 款游戏手动通关性检查，不允许样式污染 Canvas 内部
- **Lint/Build**：`npm run build` + `npm run lint` 必须通过
- **A11y**：`prefers-reduced-motion: reduce` 下动画全停
- **无单元测试**：本项目当前无测试框架（package.json 未配置），纯视觉改造不引入测试依赖（YAGNI）

---

## Rollback Plan

若任一里程碑后出现严重问题：
- `git log --oneline` 找到对应 commit
- `git revert <commit>` 回滚至上一里程碑
- 所有 `fun.*` token 都保留在 `tailwind.config.js` 中，页面可一键 revert 回原风格。

---

## Done Criteria（Recap）

- [ ] 所有 11 个 Task 的 checkbox 全部勾选
- [ ] `npm run build` / `npm run lint` 通过
- [ ] 13 款游戏可玩
- [ ] Spec Section 7 的 9 条验收标准全部满足
