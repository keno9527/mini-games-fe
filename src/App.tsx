import { Suspense } from 'react'
import { HashRouter, Routes, Route, Outlet } from 'react-router-dom'
import Header from '@/components/Header'
import Home from '@/pages/Home'
import GameDetail from '@/pages/GameDetail'
import Profile from '@/pages/Profile'
import GamepadTest from '@/pages/GamepadTest'
import PlayerGate from '@/components/PlayerGate'
import SaveStatus from '@/components/SaveStatus'
import { getGameComponent } from '@/games/registry'

const MobileBreakout = getGameComponent('breakout-mobile')!

function PlazaLayout() {
  return (
    <div className="min-h-screen game-plaza text-[#18324d]">
      <Header />
      <SaveStatus />
      <Outlet />
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/game/breakout-mobile"
          element={
            <Suspense
              fallback={
                <main className="game-placeholder" role="status">
                  正在准备竖屏挑战…
                </main>
              }
            >
              <MobileBreakout gameId="breakout-mobile" />
            </Suspense>
          }
        />
        <Route element={<PlazaLayout />}>
          <Route path="/" element={<Home />} />
          <Route
            element={
              <PlayerGate>
                <Outlet />
              </PlayerGate>
            }
          >
            <Route path="/game/:id" element={<GameDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/gamepad" element={<GamepadTest />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
