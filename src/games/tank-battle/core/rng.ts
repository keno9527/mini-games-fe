/**
 * 可种子化的伪随机数生成器（mulberry32）。
 *
 * 使用自有实现而非 Math.random()，是为了让敌方 AI 与道具掉落可复现，
 * 便于对战场逻辑做确定性单测。
 */
export class Rng {
  private state: number

  constructor(seed: number) {
    // 保证初始状态为非零的 32 位无符号整数
    this.state = seed >>> 0 || 0x9e3779b9
  }

  /** 返回 [0, 1) 区间的浮点数 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** 返回 [0, maxExclusive) 区间的整数 */
  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      return 0
    }
    return Math.floor(this.next() * maxExclusive)
  }

  /** 以给定概率返回 true */
  chance(probability: number): boolean {
    return this.next() < probability
  }

  /** 从数组中等概率取一个元素；空数组返回 undefined */
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) {
      return undefined
    }
    return items[this.nextInt(items.length)]
  }

  /**
   * 按权重取索引。weights 必须与候选项等长且非负。
   * 全零权重时退化为等概率。
   */
  pickWeightedIndex(weights: readonly number[]): number {
    let total = 0
    for (const weight of weights) {
      total += Math.max(0, weight)
    }
    if (total <= 0) {
      return this.nextInt(weights.length)
    }

    let threshold = this.next() * total
    for (let index = 0; index < weights.length; index += 1) {
      threshold -= Math.max(0, weights[index])
      if (threshold <= 0) {
        return index
      }
    }
    return weights.length - 1
  }
}
