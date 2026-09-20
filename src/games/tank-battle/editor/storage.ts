import { parseMap, type CustomMap } from './maps.ts'

export const MAPS_KEY = 'mini-games-tank-maps-v1'
export const DRAFT_KEY = 'mini-games-tank-draft-v1'
const MAX_MAPS = 100
type MapStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadMaps(storage: MapStorage = localStorage): CustomMap[] {
  const raw = storage.getItem(MAPS_KEY)
  if (raw === null) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('地图列表损坏，已保留原数据。请导出本地备份后再处理。')
  }
  if (!Array.isArray(data) || data.length > MAX_MAPS)
    throw new Error('地图列表格式不正确，已保留原数据。')
  const maps = data.map((value) => parseMap(value, true))
  if (new Set(maps.map((map) => map.id)).size !== maps.length)
    throw new Error('地图 ID 重复，已保留原数据。')
  return maps
}
export function saveMap(map: CustomMap, storage: MapStorage = localStorage): CustomMap {
  const next = parseMap({ ...map, updatedAt: new Date().toISOString() }, true)
  const maps = loadMaps(storage)
  const index = maps.findIndex((item) => item.id === next.id)
  if (index < 0) {
    if (maps.length >= MAX_MAPS)
      throw new Error('最多保存 100 张地图，请先导出并删除不需要的地图。')
    maps.unshift(next)
  } else maps[index] = next
  storage.setItem(MAPS_KEY, JSON.stringify(maps))
  return next
}
export function deleteMap(id: string, storage: MapStorage = localStorage): void {
  storage.setItem(MAPS_KEY, JSON.stringify(loadMaps(storage).filter((map) => map.id !== id)))
}
export function loadDraft(storage: MapStorage = localStorage): CustomMap | null {
  const raw = storage.getItem(DRAFT_KEY)
  if (raw === null) return null
  try {
    return parseMap(JSON.parse(raw), true, true)
  } catch {
    throw new Error('上次草稿无法读取。原数据已保留，可先导出本地备份。')
  }
}
export function saveDraft(map: CustomMap, storage: MapStorage = localStorage): void {
  storage.setItem(DRAFT_KEY, JSON.stringify(parseMap(map, true, true)))
}
export function storageError(error: unknown): string {
  if (error instanceof DOMException)
    return '浏览器存储不可用或空间不足，内容仍在当前画板中，请导出地图备份。'
  return error instanceof Error ? error.message : '保存失败，请导出地图备份。'
}
