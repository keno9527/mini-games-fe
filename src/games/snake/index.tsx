import type { GameComponentProps } from '@/games/manifest'
import Adventure from './Adventure'
import './snake.css'

export default function Snake(props: GameComponentProps) {
  return (
    <div className="snake-experience">
      <Adventure key={`${props.gameId}:${props.userId}`} {...props} />
    </div>
  )
}
