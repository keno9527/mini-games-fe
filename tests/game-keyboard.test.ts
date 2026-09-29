import test from 'node:test'
import assert from 'node:assert/strict'
import { isGameShortcut } from '../src/features/games/keyboard.ts'

const key = (values: Partial<KeyboardEvent> = {}) =>
  ({
    defaultPrevented: false,
    isComposing: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...values,
  }) as KeyboardEvent

test('game shortcuts yield to browser commands, composition and handled UI events', () => {
  assert.equal(isGameShortcut(key()), true)
  assert.equal(isGameShortcut(key({ repeat: true })), true)
  for (const values of [
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { isComposing: true },
    { defaultPrevented: true },
  ])
    assert.equal(isGameShortcut(key(values)), false)
})

test('an open dialog suppresses global gameplay even when focus has not entered it yet', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  let open = true
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { querySelector: () => (open ? {} : null) },
  })
  try {
    assert.equal(isGameShortcut(key()), false)
    open = false
    assert.equal(isGameShortcut(key()), true)
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
