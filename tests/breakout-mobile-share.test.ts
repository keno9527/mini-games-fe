import assert from 'node:assert/strict'
import test from 'node:test'
import { createPreview, mobilePreviewUrl } from '../src/games/breakout-mobile/share'

test('mobile QR targets the current host, port and deployment path without query data', () => {
  assert.equal(
    mobilePreviewUrl('http://192.168.1.10:5195/?debug=1#/'),
    'http://192.168.1.10:5195/#/game/breakout-mobile',
  )
  assert.equal(
    mobilePreviewUrl('https://games.example.com/arcade/?token=private#/game/breakout'),
    'https://games.example.com/arcade/#/game/breakout-mobile',
  )
  assert.equal(
    mobilePreviewUrl('http://[fd00::1234]:5183/'),
    'http://[fd00::1234]:5183/#/game/breakout-mobile',
  )
})

test('mobile QR refuses loopback, unspecified, unsafe and incomplete addresses', () => {
  for (const value of [
    'http://localhost:5183/',
    'http://game.localhost/',
    'http://127.0.0.1:5183/',
    'http://127.2.3.4/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[::]/',
    'javascript:alert(1)',
    'file:///game/index.html',
    'https://username:password@example.com/',
    '/#/game/breakout-mobile',
    '',
  ]) {
    assert.throws(() => mobilePreviewUrl(value), undefined, value)
  }
})

test('QR is generated locally and excessively long URLs fail with an actionable message', () => {
  const preview = createPreview('https://games.example.com/')
  assert.equal(preview.url, 'https://games.example.com/#/game/breakout-mobile')
  assert.match(preview.image, /^data:image\/gif;base64,/)
  assert.throws(() => createPreview(`https://example.com/${'a'.repeat(3000)}`), /网址过长/)
})
