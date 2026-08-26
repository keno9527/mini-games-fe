/** 全局配色。集中定义便于统一调整像素风格。 */
export const COLORS = {
  /** 战场外的背景（信息栏底色） */
  UI_BACKGROUND: '#6b6b6b',
  /** 战场底色 */
  FIELD_BACKGROUND: '#000000',

  BRICK_MAIN: '#a0522d',
  BRICK_LIGHT: '#d2833f',
  BRICK_DARK: '#6b3410',

  STEEL_MAIN: '#9c9c9c',
  STEEL_LIGHT: '#e4e4e4',
  STEEL_DARK: '#585858',

  WATER_MAIN: '#1b4fa0',
  WATER_LIGHT: '#4a86d8',

  TREE_MAIN: '#1f7a1f',
  TREE_LIGHT: '#3cb043',

  ICE_MAIN: '#b8d8e8',
  ICE_LIGHT: '#e8f4fa',

  /** 玩家坦克配色：车身 / 履带暗色 / 高光 */
  PLAYER_BODY: '#d8b83c',
  PLAYER_TREAD: '#8c6d1f',
  PLAYER_HIGHLIGHT: '#f4e58c',

  /** 玩家满星形态（更亮的金色） */
  PLAYER_BODY_MAX: '#f0d040',
  PLAYER_HIGHLIGHT_MAX: '#fff8c0',

  ENEMY_BASIC_BODY: '#c8c8c8',
  ENEMY_BASIC_TREAD: '#7c7c7c',
  ENEMY_BASIC_HIGHLIGHT: '#f0f0f0',

  ENEMY_FAST_BODY: '#f0f0f0',
  ENEMY_FAST_TREAD: '#9c9c9c',
  ENEMY_FAST_HIGHLIGHT: '#ffffff',

  ENEMY_POWER_BODY: '#4a9c4a',
  ENEMY_POWER_TREAD: '#2c5c2c',
  ENEMY_POWER_HIGHLIGHT: '#8ce08c',

  /** 重甲坦克按剩余装甲变色 */
  ENEMY_ARMOR_BODY: ['#c85028', '#c8a028', '#5c9c3c', '#b8b8b8'] as const,
  ENEMY_ARMOR_TREAD: '#5c3018',
  ENEMY_ARMOR_HIGHLIGHT: '#ffd8a0',

  BULLET: '#e8e8e8',

  BASE_EAGLE: '#d8b83c',
  BASE_DESTROYED: '#7c7c7c',

  SHIELD_OUTER: '#7cd8f0',
  SHIELD_INNER: '#ffffff',

  EXPLOSION_CORE: '#fff4c0',
  EXPLOSION_MID: '#f09028',
  EXPLOSION_OUTER: '#c84018',

  POWERUP_FRAME: '#e8e8e8',
  POWERUP_ICON: '#d84028',
  POWERUP_ICON_ALT: '#f0d040',

  TEXT_PRIMARY: '#ffffff',
  TEXT_DIM: '#000000',
  TEXT_HIGHLIGHT: '#f0d040',
} as const;
