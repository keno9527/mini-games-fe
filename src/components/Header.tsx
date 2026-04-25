import { Link, useLocation } from 'react-router-dom'
import { useUserStore } from '../store/userStore'

export default function Header() {
  const location = useLocation()
  const { currentUser } = useUserStore()

  const nav = [
    { to: '/', label: '🎮 游戏大厅' },
    { to: '/profile', label: '👤 个人中心' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b-2 border-fun-border bg-fun-card/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-fun-accent to-fun-pink flex items-center justify-center text-white font-black text-lg shadow-btn">
            G
          </div>
          <span className="text-xl font-black text-fun-text group-hover:text-fun-accent transition-colors">
            Mini Game Hub
          </span>
          <span className="text-lg">🌟</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-2">
          {nav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 ${
                location.pathname === to
                  ? 'bg-fun-accent text-white'
                  : 'bg-fun-border text-fun-text hover:bg-fun-accent/20'
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
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-fun-border hover:bg-fun-accent/15 transition-all shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fun-purple to-fun-pink flex items-center justify-center text-xs font-black text-white">
                {currentUser.name[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-bold text-fun-text">{currentUser.name}</span>
            </Link>
          ) : (
            <Link
              to="/profile"
              className="text-sm font-bold text-fun-muted hover:text-fun-accent transition-colors px-3 py-1.5"
            >
              未登录
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
