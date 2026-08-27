import { Link, useLocation } from 'react-router-dom'
import { useUserStore } from '@/store/userStore'

export default function Header() {
  const location = useLocation()
  const { currentUser } = useUserStore()

  const nav = [
    { to: '/', label: 'HOME' },
    { to: '/profile', label: 'ME' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b-4 border-[#0b5bb8] bg-[#0757c8] text-white shadow-[0_5px_0_#083b86]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ffd343] text-xl shadow-[inset_0_-3px_0_rgba(0,0,0,0.18),0_3px_0_#a86800]">
            ★
          </span>
          <span
            className="font-pixel text-sm tracking-[1px] text-white"
            style={{ textShadow: '2px 2px 0 #083b86' }}
          >
            GAME
          </span>
          <span
            className="font-pixel text-sm tracking-[1px] text-[#ffd343]"
            style={{ textShadow: '2px 2px 0 #083b86' }}
          >
            HALL
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-2">
          {nav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`rounded-md px-4 py-2 font-pixel text-[9px] tracking-wider transition-all ${
                location.pathname === to
                  ? 'bg-white text-[#0757c8] shadow-[0_4px_0_#ffd343]'
                  : 'text-blue-100 hover:bg-white/15 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* User indicator */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.18)] transition-all hover:bg-white/25"
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[#ff4f63] to-[#ff9b2f] text-[10px] font-pixel text-white shadow-[0_3px_0_#8b2d19]"
                style={{ imageRendering: 'pixelated' }}
              >
                {currentUser.name[0]?.toUpperCase()}
              </div>
              <span className="font-game text-sm font-extrabold text-white">
                {currentUser.name}
              </span>
            </Link>
          ) : (
            <Link
              to="/profile"
              className="rounded-lg bg-[#ffd343] px-5 py-2 font-game text-sm font-extrabold text-[#18324d] shadow-[0_4px_0_#b46b00] transition-transform hover:-translate-y-0.5"
            >
              登录 / 注册
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
