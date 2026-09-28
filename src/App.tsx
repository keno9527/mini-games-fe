import { HashRouter, Routes, Route } from 'react-router-dom'
import Header from '@/components/Header'
import Home from '@/pages/Home'
import GameDetail from '@/pages/GameDetail'
import Profile from '@/pages/Profile'
import GamepadTest from '@/pages/GamepadTest'
import PlayerGate from '@/components/PlayerGate'
import SaveStatus from '@/components/SaveStatus'

function App() {
  return (
    <HashRouter>
      <div className="min-h-screen game-plaza text-[#18324d]">
        <Header />
        <SaveStatus />
        <PlayerGate>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game/:id" element={<GameDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/gamepad" element={<GamepadTest />} />
          </Routes>
        </PlayerGate>
      </div>
    </HashRouter>
  )
}

export default App
