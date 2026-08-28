import test from 'node:test'
import assert from 'node:assert/strict'
import type { ReactNode, ReactElement } from 'react'
import { Link } from 'react-router-dom'
import type { GameRuntime } from '../src/games/manifest.ts'

type GameLaunchLinkComponent = (props: {
  gameId: string
  className?: string
  children: ReactNode
}) => ReactElement

type GameLaunchLinkRenderer = (
  props: Parameters<GameLaunchLinkComponent>[0] & { runtime?: GameRuntime },
) => ReactElement

async function loadGameLaunchLink() {
  return (await import('../src/components/GameLaunchLink.tsx')) as {
    default: GameLaunchLinkComponent
    GameLaunchLinkView: GameLaunchLinkRenderer
  }
}

test('embedded runtime renders an internal router game link', async () => {
  const { default: GameLaunchLink, GameLaunchLinkView } = await loadGameLaunchLink()

  const wrapper = GameLaunchLink({
    gameId: 'snake',
    className: 'launch-link',
    children: '开始游戏',
  })
  const element = GameLaunchLinkView(wrapper.props)

  assert.equal(wrapper.type, GameLaunchLinkView)
  assert.equal(element.type, Link)
  assert.equal(element.props.to, '/game/snake')
  assert.equal(element.props.className, 'launch-link')
  assert.equal(element.props.children, '开始游戏')
})

test('external runtime renders a secure new-tab link', async () => {
  const { GameLaunchLinkView } = await loadGameLaunchLink()
  const element = GameLaunchLinkView({
    gameId: 'external-fixture',
    className: 'launch-link',
    children: '打开外部游戏',
    runtime: {
      kind: 'external',
      href: 'https://example.com/game',
      openIn: 'new-tab',
    },
  })

  assert.equal(element.type, 'a')
  assert.equal(element.props.href, 'https://example.com/game')
  assert.equal(element.props.target, '_blank')
  assert.equal(element.props.rel, 'noreferrer')
})

test('retired game history remains visible without an invalid detail link', async () => {
  const { default: GameLaunchLink, GameLaunchLinkView } = await loadGameLaunchLink()
  const wrapper = GameLaunchLink({
    gameId: 'retired-game',
    className: 'launch-link',
    children: '历史战绩',
  })
  const element = GameLaunchLinkView(wrapper.props)

  assert.equal(wrapper.type, GameLaunchLinkView)
  assert.equal(element.type, 'span')
  assert.equal(element.props.className, 'launch-link')
  assert.equal(element.props['aria-disabled'], 'true')
  assert.equal(element.props.children, '历史战绩')
})
