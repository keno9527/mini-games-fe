import type { GameComponentProps } from '@/games/manifest'
import { LogicCampaign } from './LogicCampaign'
import './minesweeper.css'

export default function Minesweeper(props: GameComponentProps) {
  return <LogicCampaign key={JSON.stringify([props.gameId, props.userId])} {...props} />
}
