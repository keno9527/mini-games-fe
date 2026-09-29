import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, DeviceMobile, QrCode } from '@phosphor-icons/react'
import { createPreview } from './share'
import './desktop-preview.css'

function previewResult(address: string) {
  try {
    return { preview: createPreview(address), error: '' }
  } catch (error) {
    return { preview: null, error: (error as Error).message }
  }
}

export default function DesktopPreview() {
  const [address, setAddress] = useState(() => window.location.href)
  const [{ preview, error }, setResult] = useState(() => previewResult(address))

  return (
    <main className="bm-preview">
      <div className="bm-preview-shell">
        <header className="bm-preview-header">
          <Link to="/">
            <ArrowLeft size={18} /> 返回首页
          </Link>
          <span>POCKET BREAKER</span>
        </header>

        <section className="bm-preview-card" aria-labelledby="bm-preview-title">
          <div className="bm-preview-intro">
            <span className="bm-preview-label">
              <DeviceMobile size={18} /> 打砖块（手机端）
            </span>
            <h1 id="bm-preview-title">
              拿起手机，
              <br />
              扫码开一局。
            </h1>
            <p>30 个关卡，装进口袋。竖屏握住手机，左右滑动挡板，点击「发球」开始挑战。</p>
            <div className="bm-preview-tags">
              <span>自由选关</span>
              <span>六种道具</span>
              <span>免登录试玩</span>
            </div>
            <p className="bm-preview-note">
              推荐使用 iPhone Safari，也可用微信扫码打开。
              <br />
              进度仅保存在当前浏览器，Safari 与微信分别保存。
            </p>
          </div>

          <div className="bm-preview-scan">
            <h2>手机扫码试玩</h2>
            {preview ? (
              <>
                <div className="bm-preview-code">
                  <img src={preview.image} alt="打砖块（手机端）试玩二维码" />
                </div>
                <a className="bm-preview-url" href={preview.url}>
                  {preview.url} <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </>
            ) : (
              <div className="bm-preview-empty">
                <QrCode size={64} weight="light" />
                <p>
                  填写手机可访问的网址
                  <br />
                  即可生成试玩二维码
                </p>
              </div>
            )}
            <p className="bm-preview-network">
              局域网试玩时，手机与电脑需连接同一 Wi-Fi，并保持电脑上的预览服务运行。
            </p>
            <details className="bm-preview-address" open={!preview || undefined}>
              <summary>更换试玩地址</summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  setResult(previewResult(address))
                }}
              >
                <label htmlFor="bm-preview-address">手机可访问的网址</label>
                <input
                  id="bm-preview-address"
                  type="url"
                  required
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="http://192.168.1.10:5183/"
                  aria-describedby={error ? 'bm-preview-error' : undefined}
                />
                <button type="submit">生成二维码</button>
              </form>
            </details>
            {error && (
              <p id="bm-preview-error" className="bm-preview-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
