# 发布

## 发布前检查

```bash
npm install        # 确保依赖与 lockfile 一致
npm run lint       # ESLint 通过
npx tsc --noEmit   # 类型检查通过
npm test           # 单元测试通过
npm run build      # 生产构建成功
```

## 构建命令

```bash
npm run build
```

该命令依次执行：

1. `tsc -b`：TypeScript 项目引用构建与类型检查。
2. `vite build`：打包客户端产物到 `dist/client/`。
3. `node scripts/prepare-sites-worker.mjs`：生成 Cloudflare Sites Worker 到 `dist/server/index.js`。

## 产物结构

```
dist/
├── client/          # 静态站点（HTML / JS / CSS / 图片）
│   ├── index.html
│   └── assets/
└── server/
    └── index.js     # Cloudflare Sites Worker（SPA fallback）
```

## 部署

### Cloudflare Pages / Sites

- 上传 `dist/client/` 作为静态资源。
- `dist/server/index.js` 作为 Worker 处理 404 fallback 到 `index.html`，并兼容 `/client/` 前缀路径。
- Worker 依赖 `env.ASSETS` 静态资源绑定。

### 其他静态托管（Netlify / Vercel / Nginx 等）

- 只需部署 `dist/client/`。
- 由于使用 `HashRouter`，路由不依赖服务端 rewrite，所有路径都由 `index.html` 加载后在前端解析，因此无需额外 SPA fallback 配置。

## 版本与提交

- 仓库未使用语义化版本号（无 `version` 发布流程），以 `main` 分支为最新稳定版。
- 提交信息遵循仓库已有风格（参考 `git log`）。
- 仅在用户明确要求时才创建 commit 或 push（见根目录 `AGENTS.md`）。

## 发布后验证

1. 访问首页，确认游戏卡片与排行榜正常渲染。
2. 进入 2-3 款游戏（含一款 Canvas 游戏如打砖块、一款 DOM 游戏如扫雷），确认可玩并能提交战绩。
3. 在个人中心查看战绩是否记录。
4. 清除 localStorage 后刷新，确认降级为空状态不报错。
