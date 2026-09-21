import { useEffect, useMemo, useRef, useState } from 'react'
import { LEVELS } from '@/games/tank-battle/data/levels.ts'
import {
  createMap,
  exportMap,
  importMap,
  mapWarnings,
  MAX_IMPORT_BYTES,
  parseMap,
  validateLevel,
  WAVE_PRESETS,
  type CustomMap,
} from './maps.ts'
import {
  deleteMap,
  DRAFT_KEY,
  loadDraft,
  loadMaps,
  MAPS_KEY,
  saveDraft,
  saveMap,
  storageError,
} from './storage.ts'
import { MapBoard, MapPreview, TileSwatch } from './MapBoard.tsx'

interface Confirmation {
  message: string
  action: () => void
}
function ConfirmDialog({
  pending,
  onClose,
}: {
  pending: Confirmation | null
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (pending) dialog.current?.showModal()
    else dialog.current?.close()
  }, [pending])
  return (
    <dialog
      ref={dialog}
      className="tank-editor-dialog"
      aria-label="确认地图操作"
      onCancel={onClose}
    >
      <p>{pending?.message}</p>
      <div className="tank-editor-actions">
        <button autoFocus onClick={onClose}>
          取消
        </button>
        <button
          className="tank-editor-primary"
          onClick={() => {
            const action = pending?.action
            onClose()
            action?.()
          }}
        >
          确认继续
        </button>
      </div>
    </dialog>
  )
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function backupLocalData() {
  download(
    'tank-maps-backup.json',
    JSON.stringify(
      { maps: localStorage.getItem(MAPS_KEY), draft: localStorage.getItem(DRAFT_KEY) },
      null,
      2,
    ),
  )
}
function downloadMap(map: CustomMap) {
  download(`${map.name.replace(/[\\/:*?"<>|]/g, '_') || 'tank-map'}.json`, exportMap(map))
}
function ImportButton({
  onImport,
  onError,
}: {
  onImport: (map: CustomMap) => void
  onError: (error: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" onClick={() => input.current?.click()}>
        导入地图
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        aria-label="选择地图 JSON 文件"
        hidden
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          try {
            if (file.size > MAX_IMPORT_BYTES) throw new Error('地图文件不能超过 64 KB。')
            onImport(importMap(await file.text()))
          } catch (error) {
            onError(storageError(error))
          }
        }}
      />
    </>
  )
}
const BRUSHES = [
  { tile: '#', label: '砖墙' },
  { tile: '@', label: '钢墙' },
  { tile: '~', label: '水面' },
  { tile: '*', label: '草丛' },
  { tile: '%', label: '冰面' },
  { tile: '.', label: '橡皮擦' },
]
const SHAPES = [
  { value: 'full', label: '整格' },
  { value: 'top', label: '上半' },
  { value: 'bottom', label: '下半' },
  { value: 'left', label: '左半' },
  { value: 'right', label: '右半' },
] as const
type Shape = (typeof SHAPES)[number]['value']
const WALL_BRUSHES: Record<string, Record<Shape, string>> = {
  '#': { full: '#', top: '^', bottom: 'v', left: '<', right: '>' },
  '@': { full: '@', top: 't', bottom: 'b', left: 'l', right: 'r' },
}

interface EditorProps {
  initialMap?: CustomMap
  active: boolean
  onPlay: (map: CustomMap) => void
  onBack: () => void
  onLibrary: () => void
}
export function MapEditor({ initialMap, active, onPlay, onBack, onLibrary }: EditorProps) {
  const [pending, setPending] = useState<Confirmation | null>(null)
  const [initial] = useState(() => {
    try {
      return { map: initialMap ?? loadDraft() ?? createMap(), error: '' }
    } catch (error) {
      return { map: createMap(), error: storageError(error) }
    }
  })
  const [map, setMap] = useState(initial.map)
  const mapRef = useRef(map)
  const beforeStroke = useRef<CustomMap | null>(null)
  const [past, setPast] = useState<CustomMap[]>([])
  const [future, setFuture] = useState<CustomMap[]>([])
  const [material, setMaterial] = useState('#')
  const [shape, setShape] = useState<Shape>('full')
  const [template, setTemplate] = useState('blank')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(initial.error)
  const [draftStatus, setDraftStatus] = useState('')
  const [canWriteDraft, setCanWriteDraft] = useState(!initial.error)
  const [showChecks, setShowChecks] = useState(false)
  const [confirmPlay, setConfirmPlay] = useState(false)
  const [savedStamp, setSavedStamp] = useState(initialMap ? JSON.stringify(initialMap) : '')
  const brush = WALL_BRUSHES[material]?.[shape] ?? material
  const issues = useMemo(() => validateLevel(map), [map])
  const warnings = useMemo(() => mapWarnings(map), [map])
  const wave =
    Object.entries(WAVE_PRESETS).find(
      ([, value]) => value.queue.join() === map.enemyQueue.join(),
    )?.[0] ?? 'original'

  const update = (next: CustomMap) => {
    mapRef.current = next
    setMap(next)
    setConfirmPlay(false)
    setNotice('')
  }
  const remember = (previous: CustomMap) => {
    setPast((items) => [...items.slice(-49), previous])
    setFuture([])
  }
  const commit = (next: CustomMap) => {
    remember(mapRef.current)
    update(next)
  }
  useEffect(() => {
    if (!canWriteDraft) return
    try {
      saveDraft(map)
      setDraftStatus('草稿已自动保存到本机')
    } catch (failure) {
      setDraftStatus(storageError(failure))
    }
  }, [map, canWriteDraft])
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      // 配额耗尽、隐私模式或草稿损坏时，离开前提醒仍在内存中的修改。
      if (!canWriteDraft || !draftStatus.startsWith('草稿已')) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [canWriteDraft, draftStatus])
  const leave = (action: () => void) => {
    if (canWriteDraft && draftStatus.startsWith('草稿已')) action()
    else
      setPending({
        message: '草稿尚未保存到本机，离开会丢失当前修改。建议先导出地图。仍要离开吗？',
        action,
      })
  }
  const replaceDraft = (next: CustomMap) => {
    setPending({
      message: '替换当前草稿？已保存到“我的地图”的内容不受影响。',
      action: () => {
        update(next)
        setPast([])
        setFuture([])
        setCanWriteDraft(true)
        setError('')
        setShowChecks(false)
      },
    })
  }
  const save = (copy: boolean) => {
    try {
      const next = saveMap({
        ...mapRef.current,
        id: copy ? crypto.randomUUID() : mapRef.current.id,
        name: copy ? `${mapRef.current.name.slice(0, 35)} · 副本` : mapRef.current.name,
      })
      update(next)
      if (copy) {
        setPast([])
        setFuture([])
      }
      setSavedStamp(JSON.stringify(next))
      setError('')
      setNotice(copy ? '副本已保存到“我的地图”。' : '地图已保存到“我的地图”。')
    } catch (failure) {
      setError(storageError(failure))
    }
  }
  const play = () => {
    try {
      const valid = parseMap(mapRef.current, true)
      setError('')
      setShowChecks(true)
      if (warnings.length) {
        setConfirmPlay(true)
        return
      }
      onPlay(valid)
    } catch (failure) {
      setError(storageError(failure))
    }
  }
  return (
    <section className="tank-editor-shell">
      <ConfirmDialog pending={pending} onClose={() => setPending(null)} />
      <header className="tank-editor-header">
        <div>
          <span className="tank-eyebrow">CONSTRUCTION · 地图工坊</span>
          <h2>设计你的防线</h2>
          <p>铺设地形，守护老鹰。画完即可试玩。</p>
        </div>
        <div className="tank-editor-actions">
          <button
            onClick={() => {
              leave(onBack)
            }}
          >
            返回游戏
          </button>
          <button
            onClick={() => {
              leave(onLibrary)
            }}
          >
            我的地图
          </button>
        </div>
      </header>
      <div className="tank-editor-meta">
        <label>
          地图名称
          <input
            value={map.name}
            maxLength={40}
            onChange={(event) => update({ ...mapRef.current, name: event.target.value })}
            placeholder="给地图起个名字"
          />
        </label>
        <label>
          敌军编队
          <select
            value={wave}
            onChange={(event) =>
              commit({
                ...mapRef.current,
                enemyQueue: [
                  ...WAVE_PRESETS[event.target.value as keyof typeof WAVE_PRESETS].queue,
                ],
              })
            }
          >
            {wave === 'original' && (
              <option value="original" disabled>
                沿用原地图编队
              </option>
            )}
            {Object.entries(WAVE_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <span className="tank-editor-count">20 辆敌军 · 3 条生命</span>
      </div>
      <div className="tank-editor-layout">
        <div className="tank-editor-workspace">
          <div className="tank-editor-actions tank-editor-history">
            <button
              disabled={!past.length}
              onClick={() => {
                const previous = past[past.length - 1]
                const current = mapRef.current
                setPast(past.slice(0, -1))
                setFuture((items) => [...items, current])
                update(previous)
              }}
            >
              撤销
            </button>
            <button
              disabled={!future.length}
              onClick={() => {
                const next = future[future.length - 1]
                const current = mapRef.current
                setFuture(future.slice(0, -1))
                setPast((items) => [...items, current])
                update(next)
              }}
            >
              重做
            </button>
            <button
              onClick={() => {
                setPending({
                  message: '清空所有可编辑地形？可以撤销。',
                  action: () => commit({ ...mapRef.current, terrain: createMap().terrain }),
                })
              }}
            >
              清空地形
            </button>
          </div>
          <MapBoard
            terrain={map.terrain}
            brush={brush}
            active={active}
            onBegin={() => {
              beforeStroke.current = mapRef.current
            }}
            onPaint={(terrain) => update({ ...mapRef.current, terrain })}
            onEnd={() => {
              const before = beforeStroke.current
              beforeStroke.current = null
              if (before && before.terrain.join() !== mapRef.current.terrain.join())
                remember(before)
            }}
          />
        </div>
        <aside className="tank-editor-tools">
          <h3>地形笔刷</h3>
          <div className="tank-editor-brushes">
            {BRUSHES.map((item) => (
              <button
                key={item.tile}
                aria-pressed={material === item.tile}
                onClick={() => setMaterial(item.tile)}
              >
                <TileSwatch tile={item.tile} />
                {item.label}
              </button>
            ))}
          </div>
          {(material === '#' || material === '@') && (
            <fieldset className="tank-editor-shapes">
              <legend>墙体形状</legend>
              {SHAPES.map((item) => (
                <button
                  key={item.value}
                  aria-pressed={shape === item.value}
                  onClick={() => setShape(item.value)}
                >
                  <TileSwatch tile={WALL_BRUSHES[material][item.value]} />
                  {item.label}
                </button>
              ))}
            </fieldset>
          )}
          <div className="tank-editor-template">
            <label>
              从模板新建
              <select value={template} onChange={(event) => setTemplate(event.target.value)}>
                <option value="blank">空白地图</option>
                {LEVELS.map((_, i) => (
                  <option key={i} value={i}>
                    经典第 {i + 1} 关
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() =>
                replaceDraft(createMap(template === 'blank' ? undefined : Number(template)))
              }
            >
              创建新草稿
            </button>
            <small>经典地图会复制为独立草稿，固定区域自动保留。</small>
          </div>
        </aside>
      </div>
      <div className="tank-editor-footer">
        <div className="tank-editor-actions">
          <button onClick={() => save(false)}>保存地图</button>
          <button onClick={() => save(true)}>另存副本</button>
          <button
            onClick={() => {
              try {
                downloadMap(mapRef.current)
                setError('')
              } catch (failure) {
                setError(storageError(failure))
              }
            }}
          >
            导出地图
          </button>
          <ImportButton onImport={replaceDraft} onError={setError} />
          <button
            onClick={() => {
              setShowChecks(true)
              setNotice(issues.length || warnings.length ? '' : '检查通过，可以试玩。')
            }}
          >
            检查地图
          </button>
          <button className="tank-editor-primary" onClick={play}>
            试玩地图
          </button>
        </div>
        <p className="tank-editor-save-status" role="status">
          {draftStatus} ·{' '}
          {JSON.stringify(map) === savedStamp ? '已保存至我的地图' : '有修改尚未保存至我的地图'}
        </p>
      </div>
      {notice && (
        <p className="tank-editor-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="tank-editor-error" role="alert">
          {error}
          <button
            onClick={() => {
              try {
                backupLocalData()
              } catch (failure) {
                setError(storageError(failure))
              }
            }}
          >
            导出本地备份
          </button>
        </div>
      )}
      {showChecks && (
        <div className="tank-editor-checks">
          <h3>地图检查</h3>
          {issues.map((issue, i) => (
            <p className="tank-editor-error" key={`e${i}`}>
              {issue.message}
            </p>
          ))}
          {warnings.map((issue, i) => (
            <p key={i}>⚠ {issue.message}</p>
          ))}
          {!issues.length && !warnings.length && <p>地图格式正确，出生点出口可通行。</p>}
          <small>检查不能保证一定通关；砖墙可破坏，钢墙可能需要升级。</small>
          {confirmPlay && (
            <button
              className="tank-editor-primary"
              onClick={() => onPlay(parseMap(mapRef.current, true))}
            >
              仍然试玩
            </button>
          )}
        </div>
      )}
    </section>
  )
}

interface LibraryProps {
  onEdit: (map?: CustomMap) => void
  onPlay: (map: CustomMap) => void
  onBack: () => void
}
export function MapLibrary({ onEdit, onPlay, onBack }: LibraryProps) {
  const [pending, setPending] = useState<Confirmation | null>(null)
  const [initial] = useState(() => {
    try {
      return { maps: loadMaps(), error: '' }
    } catch (error) {
      return { maps: [], error: storageError(error) }
    }
  })
  const [maps, setMaps] = useState(initial.maps)
  const [error, setError] = useState(initial.error)
  const [notice, setNotice] = useState('')
  const act = (operation: () => void) => {
    try {
      operation()
      setMaps(loadMaps())
      setError('')
    } catch (failure) {
      setError(storageError(failure))
    }
  }
  const edit = (map?: CustomMap) => {
    try {
      const draft = loadDraft()
      if (map && draft && JSON.stringify(map) !== JSON.stringify(draft)) {
        setPending({
          message: '打开此地图将替换当前自动保存草稿。继续吗？',
          action: () => onEdit(map),
        })
      } else onEdit(map)
    } catch (failure) {
      setError(storageError(failure))
    }
  }
  return (
    <section className="tank-editor-shell">
      <ConfirmDialog pending={pending} onClose={() => setPending(null)} />
      <header className="tank-editor-header">
        <div>
          <span className="tank-eyebrow">MY MAPS · 本机收藏</span>
          <h2>我的地图</h2>
          <p>地图保存在当前浏览器，导出文件可备份或分享给朋友。</p>
        </div>
        <div className="tank-editor-actions">
          <button onClick={onBack}>返回游戏</button>
          <button onClick={() => edit()}>继续编辑草稿</button>
          <ImportButton
            onError={setError}
            onImport={(map) =>
              act(() => {
                saveMap(map)
                setNotice('导入成功，已保存为独立地图。')
              })
            }
          />
        </div>
      </header>
      {error && (
        <div className="tank-editor-error" role="alert">
          {error}
          <button
            onClick={() => {
              try {
                backupLocalData()
              } catch (failure) {
                setError(storageError(failure))
              }
            }}
          >
            导出本地备份
          </button>
          <button onClick={() => act(() => {})}>重新读取</button>
        </div>
      )}
      {notice && (
        <p role="status" className="tank-editor-notice">
          {notice}
        </p>
      )}
      {!maps.length && !error && (
        <div className="tank-editor-empty">
          <h3>第一张地图，从这里开始</h3>
          <p>从空白画板开始，或复制经典关卡设计自己的防线。</p>
          <button className="tank-editor-primary" onClick={() => edit()}>
            打开地图编辑器
          </button>
        </div>
      )}
      <div className="tank-map-library">
        {maps.map((map) => (
          <article className="tank-map-card" key={map.id}>
            <MapPreview terrain={map.terrain} label={`${map.name}缩略图`} />
            <h3>{map.name}</h3>
            <p>更新于 {new Date(map.updatedAt).toLocaleString('zh-CN')}</p>
            <div className="tank-editor-actions">
              <button className="tank-editor-primary" onClick={() => onPlay(map)}>
                开始游戏
              </button>
              <button onClick={() => edit(map)}>编辑</button>
              <button
                onClick={() =>
                  act(() => {
                    saveMap({
                      ...map,
                      id: crypto.randomUUID(),
                      name: `${map.name.slice(0, 35)} · 副本`,
                    })
                  })
                }
              >
                复制
              </button>
              <button
                onClick={() => {
                  try {
                    downloadMap(map)
                  } catch (failure) {
                    setError(storageError(failure))
                  }
                }}
              >
                导出
              </button>
              <button
                onClick={() => {
                  setPending({
                    message: `删除“${map.name}”？建议先导出备份。`,
                    action: () => act(() => deleteMap(map.id)),
                  })
                }}
              >
                删除
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
