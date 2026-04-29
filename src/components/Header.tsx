import { Link, useLocation } from 'react-router-dom'
import { useUserStore } from '../store/userStore'

export default function Header() {
  const location = useLocation()
  const { currentUser } = useUserStore()

  const nav = [
    { to: '/', label: 'HOME' },
    { to: '/profile', label: 'ME' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b-2 border-crt-cyan bg-[#070a1e]/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1">
          <span
            className="font-pixel text-sm text-crt-cyan tracking-[2px]"
            style={{ textShadow: '0 0 8px #00f0ff' }}
          >
            GAME
          </span>
          <span
            className="font-pixel text-sm text-crt-pink tracking-[2px]"
            style={{ textShadow: '0 0 8px #ff2e88' }}
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
              className={`font-pixel text-[9px] px-2.5 py-1.5 border-2 transition-colors tracking-wider ${
                location.pathname === to
                  ? 'border-crt-cyan text-crt-cyan shadow-neon-c'
                  : 'border-transparent text-crt-muted hover:border-crt-cyan hover:text-crt-cyan'
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
              className="flex items-center gap-2 px-3 py-1.5 border-2 border-crt-yellow hover:shadow-neon-y transition-shadow"
            >
              <div
                className="w-6 h-6 bg-gradient-to-br from-crt-pink to-crt-purple flex items-center justify-center text-[10px] font-pixel text-white shadow-neon-p"
                style={{ imageRendering: 'pixelated' }}
              >
                {currentUser.name[0]?.toUpperCase()}
              </div>
              <span className="font-mono-crt text-[15px] text-crt-yellow tracking-wider">
                {currentUser.name}
              </span>
            </Link>
          ) : (
            <Link
              to="/profile"
              className="font-mono-crt text-[15px] text-crt-muted hover:text-crt-pink transition-colors px-2 py-1 tracking-wider"
            >
              &gt; LOG IN
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
