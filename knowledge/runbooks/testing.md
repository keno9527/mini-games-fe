# 测试

## 测试框架

- 使用 Node 内置测试运行器 `node:test` + `node:assert/strict`。
- 通过 `tsx` 直接运行 TypeScript 测试文件，无需单独编译。
- 测试文件位于 `tests/` 目录，命名 `*.test.ts`。

## 运行测试

```bash
npm test
```

该命令执行 `tsx --test tests/*.test.ts`，匹配全部测试文件。

运行单个测试文件：

```bash
npx tsx --test tests/tower-defense.test.ts
```

## 现有测试

| 文件 | 覆盖范围 |
|------|----------|
| `tests/game-modules.test.ts` | 游戏注册表契约：每个内部游戏都有 manifest、懒加载组件、presentation；tank-battle 运行时挂载/销毁资源释放 |
| `tests/game-progression.test.ts` | 引力墓场成长存档：按 gameId 隔离、去重、损坏数据安全回退 |
| `tests/gravity-graveyard.test.ts` | 引力物理引擎：牵引/斥力、对消、速度上限、轨迹预测不修改原对象、RunState 事件流转 |
| `tests/tower-defense.test.ts` | 塔防引擎：建塔校验、波次刷怪、索敌击杀奖励、冰冻/范围伤害、升级出售、通关/失败判定 |

## 编写测试的约定

1. **纯逻辑优先**：测试覆盖游戏引擎中的纯函数（如 `stepGame`、`applyRunEvent`、`integrateBody`、`aiMove`），这些不依赖 DOM，可直接在 Node 中运行。
2. **不依赖浏览器 API**：若被测代码间接用到 `window`/`document`/`requestAnimationFrame`，在测试中用 `Object.defineProperty(globalThis, ...)` 注入最小 mock（参考 `game-modules.test.ts` 中 tank-battle runtime 的测试）。
3. **import 带 `.ts` 后缀**：与项目 `verbatimModuleSyntax` + `allowImportingTsExtensions` 配置保持一致。

## 实测参数示例

### 运行全部测试

```bash
npm test 2>&1 | grep -E "^(ok|not ok|# (tests|pass|fail))"
```

输出示例：

```
# tests 22
# pass 18
# fail 4
```

> 注意：当前 `tower-defense.test.ts` 中存在 4 个与建塔/波次/升级逻辑相关的已知失败（测试断言与引擎实现不同步），修复前需先核对引擎当前行为是否为预期。

### 类型检查（独立于测试）

```bash
npx tsc --noEmit
```

零输出即通过。建议在 `npm test` 前后各跑一次。
