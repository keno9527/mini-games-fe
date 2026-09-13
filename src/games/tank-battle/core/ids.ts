/**
 * 实体 ID 生成器。
 *
 * 计数器为模块作用域的私有状态，仅通过函数暴露 —— 不直接导出可变变量。
 */
let counter = 0

/** 生成全局唯一的实体 ID */
export function nextEntityId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

/** 重置计数器。仅供测试使用。 */
export function resetEntityIds(): void {
  counter = 0
}
