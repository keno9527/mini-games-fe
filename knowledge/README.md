# knowledge/

本目录是 mini-games-fe 前端工程的知识库，沉淀工程结构、领域模型、对外契约与运维操作手册。

## 导航表

| 层级 | 文件 | 内容 |
|------|------|------|
| L1 索引 | [README.md](./README.md) | 导航表 + 维护约定（本文件） |
| L1 总览 | [overview.md](./overview.md) | 服务用途、职责、上下游总览 |
| 架构 | [architecture/system-context.md](./architecture/system-context.md) | 系统边界与上下文映射 |
| 架构 | [architecture/module-map.md](./architecture/module-map.md) | 模块划分与分层依赖 |
| 架构 | [architecture/data-flow.md](./architecture/data-flow.md) | 请求 / 事件数据流 |
| 领域 | [domain/entities.md](./domain/entities.md) | 领域实体（Game / User / GameRecord 等） |
| 契约 | [contracts/apis.md](./contracts/apis.md) | 本地数据 API 契约总览 |
| 契约 | [contracts/dependencies.md](./contracts/dependencies.md) | 下游依赖清单（npm 包、外部链接） |
| 契约 | [contracts/events.md](./contracts/events.md) | 游戏生命周期事件与回调 |
| 运维 | [runbooks/development.md](./runbooks/development.md) | 本地开发与构建规则 |
| 运维 | [runbooks/debugging.md](./runbooks/debugging.md) | 分层验证链路与排障 |
| 运维 | [runbooks/release.md](./runbooks/release.md) | 发布流程 |
| 运维 | [runbooks/testing.md](./runbooks/testing.md) | 测试用法与实测参数 |

## 维护约定

1. **事实优先**：所有描述必须与 `src/` 中的当前代码一致；代码变更后同步更新对应文档。
2. **单一权威**：每个主题只在一个文件中定义，其他文件引用而非复制。
3. **导航表唯一来源**：本文件的"导航表"是知识库文档清单的唯一权威来源。根目录 `AGENTS.md` 只按分类做简要指引并链接回本文件，不复制逐文件表格。新增、删除或重命名知识库文档时，只需更新上面的导航表。
4. **就近原则**：游戏内的实现细节写在游戏目录内（如 `src/games/<game>/`），本知识库只记录跨游戏、跨模块的工程级约定。
5. **代码引用**：文档中引用源码使用 `文件路径:行号` 格式，便于跳转核对。
6. **新增游戏**：在 `src/games/<id>/manifest.ts` 注册后，无需改动本知识库；只有当游戏引入新的跨模块机制（如新的持久化 schema、新的外部依赖）时才更新对应契约文档。
