import { useCallback, useRef, useState, type FormEvent } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'
type Status = 'idle' | 'playing' | 'over'
type Result = 'win' | 'lose' | 'complete'

interface PoemLine {
  line: string
  author: string
  title: string
  tags: string[]
}

interface BattleLog {
  speaker: 'player' | 'ai' | 'judge'
  line: string
  meta: string
  points?: number
}

const CONFIG: Record<Level, { exchanges: number; label: string }> = {
  简单: { exchanges: 4, label: '4 回合' },
  中等: { exchanges: 6, label: '6 回合' },
  复杂: { exchanges: 8, label: '8 回合' },
}

const KEYWORDS = ['月', '春', '花', '酒', '山', '水', '风', '夜', '江', '雪', '雨', '人']

const POEM_BANK: PoemLine[] = [
  { line: '春眠不觉晓', author: '孟浩然', title: '春晓', tags: ['春', '夜'] },
  { line: '处处闻啼鸟', author: '孟浩然', title: '春晓', tags: ['春'] },
  { line: '夜来风雨声', author: '孟浩然', title: '春晓', tags: ['夜', '风', '雨'] },
  { line: '花落知多少', author: '孟浩然', title: '春晓', tags: ['花'] },
  { line: '好雨知时节', author: '杜甫', title: '春夜喜雨', tags: ['雨'] },
  { line: '当春乃发生', author: '杜甫', title: '春夜喜雨', tags: ['春'] },
  { line: '随风潜入夜', author: '杜甫', title: '春夜喜雨', tags: ['风', '夜'] },
  { line: '润物细无声', author: '杜甫', title: '春夜喜雨', tags: ['雨'] },
  { line: '国破山河在', author: '杜甫', title: '春望', tags: ['山'] },
  { line: '城春草木深', author: '杜甫', title: '春望', tags: ['春'] },
  { line: '感时花溅泪', author: '杜甫', title: '春望', tags: ['花'] },
  { line: '恨别鸟惊心', author: '杜甫', title: '春望', tags: ['人'] },
  { line: '春风又绿江南岸', author: '王安石', title: '泊船瓜洲', tags: ['春', '风', '江'] },
  { line: '明月何时照我还', author: '王安石', title: '泊船瓜洲', tags: ['月', '人'] },
  { line: '不知细叶谁裁出', author: '贺知章', title: '咏柳', tags: ['春'] },
  { line: '二月春风似剪刀', author: '贺知章', title: '咏柳', tags: ['月', '春', '风'] },
  { line: '床前明月光', author: '李白', title: '静夜思', tags: ['月', '夜'] },
  { line: '疑是地上霜', author: '李白', title: '静夜思', tags: ['月'] },
  { line: '举头望明月', author: '李白', title: '静夜思', tags: ['月'] },
  { line: '低头思故乡', author: '李白', title: '静夜思', tags: ['人'] },
  { line: '举杯邀明月', author: '李白', title: '月下独酌', tags: ['月', '酒'] },
  { line: '对影成三人', author: '李白', title: '月下独酌', tags: ['人'] },
  { line: '花间一壶酒', author: '李白', title: '月下独酌', tags: ['花', '酒'] },
  { line: '独酌无相亲', author: '李白', title: '月下独酌', tags: ['酒', '人'] },
  { line: '明月出天山', author: '李白', title: '关山月', tags: ['月', '山'] },
  { line: '苍茫云海间', author: '李白', title: '关山月', tags: ['云', '山'] },
  { line: '海上生明月', author: '张九龄', title: '望月怀远', tags: ['月', '水'] },
  { line: '天涯共此时', author: '张九龄', title: '望月怀远', tags: ['人'] },
  { line: '月落乌啼霜满天', author: '张继', title: '枫桥夜泊', tags: ['月', '夜', '雪'] },
  { line: '江枫渔火对愁眠', author: '张继', title: '枫桥夜泊', tags: ['江', '夜'] },
  { line: '姑苏城外寒山寺', author: '张继', title: '枫桥夜泊', tags: ['山'] },
  { line: '夜半钟声到客船', author: '张继', title: '枫桥夜泊', tags: ['夜'] },
  { line: '明月松间照', author: '王维', title: '山居秋暝', tags: ['月', '山'] },
  { line: '清泉石上流', author: '王维', title: '山居秋暝', tags: ['水', '山'] },
  { line: '空山新雨后', author: '王维', title: '山居秋暝', tags: ['山', '雨'] },
  { line: '天气晚来秋', author: '王维', title: '山居秋暝', tags: ['夜'] },
  { line: '秦时明月汉时关', author: '王昌龄', title: '出塞', tags: ['月', '人'] },
  { line: '万里长征人未还', author: '王昌龄', title: '出塞', tags: ['人'] },
  { line: '春江潮水连海平', author: '张若虚', title: '春江花月夜', tags: ['春', '江', '水'] },
  { line: '海上明月共潮生', author: '张若虚', title: '春江花月夜', tags: ['月', '水'] },
  { line: '江天一色无纤尘', author: '张若虚', title: '春江花月夜', tags: ['江'] },
  { line: '皎皎空中孤月轮', author: '张若虚', title: '春江花月夜', tags: ['月'] },
  { line: '人生得意须尽欢', author: '李白', title: '将进酒', tags: ['人', '酒'] },
  { line: '莫使金樽空对月', author: '李白', title: '将进酒', tags: ['月', '酒'] },
  { line: '烹羊宰牛且为乐', author: '李白', title: '将进酒', tags: ['酒'] },
  { line: '会须一饮三百杯', author: '李白', title: '将进酒', tags: ['酒'] },
  { line: '劝君更尽一杯酒', author: '王维', title: '送元二使安西', tags: ['酒', '人'] },
  { line: '西出阳关无故人', author: '王维', title: '送元二使安西', tags: ['人'] },
  { line: '渭城朝雨浥轻尘', author: '王维', title: '送元二使安西', tags: ['雨'] },
  { line: '客舍青青柳色新', author: '王维', title: '送元二使安西', tags: ['春'] },
  { line: '葡萄美酒夜光杯', author: '王翰', title: '凉州词', tags: ['酒', '夜'] },
  { line: '欲饮琵琶马上催', author: '王翰', title: '凉州词', tags: ['酒'] },
  { line: '借问酒家何处有', author: '杜牧', title: '清明', tags: ['酒', '雨'] },
  { line: '牧童遥指杏花村', author: '杜牧', title: '清明', tags: ['花', '人'] },
  { line: '白日依山尽', author: '王之涣', title: '登鹳雀楼', tags: ['山'] },
  { line: '黄河入海流', author: '王之涣', title: '登鹳雀楼', tags: ['水'] },
  { line: '欲穷千里目', author: '王之涣', title: '登鹳雀楼', tags: ['人'] },
  { line: '更上一层楼', author: '王之涣', title: '登鹳雀楼', tags: ['人'] },
  { line: '空山不见人', author: '王维', title: '鹿柴', tags: ['山', '人'] },
  { line: '但闻人语响', author: '王维', title: '鹿柴', tags: ['人'] },
  { line: '返景入深林', author: '王维', title: '鹿柴', tags: ['山'] },
  { line: '复照青苔上', author: '王维', title: '鹿柴', tags: ['山'] },
  { line: '千山鸟飞绝', author: '柳宗元', title: '江雪', tags: ['山', '雪'] },
  { line: '万径人踪灭', author: '柳宗元', title: '江雪', tags: ['人', '雪'] },
  { line: '孤舟蓑笠翁', author: '柳宗元', title: '江雪', tags: ['江', '雪'] },
  { line: '独钓寒江雪', author: '柳宗元', title: '江雪', tags: ['江', '雪'] },
  { line: '大漠孤烟直', author: '王维', title: '使至塞上', tags: ['风'] },
  { line: '长河落日圆', author: '王维', title: '使至塞上', tags: ['水'] },
  { line: '山随平野尽', author: '李白', title: '渡荆门送别', tags: ['山'] },
  { line: '江入大荒流', author: '李白', title: '渡荆门送别', tags: ['江'] },
  { line: '天门中断楚江开', author: '李白', title: '望天门山', tags: ['山', '江'] },
  { line: '碧水东流至此回', author: '李白', title: '望天门山', tags: ['水'] },
  { line: '两岸青山相对出', author: '李白', title: '望天门山', tags: ['山'] },
  { line: '孤帆一片日边来', author: '李白', title: '望天门山', tags: ['江'] },
  { line: '竹外桃花三两枝', author: '苏轼', title: '惠崇春江晚景', tags: ['花', '春', '江'] },
  { line: '春江水暖鸭先知', author: '苏轼', title: '惠崇春江晚景', tags: ['春', '江', '水'] },
  { line: '接天莲叶无穷碧', author: '杨万里', title: '晓出净慈寺送林子方', tags: ['水'] },
  { line: '映日荷花别样红', author: '杨万里', title: '晓出净慈寺送林子方', tags: ['花'] },
  { line: '小荷才露尖尖角', author: '杨万里', title: '小池', tags: ['花', '水'] },
  { line: '早有蜻蜓立上头', author: '杨万里', title: '小池', tags: ['人'] },
  { line: '停车坐爱枫林晚', author: '杜牧', title: '山行', tags: ['山', '夜'] },
  { line: '霜叶红于二月花', author: '杜牧', title: '山行', tags: ['月', '花'] },
  { line: '忽如一夜春风来', author: '岑参', title: '白雪歌送武判官归京', tags: ['夜', '春', '风', '雪'] },
  { line: '千树万树梨花开', author: '岑参', title: '白雪歌送武判官归京', tags: ['花', '雪'] },
  { line: '两个黄鹂鸣翠柳', author: '杜甫', title: '绝句', tags: ['春'] },
  { line: '一行白鹭上青天', author: '杜甫', title: '绝句', tags: ['人'] },
  { line: '窗含西岭千秋雪', author: '杜甫', title: '绝句', tags: ['雪', '山'] },
  { line: '门泊东吴万里船', author: '杜甫', title: '绝句', tags: ['江'] },
  { line: '天街小雨润如酥', author: '韩愈', title: '早春呈水部张十八员外', tags: ['雨', '春'] },
  { line: '草色遥看近却无', author: '韩愈', title: '早春呈水部张十八员外', tags: ['春'] },
  { line: '沾衣欲湿杏花雨', author: '志南', title: '绝句', tags: ['雨', '花'] },
  { line: '吹面不寒杨柳风', author: '志南', title: '绝句', tags: ['风'] },
  { line: '黑云翻墨未遮山', author: '苏轼', title: '六月二十七日望湖楼醉书', tags: ['山', '雨'] },
  { line: '白雨跳珠乱入船', author: '苏轼', title: '六月二十七日望湖楼醉书', tags: ['雨'] },
  { line: '风急天高猿啸哀', author: '杜甫', title: '登高', tags: ['风'] },
  { line: '渚清沙白鸟飞回', author: '杜甫', title: '登高', tags: ['江'] },
  { line: '无边落木萧萧下', author: '杜甫', title: '登高', tags: ['风'] },
  { line: '不尽长江滚滚来', author: '杜甫', title: '登高', tags: ['江'] },
  { line: '柴门闻犬吠', author: '刘长卿', title: '逢雪宿芙蓉山主人', tags: ['雪', '人'] },
  { line: '风雪夜归人', author: '刘长卿', title: '逢雪宿芙蓉山主人', tags: ['风', '雪', '夜', '人'] },
  { line: '日照香炉生紫烟', author: '李白', title: '望庐山瀑布', tags: ['山'] },
  { line: '遥看瀑布挂前川', author: '李白', title: '望庐山瀑布', tags: ['水', '山'] },
  { line: '飞流直下三千尺', author: '李白', title: '望庐山瀑布', tags: ['水'] },
  { line: '疑是银河落九天', author: '李白', title: '望庐山瀑布', tags: ['水'] },
  { line: '人闲桂花落', author: '王维', title: '鸟鸣涧', tags: ['人', '花'] },
  { line: '夜静春山空', author: '王维', title: '鸟鸣涧', tags: ['夜', '春', '山'] },
  { line: '月出惊山鸟', author: '王维', title: '鸟鸣涧', tags: ['月', '山'] },
  { line: '时鸣春涧中', author: '王维', title: '鸟鸣涧', tags: ['春', '水'] },
  { line: '千里莺啼绿映红', author: '杜牧', title: '江南春', tags: ['春'] },
  { line: '水村山郭酒旗风', author: '杜牧', title: '江南春', tags: ['水', '山', '酒', '风'] },
  { line: '南朝四百八十寺', author: '杜牧', title: '江南春', tags: ['人'] },
  { line: '多少楼台烟雨中', author: '杜牧', title: '江南春', tags: ['雨'] },
]

function normalizeLine(line: string) {
  return line.replace(/[，。！？；：、,.!?;:\s]/g, '').trim()
}

function hasChinese(value: string) {
  return /[\u4e00-\u9fff]/.test(value)
}

function findKnownLine(line: string) {
  const clean = normalizeLine(line)
  return POEM_BANK.find(item => normalizeLine(item.line) === clean)
}

function linePower(item: PoemLine) {
  return normalizeLine(item.line).length * 5 + item.tags.length * 6 + (item.author === '李白' || item.author === '杜甫' ? 8 : 0)
}

function pickAiLine(keyword: string, used: Set<string>, level: Level) {
  const candidates = POEM_BANK
    .filter(item => item.line.includes(keyword) && !used.has(normalizeLine(item.line)))
    .sort((a, b) => linePower(b) - linePower(a))

  if (!candidates.length) return null
  if (level === '复杂') return candidates[Math.floor(Math.random() * Math.min(5, candidates.length))]
  if (level === '中等') return candidates[Math.floor(Math.random() * Math.min(10, candidates.length))]
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function scorePlayerLine(line: string, keyword: string, turnStartedAt: number) {
  const clean = normalizeLine(line)
  const known = findKnownLine(clean)
  const elapsed = Math.max(0, Math.floor((Date.now() - turnStartedAt) / 1000))
  const speedBonus = Math.max(0, 30 - elapsed * 2)
  const rhythmBonus = [5, 7, 10, 14].includes(clean.length) ? 16 : 6
  const knownBonus = known ? 38 : 0
  const keywordBonus = line.includes(keyword) ? 30 : 0
  const lengthBonus = Math.min(32, clean.length * 3)
  const points = 40 + keywordBonus + lengthBonus + rhythmBonus + knownBonus + speedBonus
  return {
    points,
    meta: known ? `${known.author}《${known.title}》` : 'AI 裁判判为自报诗句',
  }
}

function scoreAiLine(item: PoemLine, level: Level) {
  const levelBonus = level === '复杂' ? 34 : level === '中等' ? 18 : 6
  return Math.round(72 + linePower(item) * 0.45 + levelBonus + Math.random() * 12)
}

function resultText(result: Result) {
  if (result === 'win') return '你赢下这场飞花令'
  if (result === 'lose') return 'AI 守擂成功'
  return '双方难分高下'
}

export default function AIFeihualing({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const [keyword, setKeyword] = useState('月')
  const [status, setStatus] = useState<Status>('idle')
  const [exchange, setExchange] = useState(0)
  const [playerScore, setPlayerScore] = useState(0)
  const [aiScore, setAiScore] = useState(0)
  const [input, setInput] = useState('')
  const [hint, setHint] = useState('选择题眼后开始，对上含题眼的诗句。')
  const [logs, setLogs] = useState<BattleLog[]>([])

  const startTimeRef = useRef(0)
  const turnStartedAtRef = useRef(0)
  const submittedRef = useRef(false)

  const submitRecord = useCallback(
    async (result: Result, score: number) => {
      if (!userId || submittedRef.current) return
      submittedRef.current = true
      const duration = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
      try {
        await createRecord(userId, { gameId, score, duration, result })
      } catch {}
    },
    [userId, gameId]
  )

  const finishGame = useCallback(
    (result: Result, score: number) => {
      setStatus('over')
      setHint(`${resultText(result)}，本局得分 ${score}。`)
      void submitRecord(result, score)
    },
    [submitRecord]
  )

  const startGame = () => {
    const now = Date.now()
    startTimeRef.current = now
    turnStartedAtRef.current = now
    submittedRef.current = false
    setStatus('playing')
    setExchange(0)
    setPlayerScore(0)
    setAiScore(0)
    setInput('')
    setHint(`题眼「${keyword}」，请先手出句。`)
    setLogs([
      {
        speaker: 'judge',
        line: `飞花令开局，题眼为「${keyword}」。`,
        meta: `AI 守擂 ${CONFIG[level].label}`,
      },
    ])
  }

  const resetGame = () => {
    setStatus('idle')
    setExchange(0)
    setPlayerScore(0)
    setAiScore(0)
    setInput('')
    setHint('选择题眼后开始，对上含题眼的诗句。')
    setLogs([])
    submittedRef.current = false
  }

  const submitLine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status !== 'playing') return

    const raw = input.trim()
    const clean = normalizeLine(raw)
    if (!raw) {
      setHint('先输入一句诗。')
      return
    }
    if (!hasChinese(clean) || clean.length < 5) {
      setHint('AI 裁判没有通过：诗句至少 5 个中文字符。')
      return
    }
    if (!raw.includes(keyword)) {
      setHint(`AI 裁判没有通过：诗句里需要包含「${keyword}」。`)
      return
    }

    const used = new Set(
      logs
        .filter(item => item.speaker !== 'judge')
        .map(item => normalizeLine(item.line))
    )
    if (used.has(clean)) {
      setHint('这句已经出现过，飞花令不能重复。')
      return
    }

    const player = scorePlayerLine(raw, keyword, turnStartedAtRef.current)
    const nextPlayerScore = playerScore + player.points
    const nextLogs: BattleLog[] = [
      ...logs,
      { speaker: 'player', line: raw, meta: player.meta, points: player.points },
    ]

    used.add(clean)
    const aiLine = pickAiLine(keyword, used, level)
    if (!aiLine) {
      const finalScore = nextPlayerScore + 160
      nextLogs.push({
        speaker: 'judge',
        line: 'AI 词库被你打空，攻擂成功。',
        meta: '+160 终局奖励',
      })
      setLogs(nextLogs)
      setPlayerScore(finalScore)
      setInput('')
      finishGame('win', finalScore)
      return
    }

    const aiPoints = scoreAiLine(aiLine, level)
    const nextAiScore = aiScore + aiPoints
    const nextExchange = exchange + 1
    nextLogs.push({
      speaker: 'ai',
      line: aiLine.line,
      meta: `${aiLine.author}《${aiLine.title}》`,
      points: aiPoints,
    })

    if (nextExchange >= CONFIG[level].exchanges) {
      const result: Result = nextPlayerScore > nextAiScore ? 'win' : nextPlayerScore < nextAiScore ? 'lose' : 'complete'
      nextLogs.push({
        speaker: 'judge',
        line: `${CONFIG[level].label} 结束：${resultText(result)}。`,
        meta: `你 ${nextPlayerScore} / AI ${nextAiScore}`,
      })
      setLogs(nextLogs)
      setPlayerScore(nextPlayerScore)
      setAiScore(nextAiScore)
      setExchange(nextExchange)
      setInput('')
      finishGame(result, nextPlayerScore)
      return
    }

    setLogs(nextLogs)
    setPlayerScore(nextPlayerScore)
    setAiScore(nextAiScore)
    setExchange(nextExchange)
    setInput('')
    setHint(`AI 已应句，继续围绕「${keyword}」出招。`)
    turnStartedAtRef.current = Date.now()
  }

  const picking = status === 'idle' || status === 'over'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['PLAYER', `${playerScore} PT`, 'text-crt-cyan'],
          ['AI BOT', `${aiScore} PT`, 'text-crt-pink'],
          ['ROUND', `${Math.min(exchange, CONFIG[level].exchanges)}/${CONFIG[level].exchanges}`, 'text-crt-yellow'],
          ['KEY', `「${keyword}」`, 'text-crt-green'],
        ].map(([label, value, cls]) => (
          <div key={label} className="bg-black/45 border-2 border-crt-border p-3">
            <p className="font-pixel text-[8px] text-crt-text-dim tracking-widest mb-2">{label}</p>
            <p className={`font-mono-crt text-2xl tracking-wider ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(CONFIG) as Level[]).map(item => (
          <button
            key={item}
            type="button"
            disabled={!picking}
            onClick={() => {
              setLevel(item)
              resetGame()
            }}
            className={`px-3 py-2 border-2 font-pixel text-[8px] tracking-widest transition-all ${
              level === item
                ? 'bg-crt-pink text-white border-crt-pink shadow-neon-p'
                : 'bg-black/30 text-crt-text-dim border-crt-border hover:border-crt-cyan hover:text-crt-cyan'
            } ${!picking ? 'opacity-45 cursor-not-allowed' : ''}`}
          >
            {item} · {CONFIG[item].label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {KEYWORDS.map(item => (
          <button
            key={item}
            type="button"
            disabled={!picking}
            onClick={() => {
              setKeyword(item)
              resetGame()
            }}
            className={`w-10 h-10 border-2 font-mono-crt text-2xl transition-all ${
              keyword === item
                ? 'bg-crt-yellow text-crt-bg-deep border-crt-yellow shadow-neon-y'
                : 'bg-black/30 text-crt-text border-crt-border hover:border-crt-yellow'
            } ${!picking ? 'opacity-45 cursor-not-allowed' : ''}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">
        <div className="bg-black/35 border-2 border-crt-cyan min-h-[360px] max-h-[430px] overflow-y-auto p-4">
          {logs.length === 0 ? (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center">
              <p className="font-pixel text-[10px] text-crt-cyan tracking-widest mb-3" style={{ textShadow: '0 0 8px #00F0FF' }}>
                AI FEIHUALING
              </p>
              <p className="font-mono-crt text-lg text-crt-text-dim tracking-wide">
                &gt; SELECT KEYWORD AND START
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((item, idx) => (
                <div
                  key={`${item.speaker}-${idx}-${item.line}`}
                  className={`border p-3 ${
                    item.speaker === 'player'
                      ? 'border-crt-cyan bg-crt-cyan/10'
                      : item.speaker === 'ai'
                        ? 'border-crt-pink bg-crt-pink/10'
                        : 'border-crt-yellow bg-crt-yellow/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-pixel text-[8px] tracking-widest text-crt-text-dim">
                      {item.speaker === 'player' ? 'YOU' : item.speaker === 'ai' ? 'AI' : 'JUDGE'}
                    </span>
                    {typeof item.points === 'number' && (
                      <span className="ml-auto font-mono-crt text-sm text-crt-yellow tracking-wider">
                        +{item.points}PT
                      </span>
                    )}
                  </div>
                  <p className="font-mono-crt text-2xl md:text-3xl text-crt-text leading-tight tracking-wide">
                    {item.line}
                  </p>
                  <p className="font-mono-crt text-sm text-crt-text-dim mt-2 tracking-wide">{item.meta}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-black/35 border-2 border-crt-yellow p-4 space-y-4">
          <div>
            <p className="font-pixel text-[9px] text-crt-yellow tracking-widest mb-2" style={{ textShadow: '0 0 6px #FFE500' }}>
              AI JUDGE
            </p>
            <p className="font-mono-crt text-lg text-crt-text leading-snug tracking-wide min-h-[72px]">{hint}</p>
          </div>
          <div className="border border-crt-border p-3 bg-crt-bg-deep/70">
            <p className="font-pixel text-[8px] text-crt-text-dim tracking-widest mb-2">SCORE RULE</p>
            <p className="font-mono-crt text-sm text-crt-muted leading-relaxed">
              含题眼、节奏完整、命中词库、快速作答都会加分；重复或缺题眼会被拦截。
            </p>
          </div>
          {status === 'idle' && (
            <button
              type="button"
              onClick={startGame}
              className="w-full py-3 bg-crt-yellow text-crt-bg-deep border-2 border-crt-yellow font-pixel text-[10px] tracking-widest shadow-neon-y hover:shadow-[0_0_18px_#FFE500] transition-all"
            >
              START DUEL
            </button>
          )}
          {status === 'over' && (
            <button
              type="button"
              onClick={startGame}
              className="w-full py-3 bg-crt-pink text-white border-2 border-crt-pink font-pixel text-[10px] tracking-widest shadow-neon-p hover:shadow-[0_0_18px_#FF2EC8] transition-all"
            >
              REMATCH
            </button>
          )}
        </div>
      </div>

      <form onSubmit={submitLine} className="flex flex-col md:flex-row gap-3">
        <input
          value={input}
          onChange={event => setInput(event.target.value)}
          disabled={status !== 'playing'}
          placeholder={`输入一句含「${keyword}」的诗句`}
          className="flex-1 min-w-0 bg-black border-2 border-crt-cyan px-4 py-3 font-mono-crt text-2xl text-crt-green placeholder-crt-muted focus:outline-none focus:border-crt-yellow disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status !== 'playing'}
          className="px-7 py-3 bg-crt-cyan text-crt-bg-deep border-2 border-crt-cyan font-pixel text-[10px] tracking-widest shadow-neon-c disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_18px_#00F0FF] transition-all"
        >
          SEND LINE
        </button>
      </form>
    </div>
  )
}
