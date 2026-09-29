# 发布

## 发布前检查

```bash
npm ci
npm run lint
npm test
npm run build
```

确认 `git diff` 中没有意外玩家存档改动。构建成功仅证明当前代码可生成产物；发布前必须区分静态资源服务与玩家文件接口。

## 构建命令

```bash
npm run build
```

该命令依次执行 `tsc -b`、`vite build`、`node scripts/prepare-sites-worker.mjs`（`package.json:11`）。类型检查包含 app 与 Vite/Node 配置，客户端和 Worker 的职责不同。

## 产物结构

```text
dist/
├── client/          # HTML / JS / CSS / 图片 / 音频
│   ├── index.html
│   └── assets/
└── server/
    └── index.js     # 静态资源 Worker，不包含玩家文件 API
```

`data/players/` 是本机文件服务的存档目录，不属于上述静态产物。构建不会把本机文件中间件转成生产存档服务。

## 部署

### 本机开发与构建预览

`npm run dev` 和构建后的 `npm run preview` 都通过 `playerDataPlugin` 提供文件接口（`scripts/player-data.ts:205`）。通过 localhost/回环地址访问，并保留当前工作目录的玩家文件，才能完成现有流程。

这描述的是当前本机运行能力，不代表面向公网的生产部署方案。

### Cloudflare Pages / Sites

`dist/client/` 是静态资源，`dist/server/index.js` 依赖 `env.ASSETS`，兼容 `/client/` 前缀并对符合条件的 404 请求回退到入口 HTML（`scripts/prepare-sites-worker.mjs:10`、`scripts/prepare-sites-worker.mjs:30`）。

Worker 没有实现 `/__player-data/players`。当前客户端遇到非 JSON 响应会提示缺少文件服务，且玩家入口会阻止进入游戏；因此仅上传这些产物不能视为完整发布。

### 其他静态托管（Netlify / Vercel / Nginx 等）

HashRouter 的页面路由不要求服务端 history rewrite，但玩家存档仍要求独立 API 能力。单独部署 `dist/client/` 不满足当前应用的数据访问需求。

**待确认**：目标是长期本机运行，还是支持独立静态站点；后者的玩家存储、身份边界及生产接口方案尚未在仓库中实现。线上环境状态需单独验证，不能从构建产物推定。

## 版本与提交

仓库 package version 当前为 `0.1.0`，没有单独的版本发布脚本；主分支为 main，不意味着其每个提交都已完成线上验证。提交信息参考 `git log`，仅在用户授权时 commit / push（根目录 `AGENTS.md`）。

## 发布后验证

| 检查范围     | 验证内容                                                              |
| ------------ | --------------------------------------------------------------------- |
| 玩家与接口   | 列表接口返回 JSON；创建/选择测试玩家、刷新后恢复档案                  |
| 游戏与记录   | 验证一款 Canvas 游戏和一款 DOM 游戏，完成结算后确认文件与个人记录同步 |
| 隔离与排行   | 切换玩家不串进度；已结算记录影响排行，隐藏游戏遵循展示规则            |
| 失败恢复     | 在隔离测试环境中制造保存失败，恢复后按原 ID 重试，确认没有重复记录    |
| 浏览器与输入 | 验证懒加载资源、音频、可见性切换；涉及手柄时使用真实设备验证          |

上述检查需在目标运行环境执行；Node 单元测试和静态构建不能替代它们。数据恢复边界见 [排障手册](./debugging.md)。
