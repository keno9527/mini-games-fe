/** Tank 1990 风格的有限色表；菜单、HUD 与战斗共享玩家配色。 */
export const COLORS = {
  UI_BACKGROUND: '#747474',
  FIELD_BACKGROUND: '#000000',

  BRICK_MAIN: '#c84c0c',
  BRICK_MORTAR: '#747474',
  BRICK_DARK: '#a40000',

  STEEL_MAIN: '#bcbcbc',
  STEEL_LIGHT: '#fcfcfc',
  STEEL_DARK: '#747474',

  WATER_MAIN: '#2038ec',
  WATER_LIGHT: '#9cfcf0',

  TREE_MAIN: '#003c14',
  TREE_LIGHT: '#80d010',
  TREE_DARK: '#004400',

  ICE_MAIN: '#bcbcbc',
  ICE_LIGHT: '#fcfcfc',
  ICE_DARK: '#747474',

  PLAYER_BODY: '#fc9838',
  PLAYER_TREAD: '#887000',
  PLAYER_HIGHLIGHT: '#fce4a0',

  ENEMY_BODY: '#bcbcbc',
  ENEMY_TREAD: '#183c5c',
  ENEMY_HIGHLIGHT: '#fcfcfc',

  BULLET: '#fcfcfc',
  BASE_EAGLE: '#747474',
  BASE_DETAIL: '#a40000',
  BASE_DESTROYED: '#747474',

  SHIELD_OUTER: '#fcfcfc',
  SHIELD_INNER: '#183c5c',

  EXPLOSION_CORE: '#fcfcfc',
  EXPLOSION_MID: '#fcbcb0',
  EXPLOSION_OUTER: '#d82800',

  TEXT_PRIMARY: '#fcfcfc',
  TEXT_DIM: '#000000',
  TEXT_HIGHLIGHT: '#fce4a0',
} as const

export interface TankPalette {
  readonly body: string
  readonly tread: string
  readonly highlight: string
}

export const PLAYER_PALETTES: readonly TankPalette[] = [
  { body: COLORS.PLAYER_BODY, tread: COLORS.PLAYER_TREAD, highlight: COLORS.PLAYER_HIGHLIGHT },
  { body: '#80d010', tread: '#005800', highlight: '#b8f818' },
]

/** 从一发到四发装甲；仍通过换色反馈受损，避免额外亮点改变车体图案。 */
export const ARMOR_PALETTES: readonly TankPalette[] = [
  { body: COLORS.ENEMY_BODY, tread: COLORS.ENEMY_TREAD, highlight: COLORS.ENEMY_HIGHLIGHT },
  { body: '#fc9838', tread: '#a40000', highlight: '#fce4a0' },
  { body: '#80d010', tread: '#005800', highlight: '#fce4a0' },
  { body: '#80d010', tread: '#005800', highlight: '#b8f818' },
]

/** 道具的平面白色符号与深蓝底，不使用立体阴影边框。 */
export const POWERUP_PALETTE: Readonly<Record<string, string>> = {
  B: '#183c5c',
  W: '#fcfcfc',
  '1': '#fcfcfc',
  '2': '#183c5c',
}
