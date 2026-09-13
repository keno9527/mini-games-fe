# 本地开发与构建规则

## 环境要求

- Node.js 20.19.x、22.13.x 或 24+（推荐 22.13.x）
- npm（仓库 lockfile 为 `package-lock.json`，请勿混用 pnpm/yarn）

## 常用命令

所有命令在项目根目录执行：

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器（端口 5183，热更新）
npm run build    # 类型检查 + 生产构建，产物在 dist/
npm run preview  # 本地预览生产构建
npm test         # 运行单元测试（node:test + tsx）
npm run lint     # ESLint 检查
npm run lint:fix # ESLint 自动修复
npm run format   # Prettier 格式化
```

## 开发约定

### 路径别名

- 使用 `@/` 前缀引用 `src/` 下的模块（如 `import { createRecord } from '@/api'`）。
- 别名同时配置在 `vite.config.ts` 与 `tsconfig.app.json`，新增别名需两处同步。

### 添加一个新游戏

1. 在 `src/games/<game-id>/` 下创建 `manifest.ts`，声明元数据、展示配置和 `runtime`。
2. `embedded` 游戏添加 `index.tsx`，并在 `runtime.load` 中懒加载；组件接收 `{ userId?, gameId }`，结束时调用 `createRecord`。
3. `external` 游戏在 `runtime` 中声明 HTTPS `href` 和 `openIn: 'new-tab'`，不需要 `index.tsx`。
4. 在 `src/games/registry.ts` 的 `gameManifests` 数组中引入并注册；卡片和排行榜无需添加分支。

### 代码风格

- TypeScript 严格模式：`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch` 均开启。
- 优先使用函数式组件 + Hooks；游戏循环使用 `useRef` 持有可变状态，避免每帧 re-render。
- 提交前运行 `npm run lint` 与 `npm test` 确保通过。
- 不要主动创建文档文件，除非明确要求（见根目录 `AGENTS.md`）。

### 样式

- 使用 Tailwind CSS 工具类，自定义设计令牌见 `tailwind.config.js`（`fun-*` 暖色系、`crt-*` 像素霓虹系）。
- 字体类：`font-game`（Nunito）、`font-pixel`（Press Start 2P）、`font-mono-crt`（VT323）。

## 构建产物

- `npm run build` 先执行 `tsc -b` 类型检查，通过后由 Vite 输出到 `dist/client/`。
- 随后 `node scripts/prepare-sites-worker.mjs` 生成 Cloudflare Sites Worker 到 `dist/server/index.js`。
- 纯静态部署只需上传 `dist/client/`。
