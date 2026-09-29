# 下游依赖清单

## npm 运行时依赖

版本范围以 `package.json:19` 的 dependencies 为准，实际解析版本由 `package-lock.json` 锁定。

| 包                      | 版本范围 | 用途                                      |
| ----------------------- | -------- | ----------------------------------------- |
| `@phosphor-icons/react` | ^2.1.10  | 界面图标                                  |
| `react`、`react-dom`    | ^19.2.4  | UI 与 DOM 渲染                            |
| `react-router-dom`      | ^7.6.0   | HashRouter 路由                           |
| `zustand`               | ^5.0.5   | 当前玩家与恢复状态，不使用 persist 中间件 |

## npm 开发依赖（关键项）

| 范围       | 依赖与用途                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------- |
| 构建       | `vite`、`@vitejs/plugin-react`、`typescript`                                                  |
| 样式       | `tailwindcss`、`postcss`、`autoprefixer`                                                      |
| 检查与格式 | `eslint`、`typescript-eslint`、React Hooks/Refresh 插件、`prettier`、`eslint-config-prettier` |
| 测试与类型 | `tsx`、`@types/node`、React 类型包                                                            |

`package.json:6` 声明 Node 版本范围为 `^20.19.0 || ^22.13.0 || >=24`。本机文件服务使用 Node 内置 HTTP、文件和 crypto 能力，不依赖独立数据库。

## 外部网络依赖

| 资源         | 地址                                                        | 用途 / 失败行为                                                  |
| ------------ | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| 本机文件接口 | 同源 `/__player-data/players`                               | 玩家、战绩和主要进度；服务不可用时显示错误，不回退为浏览器主存档 |
| Google Fonts | `https://fonts.googleapis.com`、`https://fonts.gstatic.com` | 字体样式与文件；加载失败时使用字体栈后备字体                     |

字体由 `index.html:8` 引入；字体栈见 `tailwind.config.js:33`。游戏图片、纹理及音频位于 `public/`。manifest 支持 HTTPS 外链游戏，但当前已注册游戏均使用内置运行时。

## localStorage 依赖

浏览器存储与玩家文件并存。上次玩家 ID、待保存结算备份、旧数据迁移标记、部分游戏进度及编辑器/偏好数据的权威键清单见 [数据流](../architecture/data-flow.md#7-localstorage-键总览)。

清除浏览器数据不会删除已经保存的玩家文件，但可能丢失尚未提交成功的结算备份和仅保存在浏览器中的内容。文件损坏、备份与恢复见 [排障手册](../runbooks/debugging.md)。

## 构建产物依赖

`vite.config.ts:7` 加载本机文件插件；插件只在 dev / preview 挂载。静态 Worker 由 `scripts/prepare-sites-worker.mjs:7` 生成，依赖 `env.ASSETS`，只处理静态资源与回退，不提供玩家接口。

因此不能用“上传 dist 即具备全部能力”描述当前发布方式；支持的环境与待确认部署目标见 [系统上下文](../architecture/system-context.md#运行环境)。
