import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, GameController, Plug, SlidersHorizontal } from '@phosphor-icons/react'
import {
  browserGamepadPlatform,
  monitorGamepads,
  STANDARD_BUTTON_NAMES,
  type MonitorSnapshot,
  type MonitorStatus,
} from '@/features/gamepad/monitor'
import './gamepad-test.css'

const STATUS_COPY: Record<MonitorStatus, { title: string; detail: string }> = {
  waiting: {
    title: '等待手柄连接',
    detail:
      '用 USB 线连接手柄，然后在当前页面按一下手柄上的任意按钮。已连接的设备也可能需要按键才会出现。',
  },
  ready: {
    title: '正在接收手柄输入',
    detail: '按下按钮、扣动扳机或转动摇杆，查看下方实时反馈。这里只检测设备，不会控制游戏。',
  },
  paused: {
    title: '检测已暂停',
    detail: '页面失去焦点或切到后台时会清除读数。回到此页面即可继续检测。',
  },
  unsupported: {
    title: '当前浏览器未提供手柄接口',
    detail: '请使用支持 Gamepad API 的浏览器打开此页面，再连接手柄重试。',
  },
  insecure: {
    title: '需要安全的访问地址',
    detail: '请通过 HTTPS 或本机 localhost 打开页面。普通 HTTP 的局域网地址可能无法读取手柄。',
  },
  error: {
    title: '浏览器暂时无法读取手柄',
    detail:
      '可能被浏览器权限或嵌入页面策略限制。请在独立标签页打开本站，检查浏览器设置；页面会自动重试。',
  },
}

export default function GamepadTest() {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot>({ status: 'waiting', devices: [] })
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  useEffect(() => monitorGamepads(browserGamepadPlatform(), setSnapshot), [])
  const selected =
    snapshot.devices.find((device) => device.index === selectedIndex) ?? snapshot.devices[0]
  const message = STATUS_COPY[snapshot.status]
  const axisPairs = selected
    ? Array.from({ length: Math.ceil(selected.axes.length / 2) }, (_, pair) => pair * 2)
    : []

  return (
    <main className="gamepad-page">
      <Link className="gamepad-back" to="/">
        <ArrowLeft size={17} aria-hidden="true" /> 返回游戏库
      </Link>
      <header className="gamepad-heading">
        <div>
          <p className="gamepad-eyebrow">外设实验室 · INPUT LAB</p>
          <h1>先连接，再试试手感。</h1>
          <p>USB 手柄检测与按键测试。每一次按下，都看得见。</p>
        </div>
        <GameController
          className="gamepad-heading-icon"
          size={88}
          weight="duotone"
          aria-hidden="true"
        />
      </header>

      <section
        className={`gamepad-status gamepad-status--${snapshot.status}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="gamepad-status-dot" aria-hidden="true" />
        <div>
          <h2>{message.title}</h2>
          <p>{message.detail}</p>
        </div>
        <span className="gamepad-count">{snapshot.devices.length} 台可见设备</span>
      </section>

      <div className="gamepad-workbench">
        <aside className="gamepad-setup">
          <section className="gamepad-card">
            <h2>
              <Plug size={20} aria-hidden="true" /> 连接指南
            </h2>
            <ol className="gamepad-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>插入 USB 线</strong>
                  <p>使用支持数据传输的线缆，确认系统已识别手柄。</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>按一下手柄按钮</strong>
                  <p>保持当前页面在前台，按键后等待设备出现。</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>逐个检查输入</strong>
                  <p>试试方向键、扳机与摇杆，观察按下、触摸与数值。</p>
                </div>
              </li>
            </ol>
            <p className="gamepad-note">
              浏览器只报告设备输入，无法判断连接方式；系统识别的无线手柄也可能出现在这里。
            </p>
          </section>
          <section className="gamepad-card">
            <h2>当前设备</h2>
            <label htmlFor="gamepad-device">选择手柄</label>
            <select
              id="gamepad-device"
              value={selected?.index ?? ''}
              disabled={!selected}
              onChange={(event) => setSelectedIndex(Number(event.target.value))}
            >
              {!selected && <option value="">暂无可检测设备</option>}
              {snapshot.devices.map((device) => (
                <option key={device.index} value={device.index}>
                  #{device.index} · {device.id || '未命名手柄'}
                </option>
              ))}
            </select>
            {selected ? (
              <>
                <p className="gamepad-device-name">{selected.id || '未命名手柄'}</p>
                <dl className="gamepad-device-info">
                  <div>
                    <dt>设备索引</dt>
                    <dd>#{selected.index}</dd>
                  </div>
                  <div>
                    <dt>映射</dt>
                    <dd>
                      {selected.mapping === 'standard'
                        ? 'standard · 标准'
                        : selected.mapping || '原始映射'}
                    </dd>
                  </div>
                  <div>
                    <dt>输入数量</dt>
                    <dd>
                      {selected.buttons.length} 按钮 / {selected.axes.length} 轴
                    </dd>
                  </div>
                </dl>
                <p className="gamepad-note">
                  {selected.mapping === 'standard'
                    ? '按标准位置标注按钮；手柄外壳上的符号可能不同。触摸状态由设备和浏览器提供。'
                    : '此设备使用原始映射，仍可检测所有输入。按钮编号与实际位置请逐个按下核对。'}
                </p>
              </>
            ) : (
              <p className="gamepad-note">
                设备断开后会清除输入。连接多台手柄时，可在这里切换查看。
              </p>
            )}
          </section>
        </aside>

        <div className="gamepad-readings">
          <section className="gamepad-card">
            <div className="gamepad-section-title">
              <h2>
                <GameController size={21} aria-hidden="true" /> 按钮与扳机
              </h2>
              <span>数值 0 → 1</span>
            </div>
            <p className="gamepad-section-help">
              深绿色表示按下，描边表示触摸；条形刻度显示按压值。
            </p>
            {selected ? (
              selected.buttons.length ? (
                <div className="gamepad-buttons">
                  {selected.buttons.map((button, index) => (
                    <div
                      key={index}
                      className={`gamepad-button-reading${button.pressed ? ' is-pressed' : ''}${button.touched ? ' is-touched' : ''}`}
                    >
                      <div className="gamepad-button-top">
                        <strong>B{index}</strong>
                        <span>{button.value.toFixed(3)}</span>
                      </div>
                      <p>
                        {selected.mapping === 'standard'
                          ? (STANDARD_BUTTON_NAMES[index] ?? '扩展按钮')
                          : `原始按钮 ${index}`}
                      </p>
                      <div className="gamepad-button-meter" aria-hidden="true">
                        <span style={{ width: `${button.value * 100}%` }} />
                      </div>
                      <div className="gamepad-button-flags">
                        <span>{button.pressed ? '已按下' : '未按下'}</span>
                        <span>{button.touched ? '已触摸' : '未触摸'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="gamepad-empty">此设备未报告按钮。</p>
              )
            ) : (
              <div className="gamepad-empty">
                <GameController size={52} weight="light" aria-hidden="true" />
                <p>连接手柄后，按钮会在这里亮起。</p>
              </div>
            )}
          </section>

          <section className="gamepad-card">
            <div className="gamepad-section-title">
              <h2>
                <SlidersHorizontal size={21} aria-hidden="true" /> 摇杆与轴
              </h2>
              <span>原始数值 −1 → +1</span>
            </div>
            <p className="gamepad-section-help">
              每两个轴绘制一个坐标盘，不应用死区。松开摇杆后，可观察中心偏移；原始映射的轴也可能对应扳机。
            </p>
            {selected ? (
              axisPairs.length ? (
                <div className="gamepad-axis-grid">
                  {axisPairs.map((index) => {
                    const x = selected.axes[index]
                    const hasY = index + 1 < selected.axes.length
                    const y = selected.axes[index + 1] ?? 0
                    return (
                      <div className="gamepad-axis-pair" key={index}>
                        <h3>
                          {selected.mapping === 'standard' && index < 4
                            ? index === 0
                              ? '左摇杆'
                              : '右摇杆'
                            : `轴组 ${index / 2 + 1}`}
                        </h3>
                        <div className="gamepad-stick" aria-hidden="true">
                          <span className="gamepad-stick-center" />
                          <span
                            className="gamepad-stick-dot"
                            style={{ left: `${50 + x * 44}%`, top: `${50 + y * 44}%` }}
                          />
                        </div>
                        <dl>
                          <div>
                            <dt>Axis {index} · X</dt>
                            <dd>{x.toFixed(3)}</dd>
                          </div>
                          {hasY && (
                            <div>
                              <dt>Axis {index + 1} · Y</dt>
                              <dd>{y.toFixed(3)}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="gamepad-empty">此设备未报告轴。</p>
              )
            ) : (
              <p className="gamepad-empty">连接后可查看摇杆位置与每个轴的读数。</p>
            )}
          </section>
          <Link to="/game/tank-battle" className="gamepad-back">
            前往坦克大战，选择单人或双人合作 →
          </Link>
          <p className="gamepad-footer-note">
            输入变化时实时刷新，显示至小数点后三位。此页面用于检查浏览器能否接收输入；坦克大战已支持单手柄单人与双手柄双人合作。
          </p>
        </div>
      </div>
    </main>
  )
}
