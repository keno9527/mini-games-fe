import { Link, useLocation } from 'react-router-dom'
import { SquaresFour } from '@phosphor-icons/react'
import { useUserStore } from '@/store/userStore'

export default function Header() {
  const { pathname } = useLocation()
  const { currentUser } = useUserStore()
  return (
    <header className="plaza-header">
      <div className="plaza-header-inner">
        <Link to="/" className="plaza-brand" aria-label="游戏广场首页">
          <SquaresFour size={28} weight="duotone" aria-hidden="true" />
          <span>游戏广场</span>
        </Link>
        <nav aria-label="主导航">
          <Link to="/" aria-current={pathname === '/' ? 'page' : undefined}>
            游戏库
          </Link>
          <Link to="/profile" aria-current={pathname === '/profile' ? 'page' : undefined}>
            {currentUser?.name ?? '我的'}
          </Link>
        </nav>
      </div>
    </header>
  )
}
