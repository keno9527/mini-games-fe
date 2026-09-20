# DEVX .aidev 使用说明

这份文档用于说明当前仓库 `.aidev` 下可编辑内容和 DEVX 自动维护文件。团队可以提交项目流程、能力资源、本说明和模板身份 Schema。

## 目录与维护边界

| 路径 | 用途 | 维护者 |
| --- | --- | --- |
| `.aidev/presets/<presetKey>.json` | 项目自定义研发流程 | 用户与 DEVX 编辑器 |
| `.aidev/skills/**` | 项目 Skill | 用户 |
| `.aidev/instructions/**` | 项目 Instruction | 用户 |
| `.aidev/agents/**` | 项目 SubAgent | 用户 |
| `.aidev/mcp*` / `.aidev/mcps/**` | 项目 MCP 配置 | 用户 |
| `.aidev/preset-drafts/<presetKey>/preset.json` | 已发布模板的独立本地编辑草稿，可单独选择和运行 | 用户与 DEVX 编辑器 |
| `.aidev/preset-drafts/<presetKey>/recovery*`、`backups/**` | 编辑器恢复与覆盖前备份，不参与流程扫描 | DEVX 自动维护，默认忽略提交 |
| `.aidev/template-bindings.json` | 本地流程与远端团队模板的身份映射 | DEVX 自动维护，请勿手改 |
| `.aidev/template-bindings.schema.json` | binding 字段 hover 与 JSON 校验 | DEVX 自动生成 |

## Preset 文件选择

- 每个自定义研发流程独立写入一个文件，例如 `.aidev/presets/custom-flow.json`。
- 文件名 stem、`presetKey` 和第一个 mode key 保持一致，例如 `custom-flow.json` 的第一个 mode key 是 `custom-flow`。
- `extends` 只表示继承的内置 base，例如后端流程使用 `extends: "builtin:backend"`，Web 流程使用 `extends: "builtin:web"`。
- 前后端一体仓库可以把新流程的 `extends` 设为 `builtin:fullstack`；历史 backend/web/fullstack override 仍兼容读取。
- 旧版 `.aidev/preset.json` 仍可兼容读取，但不建议用于全栈仓库，因为它只能覆盖当前一个 active preset。
- 自定义 preset 只能新增 custom mode/custom node，不能覆盖内置 mode、node、source、MCP 或 resource。
- 自定义 key 不强制使用 `custom_` 前缀，但保存前必须确认不与内置 key 或已有自定义 key 冲突。
- 如果要调整内置 node，请复制成新的 custom node，再在 custom mode 中引用它。

## Source 与 Output 规则

- `preset.json` 定义工作流；`sources/` 存放平台资产或用户输入；`outputs/` 存放 Agent 生成的正式产物。
- 节点 `inputs` 优先使用显式前缀：`source:<key>` 读取 sources，`output:<key>` 读取 outputs。
- 裸 key 会先读同名 output，再回退到同名 source；如果希望始终读取平台材料，请写成 `source:<key>`。
- 双中括号写法是 fallback 分组，例如 `"inputs": [["backend_requirement_analysis", "source:prd_url"]]`，表示按顺序选择第一个存在的候选。
- `inputs` 缺失会阻塞节点；`contextInputs` 是可选上下文，支持纯文本、仓库文件、source/output 引用和裸 key。缺失、不可读、未绑定会分开记录，但不阻塞执行。
- IDE 表单右侧“能力资源”里的“节点输入输出”tab 会展示当前需求已落盘的 sources/outputs，也会展示当前流程里已声明但尚未生成的 node outputs；新增或删除文件后点击“重新扫描”即可重新拉取，扫描期间按钮会显示“扫描中...”。
- 右侧所有资源统一使用“加入”按钮。加入后会写入当前聚焦的表单项，并滚动、聚焦、高亮目标输入框；加入 source/output 时会保留 `source:<key>` 或 `output:<key>` 前缀。
- `sources[].path`、`instruction`、`skill`、`subAgent` 的本地相对路径统一按仓库根目录解析，例如 `./.aidev/instructions/team-rule.md`。
- 项目自定义 MCP 建议放在 `.aidev/mcp/`、`.aidev/mcps/` 或 `.trae/mcp*` 下，支持 `.json`、`.jsonc`、`.toml`、`.yaml`、`.yml` 中的 `mcpServers`/`mcp_servers`。
- 仓库能力列表标题只展示文件名、目录名或 MCP key，副标题展示完整路径；标题过长时会单行省略，hover 展示全名，保存时使用路径引用而不是短标题。
- `nodes[].outputs` 声明正式产物；后续节点可以先引用这些声明，保存只校验引用是否声明过，运行时才校验对应文件是否已经生成。
- 代码修改类节点如果只产生仓库改动，可以写 `outputs: []`。
- Source key 在 `sources` 内唯一；Output key 在整个工作流内唯一。

## 团队模板身份字段

`.aidev/template-bindings.json` 不保存流程正文，只保存独立模板草稿、项目流程和远端模板版本线的关系。

| 字段 | 含义 |
| --- | --- |
| `templateId` | 远端模板的稳定唯一 ID；重复点击同一模板编辑时用它定位已有本地副本。 |
| `canonicalKey` | 远端模板的正式 key。 |
| `draftPresetPath` | 独立模板草稿 preset 的仓库根相对路径。 |
| `draftPresetHash` | 最近一次与远端版本同步时独立模板草稿的 SHA-256 摘要，用于识别后续本地修改。 |
| `localPresetPath` | 项目当前应用 preset 的仓库根相对路径。 |
| `primaryModeKey` | 当前项目使用的主流程 key。 |
| `baseVersion` | 本地内容上次同步时对应的远端正式版本号。 |
| `baseDigest` | 上次同步基线的内容摘要，用于识别远端是否变化。 |
| `baseRef` | 上次同步的远端锁定版本引用。 |
| `presetHash` | 上次成功应用时项目 preset 的 SHA-256 摘要。 |
| `resources` | 模板附带项目资源的路径到 SHA-256 摘要映射，用于识别本地资源修改。 |
| `spaceKey` | 远端模板所属空间。 |
| `localAliases` | 本地流程改名后保留的历史 preset/mode 身份。 |
| `pendingCanonicalKey` | 发布改名事务中的临时状态，正常完成后由 DEVX 清理。 |
| `schemaVersion` | binding 文件结构版本。 |

## 编辑已发布模板时的三方比较

编辑器比较独立模板草稿、同 key 项目流程、上次同步基线和远端正式版。检测到差异时不会在用户选择前覆盖文件或阻止编辑。

| 本地内容 | 远端正式版 | 行为 |
| --- | --- | --- |
| 等于上次同步基线 | 等于上次同步基线 | 直接打开，不提示。 |
| 不同于上次同步基线 | 等于上次同步基线 | 直接打开本地内容，说明存在未发布修改。 |
| 等于上次同步基线 | 不同于上次同步基线 | 打开本地内容并提示远端有更新。 |
| 不同于上次同步基线 | 不同于上次同步基线 | 打开本地内容，提供“继续使用本地内容”“使用已发布版本”“查看差异”。 |

- “继续使用本地内容”只保留独立模板草稿，直到用户主动应用或发布。
- “使用已发布版本”会替换本地内容，必须由用户明确选择。
- 未选择时默认保留本地，不发生文件写入。
- 旧版 `.aidev/template-authoring` 不再读取或迁移；关闭旧编辑器后可手动删除该目录，再从模板市场重新点击“编辑”。
- 只扫描 `.aidev/preset-drafts/<presetKey>/preset.json` 作为模板草稿；同目录 recovery、metadata 和 backups 不进入模式列表。
- 编辑器只提供“保存并应用”和“保存并发布”。前者用同一 snapshot 更新草稿与项目流程，后者保存草稿后发布且不修改项目流程。

## 能力资源清单

下面的内置能力由 DEVX 初始化和模式绑定流程注入。编辑器还会扫描 `.aidev/.trae/.agents/.codex/.coco/.opencode/.claude` 下的能力资源；`.aidev` 归类为项目自定义能力，其他目录归类为外部能力；`.coco/.trae/commands/<name>.md` 和 `.coco/.trae/commands/<name>/prompt.md` 会作为 Instruction 资源展示；`.trae` 仍不展示 knowledges、documents；`.codex` 中由 AIDEV 注入的托管软链会被自动剔除。扫描结果会完整保留，右侧能力区按名称自然排序，每页展示 10 个资源。

# AIDEV Builtin Resources

这份说明用于创建或编辑自定义 preset。建议把 override 写到 `.aidev/presets/<presetKey>.json`；preset 中可以直接使用 `@name` 引用内置 skill、subAgent 和 instruction；MCP 使用 `mcpServers` 中的 key，preset 通过 `extends` 使用 `builtin:<key>`。

Skill 的作用说明来自各自的 `SKILL.md` frontmatter；需要更完整的使用流程时，可以打开来源路径继续阅读。

## Presets

- `builtin:backend` - backend preset，包含 1 个 mode、4 个 node。
  - 类型：preset
  - 来源：presets/backend.json
- `builtin:fast-forward` - fast-forward preset，包含 1 个 mode、2 个 node。
  - 类型：preset
  - 来源：presets/fast-forward.json
- `builtin:fullstack` - fullstack preset，包含 1 个 mode、11 个 node。
  - 类型：preset
  - 来源：presets/fullstack.json
- `builtin:standard-fast-forward` - standard-fast-forward preset，包含 1 个 mode、2 个 node。
  - 类型：preset
  - 来源：presets/standard-fast-forward.json
- `builtin:web` - web preset，包含 1 个 mode、5 个 node。
  - 类型：preset
  - 来源：presets/web.json

## Instructions

- `@ai_auto_test` - 部署与 AI 自动化测试
  - 类型：instruction
  - 来源：instructions/ai_auto_test.md
- `@aidev_common` - AIDEV 通用执行规则
  - 类型：instruction
  - 来源：instructions/aidev_common.md
- `@backend_gen_code` - 后端代码修改 Agent
  - 类型：instruction
  - 来源：instructions/backend_gen_code.md
- `@backend_light_tech_doc` - 全栈后端轻量技术方案
  - 类型：instruction
  - 来源：instructions/backend_light_tech_doc.md
- `@backend_tech_doc` - 后端技术方案
  - 类型：instruction
  - 来源：instructions/backend_tech_doc.md
- `@fast_forward` - 敏捷模式 Agent（快速模式 Agent）
  - 类型：instruction
  - 来源：instructions/fast_forward.md
- `@frontend_gen_code` - Web 代码修改 Agent
  - 类型：instruction
  - 来源：instructions/frontend_gen_code.md
- `@fullstack_requirement_analysis` - 全栈需求解析 Agent
  - 类型：instruction
  - 来源：instructions/fullstack_requirement_analysis.md
- `@tech_design_common` - 技术方案统一执行流程
  - 类型：instruction
  - 来源：instructions/tech_design_common.md
- `@web_tech_doc` - Web 技术方案
  - 类型：instruction
  - 来源：instructions/web_tech_doc.md

## Skills

- `@aidev_report_ide_development_log` - 上报 AIDEV IDE 研发交付埋点日志。Use when an AI node confirms technical-solution reuse, code reuse, fixed cloud bug IDs, local deployment or automated-test request/results, or other incremental IDE development delivery state during DEVX/AIDEV runs.
  - 类型：skill
  - 来源：skills/aidev_report_ide_development_log/SKILL.md
- `@aidev-cooperation` - AIDEV 研发产物一次性协作提交 Skill。用于在 AIDEV 流程节点结束时，把技术方案、代码生成一个或多个产物合并到同一个 main-agent/user-feedback 请求中提交。触发场景包括需要同步技术方案文档、代码生成分支/MR/revision/Goofy ID、前后端混合产物，或需要避免分别调用 sync_tech_design / sync_code_generation 造成多次请求。
  - 类型：skill
  - 来源：skills/aidev-cooperation/SKILL.md
- `@aidev-issues` - DEVX / Meego issues 查询与状态同步 Skill。用于查询 Meego issue 详情，或在 AI 自动化测试、缺陷修复并提交给 DEVX 后，将已修复的 Meego issue 标记为已完成/RESOLVED。遇到需要查询 issue、查看 issue 详情、关闭、完成、resolved、标记缺陷完成或同步 issue 状态时应使用本 skill。
  - 类型：skill
  - 来源：skills/aidev-issues/SKILL.md
- `@aidev-platform-pipeline` - 获取并整理 AIDEV 平台流水线执行详情。Use when Codex needs to call ai-dev-pro execution/detail by byteFlowExecutionID, inspect workflow node status, inspect ReActor output.steps status, summarize failures/running steps/checkpoints, or save a local markdown pipeline report in the workspace.
  - 类型：skill
  - 来源：skills/aidev-platform-pipeline/SKILL.md
- `@backend-tech-template` - 后端技术方案模板
  - 类型：skill
  - 来源：skills/backend-tech-template/SKILL.md
- `@bam` - BAM（ByteDance API Management）前端接口协作 Skill。在以下场景，必须使用此 Skill： - 代码改动涉及后端接口（如读取/更新接口信息、联调接口变更），且该接口由 BAM 维护。 - 代码改动涉及 BAM 相关文件（如 `bam.config.(json|js)`、通常包含 `bam` 字样的生成目录如 `bam-auto-generate/`、`namespaces/*.ts`、生成 API 导出与类型）。 - 需求或上下文出现 BAM 相关 URL 链接（前缀为 `https://cloud.bytedance.net/bam/`）。
  - 类型：skill
  - 来源：skills/bam/SKILL.md
- `@brainstorming` - You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation.
  - 类型：skill
  - 来源：skills/brainstorming/SKILL.md
- `@byted-package-doc` - 检索字节内部 npm 包（@ecom/@ecop/@bytedance/@byted 等）的文档与组件用法，并在给定 PRD/需求场景时辅助选择依赖：确认哪些包支持文档检索并返回组件列表；基于场景/组件名检索用法并输出 Markdown；在确需新增依赖时推荐候选 packages。
  - 类型：skill
  - 来源：skills/byted-package-doc/SKILL.md
- `@bytedance-meego` - Use when the user wants Meego/Meegle operations through bytedcli (`bytedcli meego ...`), needs bytedcli-compatible command names or output, or needs bytedcli OAuth/GoAPI-only capabilities. If the user explicitly asks to use `meegle` CLI directly, use the meegle CLI/skill instead.
  - 类型：skill
  - 来源：skills/bytedance-meego/SKILL.md
- `@bytedcli` - Unified DEVX/AIDEV skill for structured Codebase reads and fallback access through bytedcli. Honors an explicit user choice of Git or bytedcli; otherwise uses normal Git for repository transport and bytedcli for MR, issue, CI, review, file, and team-spec data. Covers auth/JWT/user info; Codebase repos, MR, issues, review, CI and files; Devflow tasks; Feishu/Lark messages, calendar, tasks, sheets and bitables; Lark Oncall; Lynx; Gecko CN; BitsAI and Tika; Insearch internal search and authenticated internal GET; RDS, ByteDoc, Hive, Dorado, Oceanus, Aeolus, DataQ, TQS and Forge; OneService; Fornax; Log, APM, Slardar, Cache, BMQ and RMQ; Libra; DKMS, KMS v2 and IAM; Cloud Docs and Overpass.
  - 类型：skill
  - 来源：skills/bytedcli/SKILL.md
- `@custom-workflow` - 通过对话创建或修改 DEVX 自定义研发流程（preset override）。当用户说"创建/新建研发流程""加一个工作流""在流程里加节点/加判断分支""把流程改成…"等意图时触发。负责把自然语言意图翻译成合法的 preset override JSON、落盘到激活 key 对应文件并打开画布回显，最终校验与保存由画布完成。
  - 类型：skill
  - 来源：skills/custom-workflow/SKILL.md
- `@frontend-design` - Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
  - 类型：skill
  - 来源：skills/frontend-design/SKILL.md
- `@lark-doc` - 飞书云文档（Docx / Wiki 文档，v2 API）：读取和编辑飞书文档内容。当用户给出文档 URL 或 token，或需要查看、创建、编辑文档、插入或下载文档图片附件时使用。文档中嵌入的电子表格、多维表格、画板，先用本 skill 提取 token 再切到对应 skill。当用户给出 doubao.com 的 /docx/ 或 /wiki/ URL/token 时，也应直接使用本 skill；路由依据是 URL 路径模式和 token，而不是域名。不负责文档评论管理，也不负责表格或 Base 的数据操作。
  - 类型：skill
  - 来源：skills/lark-doc/SKILL.md
- `@lark-sheets` - 飞书电子表格：创建和操作电子表格。支持创建表格、管理工作表与行列结构（增删/合并/调整尺寸/隐藏/冻结）、读写单元格（值/公式/样式/批注/单元格图片）、查找替换、多操作原子批量更新，以及图表、透视表、条件格式、筛选器、迷你图、浮动图片等对象的创建与维护。当用户需要创建电子表格、管理工作表、批量读写或编辑数据、统计汇总与可视化、表格美化、公式计算（含 Excel 公式迁移）等任务时使用。若用户是想按名称或关键词搜索云空间（云盘/云存储）里的表格文件，请改用 lark-drive 的 drive +search 先定位资源。当用户给出 doubao.com 的 /sheets/ URL/token 时，也应直接使用本 skill，不要因为域名不是飞书而回退到 WebFetch；路由依据是 URL 路径模式和 token，而不是域名。仅针对飞书在线电子表格，不适用于本地 Excel 文件。
  - 类型：skill
  - 来源：skills/lark-sheets/SKILL.md
- `@mindai-chart-generation` - 通过 MindAI 远程服务生成、调整、监听、下载和插入图表 SVG，并支持搜索和执行官网图表模板，适用于架构图、流程图、ER 图、泳道图、时序图、甘特图、漏斗图、里程碑、思维导图等图示需求；触发场景包括 generate architecture diagram、draw flowchart、mind map、Gantt、sequence diagram、画板、架构图、流程图、生成图、用模板画图、在文档里插图、把图嵌进飞书文档。支持基于已有 task_id 或 MindAI 会话继续处理，默认交付本地 SVG 与 MindAI 会话链接，仅在用户明确要求时导出新飞书文档，并在用户提供已有飞书/Lark 文档时插入生成图。本地侧仅作为 CLI 客户端，不实现图生成逻辑。
  - 类型：skill
  - 来源：skills/mindai-chart-generation/SKILL.md
- `@requirement-breakdown` - 需求拆解 Skill。用于拆解需求、解析 PRD、把 PRD 分成前后端功能点、识别影响范围，或分析飞书/Lark PRD URL。不用于没有 PRD 分析意图的通用实施计划。
  - 类型：skill
  - 来源：skills/requirement-breakdown/SKILL.md
- `@skill-creator` - Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, update or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
  - 类型：skill
  - 来源：skills/skill-creator/SKILL.md
- `@smart_retrieval` - 内部研发知识的一站式智能检索兜底能力。适用于依赖字节内部知识库的研发/业务通用问答，以及查询业务规则、历史技术方案、后端代码实现、接口出入参、服务/PSM、配置值、调用链、上下游依赖、数据库表、历史需求/Meego 和关联代码变更；已有上下文或本地代码、BAM、Lark、bytedcli 等专用工具可直接可靠回答时不调用。
  - 类型：skill
  - 来源：skills/smart_retrieval/SKILL.md
- `@test-agent-runner` - 执行自定义测试工作流。支持多种预定义模式（仅环境部署、仅CR、完整工作流、仅测试、CR+环境部署），也可传入自定义能力列表，支持原子能力任意排列组合。触发词：测试、执行工作流、运行工作流、部署环境、仅CR、仅环境部署。
  - 类型：skill
  - 来源：skills/test-agent-runner/SKILL.md
- `@using-superpowers` - Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
  - 类型：skill
  - 来源：skills/using-superpowers/SKILL.md
- `@web-tech-template` - Web 技术方案模板链接与使用规则
  - 类型：skill
  - 来源：skills/web-tech-template/SKILL.md
- `@writing-plans` - Use when you have a spec or requirements for a multi-step task, before touching code
  - 类型：skill
  - 来源：skills/writing-plans/SKILL.md

## SubAgents

- `@architect` - 多服务、多仓库、上下游链路分析 subagent。仅用于梳理服务调用关系和影响范围，不做最终技术方案。
  - 类型：subAgent
  - 来源：agents/architect.toml
- `@code-simplifier` - 代码精简审查 subagent。用于在代码修改后检查复杂度、重复和过度设计，在不改变行为的前提下做最小精简。
  - 类型：subAgent
  - 来源：agents/code-simplifier.toml
- `@deepwiki` - 仓库事实核实 subagent。用于现有实现定位、复用点查找、接口/模型/配置/调用链/技术栈证据确认，不做最终方案设计。
  - 类型：subAgent
  - 来源：agents/deepwiki.toml
- `@doc-generation` - 技术方案飞书文档写入 subagent。使用 DEVX 内置 lark-doc Skill 创建或更新同一份 Lark 文档并回读校验，不参与方案设计。
  - 类型：subAgent
  - 来源：agents/doc-generation.toml
- `@smart-retriever` - DEVX 智能检索只读 SubAgent。异步补充当前请求所需事实，未命中时返回正常空结果。
  - 类型：subAgent
  - 来源：agents/smart-retriever.toml
- `@tech-design-reviewer` - 后端技术方案只读评审 subagent。检查功能覆盖、证据充分性、技术逻辑、兼容边界和人工可读性，不直接改写方案。
  - 类型：subAgent
  - 来源：agents/tech-design-reviewer.toml
