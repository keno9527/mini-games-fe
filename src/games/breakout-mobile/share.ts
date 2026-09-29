import qrcode from 'qrcode-generator'

export function mobilePreviewUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('请输入完整网址，例如 http://192.168.1.10:5183/')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('请使用不含账号密码的 HTTP 或 HTTPS 网址。')
  }
  const hostname = url.hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('127.') ||
    hostname === '[::1]' ||
    hostname === '[::]'
  ) {
    throw new Error('当前网址仅限这台电脑访问，请填写电脑的局域网网址或已部署的网址。')
  }
  url.search = ''
  url.hash = '/game/breakout-mobile'
  return url.href
}

export function createPreview(value: string) {
  const url = mobilePreviewUrl(value)
  const code = qrcode(0, 'M')
  code.addData(url)
  try {
    code.make()
  } catch {
    throw new Error('网址过长，无法生成二维码，请使用更短的试玩网址。')
  }
  return { url, image: code.createDataURL(6, 24) }
}
