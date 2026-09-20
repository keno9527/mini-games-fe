/** 全局配色。集中定义便于统一调整像素风格。 */
export const COLORS = {
  /** 战场外的背景（信息栏底色） */
  UI_BACKGROUND: '#747474',
  /** 战场底色 */
  FIELD_BACKGROUND: '#000000',

  BRICK_MAIN: '#a85400',
  BRICK_LIGHT: '#f8a050',
  BRICK_DARK: '#747474',

  STEEL_MAIN: '#bcbcbc',
  STEEL_LIGHT: '#fcfcfc',
  STEEL_DARK: '#747474',

  WATER_MAIN: '#2038ec',
  WATER_LIGHT: '#5c94fc',

  TREE_MAIN: '#005800',
  TREE_LIGHT: '#80d010',

  ICE_MAIN: '#bcbcbc',
  ICE_LIGHT: '#fcfcfc',

  /** 玩家坦克配色：车身 / 履带暗色 / 高光 */
  PLAYER_BODY: '#e4c490',
  PLAYER_TREAD: '#a08000',
  PLAYER_HIGHLIGHT: '#fcfcfc',

  /** 玩家满星形态（更亮的金色） */
  PLAYER_BODY_MAX: '#f0d040',
  PLAYER_HIGHLIGHT_MAX: '#fff8c0',

  ENEMY_BASIC_BODY: '#c8c8c8',
  ENEMY_BASIC_TREAD: '#7c7c7c',
  ENEMY_BASIC_HIGHLIGHT: '#f0f0f0',

  ENEMY_FAST_BODY: '#f0f0f0',
  ENEMY_FAST_TREAD: '#9c9c9c',
  ENEMY_FAST_HIGHLIGHT: '#ffffff',

  ENEMY_POWER_BODY: '#bcbcbc',
  ENEMY_POWER_TREAD: '#747474',
  ENEMY_POWER_HIGHLIGHT: '#fcfcfc',

  /** 重甲坦克按剩余装甲变色 */
  ENEMY_ARMOR_BODY: ['#c85028', '#c8a028', '#5c9c3c', '#b8b8b8'] as const,
  ENEMY_ARMOR_TREAD: '#5c3018',
  ENEMY_ARMOR_HIGHLIGHT: '#ffd8a0',

  BULLET: '#e8e8e8',

  BASE_EAGLE: '#bcbcbc',
  BASE_DESTROYED: '#747474',

  SHIELD_OUTER: '#7cd8f0',
  SHIELD_INNER: '#ffffff',

  EXPLOSION_CORE: '#fff4c0',
  EXPLOSION_MID: '#f09028',
  EXPLOSION_OUTER: '#c84018',

  TEXT_PRIMARY: '#ffffff',
  TEXT_DIM: '#000000',
  TEXT_HIGHLIGHT: '#f0d040',
} as const

/** 与 Canvas 和指南 SVG 共用的道具色表。 */
export const POWERUP_PALETTE: Readonly<Record<string, string>> = {
  B: '#203858',
  W: '#fcfcfc',
  S: '#bcbcbc',
  D: '#747474',
  '1': '#fcfcfc',
  '2': '#203858',
  '3': '#bcbcbc',
}
