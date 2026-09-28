/** One record per level attempt, while the HUD keeps its cumulative score. */
export class LevelSettlement {
  private levelIndex = 0
  private startScore = 0
  private startTicks = 0
  private submitted = false

  begin(levelIndex: number, score = 0, ticks = 0) {
    this.levelIndex = levelIndex
    this.startScore = score
    this.startTicks = ticks
    this.submitted = false
  }

  finish(result: 'win' | 'lose', score: number, ticks: number, totalLevels: number) {
    if (this.submitted) return null
    this.submitted = true
    const level = this.levelIndex + 1
    const resumeLevel = result === 'win' ? Math.min(level + 1, totalLevels) : level
    return {
      score: Math.max(0, score - this.startScore),
      duration: Math.max(1, Math.floor((ticks - this.startTicks) / 60)),
      result,
      level,
      progress: {
        highestUnlockedLevel: resumeLevel,
        lastPlayedLevel: resumeLevel,
      },
    }
  }
}
