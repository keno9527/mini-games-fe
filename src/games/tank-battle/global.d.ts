/** 浏览器环境的补充类型声明 */

declare global {
  interface Window {
    /** Safari 旧版前缀实现 */
    webkitAudioContext?: typeof AudioContext
  }
}

export {}
