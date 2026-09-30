import { W } from '../breakout/physics'
import type { AudioSettings } from '../breakout/audio'
import { MobileAudio } from './audio'
import { MobileGame, type GameSnapshot } from './game'
import { PaddleDrag, fitCanvas } from './input'
import { drawGame } from './render'
import { MobileSave } from './storage'

interface Elements {
  root: HTMLElement
  canvas: HTMLCanvasElement
  stage: HTMLElement
  controls: HTMLElement
}
interface Callbacks {
  update: (snapshot: GameSnapshot) => void
  landscape: (value: boolean) => void
  audioError: (message: string) => void
  dragged?: () => void
}

/** Mount once per visit; all global changes and resources have symmetric cleanup. */
export function mountMobileGame(
  elements: Elements,
  game: MobileGame,
  save: MobileSave,
  callbacks: Callbacks,
) {
  const { root, canvas, stage, controls } = elements
  const audio = new MobileAudio(save.data.audio, callbacks.audioError)
  const drag = new PaddleDrag()
  let raf: number | undefined
  let disposed = false
  let previousSnapshot = ''
  let landscape = false
  let sheetOpen = false
  let learnedDrag = false
  const orientation = window.matchMedia('(orientation: landscape)')

  const releaseDrag = (id?: number) => {
    const released = drag.end(id)
    if (released === null) return
    if (controls.hasPointerCapture(released)) controls.releasePointerCapture(released)
    controls.classList.remove('is-dragging')
  }
  const publish = () => {
    const snapshot = game.snapshot()
    const serialized = JSON.stringify([snapshot, save.data, save.error])
    if (serialized !== previousSnapshot) {
      previousSnapshot = serialized
      callbacks.update(snapshot)
    }
    controls.setAttribute('aria-valuenow', String(Math.round((game.paddleX / W) * 100)))
  }
  const draw = () => drawGame(canvas, game)
  const frame = (time: number) => {
    raf = undefined
    if (disposed) return
    game.frame(time)
    publish()
    draw()
    if (game.status === 'playing') raf = requestAnimationFrame(frame)
    else releaseDrag()
  }
  const refresh = () => {
    publish()
    draw()
    if (game.status === 'playing' && raf === undefined) raf = requestAnimationFrame(frame)
    if (game.status !== 'playing' && raf !== undefined) {
      cancelAnimationFrame(raf)
      raf = undefined
    }
  }
  const pause = (silent = false) => {
    releaseDrag()
    game.pause(silent)
    if (silent) audio.suspend()
    refresh()
  }
  const background = () => pause(true)
  const visibility = () => {
    if (document.hidden) background()
  }
  const orient = () => {
    landscape = orientation.matches
    callbacks.landscape(landscape)
    // Both directions clear input; turning upright never resumes automatically.
    if (landscape) pause(true)
    else releaseDrag()
  }

  const originalViewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  const viewport = originalViewport ?? document.createElement('meta')
  const oldContent = viewport.getAttribute('content')
  if (!originalViewport) {
    viewport.name = 'viewport'
    document.head.append(viewport)
  }
  viewport.content = `${(oldContent ?? 'width=device-width, initial-scale=1').replace(/,?\s*viewport-fit\s*=\s*[^,]+/g, '')}, viewport-fit=cover`
  const oldHtmlOverflow = document.documentElement.style.overflow
  const oldBodyOverflow = document.body.style.overflow
  const oldOverscroll = document.body.style.overscrollBehavior
  const scroll = { x: window.scrollX, y: window.scrollY }
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  document.body.style.overscrollBehavior = 'none'

  const viewportSize = () => {
    const visible = window.visualViewport
    // Respect accessibility zoom; do not resize the board to a pinch-zoomed viewport.
    if (!visible || visible.scale === 1) {
      root.style.setProperty('--bm-viewport-height', `${visible?.height ?? window.innerHeight}px`)
      root.style.setProperty('--bm-viewport-top', `${visible?.offsetTop ?? 0}px`)
    }
  }
  const resize = () => {
    releaseDrag()
    const size = fitCanvas(stage.clientWidth, stage.clientHeight)
    const scale = Math.min(2, window.devicePixelRatio || 1)
    const width = Math.max(1, Math.round(size.width * scale))
    const height = Math.max(1, Math.round(size.height * scale))
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`
    const boardTop = (stage.clientHeight - size.height) / 2
    root.style.setProperty('--bm-control-top', `${boardTop + size.height / 2}px`)
    root.style.setProperty('--bm-launch-top', `${boardTop + size.height * 0.38}px`)
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    draw()
  }
  const down = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      (event.target instanceof Element &&
        event.target.closest('button, a, input, select, textarea, dialog, [data-game-action]')) ||
      landscape ||
      sheetOpen ||
      (game.status !== 'ready' && game.status !== 'playing')
    )
      return
    if (
      drag.begin(event.pointerId, event.clientX, game.paddleX, canvas.getBoundingClientRect().width)
    ) {
      controls.setPointerCapture(event.pointerId)
      controls.classList.add('is-dragging')
    }
  }
  const move = (event: PointerEvent) => {
    const x = drag.move(event.pointerId, event.clientX, game.paddleWidth / 2)
    if (x === null) return
    if (x !== game.paddleX && !learnedDrag) {
      learnedDrag = true
      callbacks.dragged?.()
    }
    game.moveTo(x)
    refresh()
  }
  const up = (event: PointerEvent) => releaseDrag(event.pointerId)
  const keyboard = (event: KeyboardEvent) => {
    if (landscape || sheetOpen || (game.status !== 'ready' && game.status !== 'playing')) return
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const x =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? W
            : game.paddleX + (event.key === 'ArrowLeft' ? -16 : 16)
      game.moveTo(x)
      refresh()
    }
  }

  game.onSound = audio.play
  game.onStopSounds = audio.stopAll
  game.onSettlement = (lastPlayedLevel, bestScore) => save.update({ lastPlayedLevel, bestScore })
  controls.addEventListener('pointerdown', down)
  controls.addEventListener('pointermove', move)
  controls.addEventListener('pointerup', up)
  controls.addEventListener('pointercancel', up)
  controls.addEventListener('lostpointercapture', up)
  controls.addEventListener('keydown', keyboard)
  window.addEventListener('blur', background)
  window.addEventListener('pagehide', background)
  document.addEventListener('visibilitychange', visibility)
  orientation.addEventListener('change', orient)
  window.addEventListener('resize', viewportSize)
  window.visualViewport?.addEventListener('resize', viewportSize)
  window.visualViewport?.addEventListener('scroll', viewportSize)
  const observer = new ResizeObserver(resize)
  observer.observe(stage)
  viewportSize()
  orient()
  if (document.hidden) background()
  resize()
  refresh()

  return {
    launch() {
      if (!landscape && !sheetOpen) {
        audio.unlock()
        game.launch()
        refresh()
      }
    },
    resume() {
      if (!landscape && !sheetOpen) {
        audio.unlock()
        game.resume()
        refresh()
      }
    },
    pause,
    reset(level = game.level) {
      releaseDrag()
      game.reset(level)
      save.update({ lastPlayedLevel: game.level + 1 })
      if (sheetOpen || landscape) game.pause(true)
      refresh()
    },
    settings(open: boolean) {
      sheetOpen = open
      if (open) pause()
      else refresh()
    },
    audio(settings: AudioSettings) {
      save.update({ audio: settings })
      audio.setSettings(settings)
      refresh()
    },
    retryAudio() {
      audio.unlock()
    },
    destroy() {
      disposed = true
      if (raf !== undefined) cancelAnimationFrame(raf)
      releaseDrag()
      observer.disconnect()
      controls.removeEventListener('pointerdown', down)
      controls.removeEventListener('pointermove', move)
      controls.removeEventListener('pointerup', up)
      controls.removeEventListener('pointercancel', up)
      controls.removeEventListener('lostpointercapture', up)
      controls.removeEventListener('keydown', keyboard)
      window.removeEventListener('blur', background)
      window.removeEventListener('pagehide', background)
      document.removeEventListener('visibilitychange', visibility)
      orientation.removeEventListener('change', orient)
      window.removeEventListener('resize', viewportSize)
      window.visualViewport?.removeEventListener('resize', viewportSize)
      window.visualViewport?.removeEventListener('scroll', viewportSize)
      game.onSound = () => {}
      game.onStopSounds = () => {}
      game.onSettlement = () => {}
      audio.dispose()
      if (!originalViewport) viewport.remove()
      else if (oldContent === null) viewport.removeAttribute('content')
      else viewport.content = oldContent
      document.documentElement.style.overflow = oldHtmlOverflow
      document.body.style.overflow = oldBodyOverflow
      document.body.style.overscrollBehavior = oldOverscroll
      window.scrollTo(scroll.x, scroll.y)
    },
  }
}
