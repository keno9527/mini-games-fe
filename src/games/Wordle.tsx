import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'
type LetterState = 'correct' | 'present' | 'absent' | 'empty'

const CONFIG: Record<Level, { len: number; tries: number }> = {
  简单: { len: 4, tries: 6 },
  中等: { len: 5, tries: 6 },
  复杂: { len: 6, tries: 5 },
}

const WORDS_4 = (
  'ABLE,ACID,AGED,ALSO,AREA,ARMY,AWAY,BABY,BACK,BALL,BAND,BANK,BASE,BATH,BEAR,BEAT,BEER,BELL,BELT,BEST,' +
  'BIKE,BILL,BIRD,BLUE,BOAT,BODY,BOMB,BOND,BONE,BOOK,BORN,BOTH,BOWL,BURN,BUSY,CALL,CALM,CAME,CAMP,CARD,' +
  'CARE,CASE,CASH,CAST,CELL,CITY,CLUB,COAL,COAT,CODE,COLD,COME,COOK,COOL,COPY,CORE,COST,CREW,DARK,DATA,' +
  'DATE,DAWN,DEAD,DEAL,DEAR,DEEP,DESK,DIET,DOES,DONE,DOOR,DOWN,DRAW,DROP,DRUG,DUAL,DUTY,EACH,EARN,EASE,' +
  'EAST,EASY,EDGE,ELSE,EVEN,EVER,EXIT,FACE,FACT,FAIL,FAIR,FALL,FARM,FAST,FEAR,FEED,FEEL,FEET,FILE,FILL,' +
  'FILM,FIND,FINE,FIRE,FIRM,FISH,FIVE,FLAT,FLOW,FOOD,FOOT,FORD,FORM,FORT,FOUR,FREE,FROM,FUEL,FULL,FUND,' +
  'GAIN,GAME,GATE,GAVE,GEAR,GIFT,GIRL,GIVE,GLAD,GOAL,GOES,GOLD,GONE,GOOD,GRAY,GREW,GREY,GROW,GULF,HAIR,' +
  'HALF,HALL,HAND,HANG,HARD,HARM,HATE,HAVE,HEAD,HEAR,HEAT,HELD,HELP,HERE,HERO,HIGH,HILL,HIRE,HOLD,HOLE,' +
  'HOLY,HOME,HOPE,HOST,HOUR,HUGE,HUNG,HUNT,HURT,IDEA,INCH,INTO,IRON,ITEM,JOIN,JUMP,JURY,JUST,KEEN,KEEP,' +
  'KEPT,KICK,KILL,KIND,KING,KNEE,KNEW,KNOW,LACK,LADY,LAID,LAKE,LAND,LANE,LAST,LATE,LEAD,LEFT,LESS,LIFE,' +
  'LIFT,LIKE,LINE,LINK,LIST,LIVE,LOAD,LOAN,LOCK,LOGO,LONG,LOOK,LORD,LOSE,LOSS,LOST,LOUD,LOVE,LUCK,MADE,' +
  'MAIL,MAIN,MAKE,MALE,MANY,MARK,MASS,MEAL,MEAN,MEAT,MEET,MENU,MERE,MILE,MILK,MILL,MIND,MINE,MISS,MODE'
).split(',')

const WORDS_5 = (
  'ABOUT,ABOVE,ABUSE,ACTOR,ACUTE,ADMIT,ADOPT,ADULT,AFTER,AGAIN,AGENT,AGREE,AHEAD,ALARM,ALBUM,ALERT,ALIKE,ALIVE,ALLOW,ALONE,' +
  'ALONG,ALTER,AMONG,ANGER,ANGLE,ANGRY,APART,APPLE,APPLY,ARENA,ARGUE,ARISE,ARRAY,ASIDE,ASSET,AVOID,AWAKE,AWARD,AWARE,BADLY,' +
  'BASIC,BEACH,BEGAN,BEGIN,BEING,BELOW,BENCH,BILLY,BIRTH,BLACK,BLAME,BLIND,BLOCK,BLOOD,BOARD,BOAST,BOOST,BOOTH,BOUND,BRAIN,' +
  'BRAND,BREAD,BREAK,BREED,BRIEF,BRING,BROAD,BROKE,BROWN,BUILD,BUILT,BUYER,CABIN,CABLE,CALIF,CARRY,CATCH,CAUSE,CHAIN,CHAIR,' +
  'CHAOS,CHARM,CHART,CHASE,CHEAP,CHECK,CHEST,CHIEF,CHILD,CHINA,CHOSE,CIVIL,CLAIM,CLASS,CLEAN,CLEAR,CLICK,CLIMB,CLOCK,CLOSE,' +
  'CLOUD,COACH,COAST,COULD,COUNT,COURT,COVER,CRAFT,CRASH,CRAZY,CREAM,CRIME,CROSS,CROWD,CROWN,CRUDE,CURVE,CYCLE,DAILY,DANCE,' +
  'DATED,DEALT,DEATH,DEBUT,DELAY,DEPTH,DOING,DOUBT,DOZEN,DRAFT,DRAMA,DRANK,DRAWN,DREAM,DRESS,DRILL,DRINK,DRIVE,DROVE,DRUNK,' +
  'EAGER,EARLY,EARTH,EIGHT,ELITE,EMPTY,ENEMY,ENJOY,ENTER,ENTRY,EQUAL,ERROR,EVENT,EVERY,EXACT,EXIST,EXTRA,FAITH,FALSE,FAULT,' +
  'FIBER,FIELD,FIFTH,FIFTY,FIGHT,FINAL,FIRST,FIXED,FLASH,FLEET,FLOOR,FLUID,FOCUS,FORCE,FORTH,FORTY,FORUM,FOUND,FRAME,FRANK,' +
  'FRAUD,FRESH,FRONT,FROST,FRUIT,FULLY,FUNNY,GIANT,GIVEN,GLASS,GLOBE,GOING,GRACE,GRADE,GRAND,GRANT,GRASS,GREAT,GREEN,GROSS,' +
  'GROUP,GROWN,GUARD,GUESS,GUEST,GUIDE,HAPPY,HARRY,HEART,HEAVY,HORSE,HOTEL,HOUSE,HUMAN,IDEAL,IMAGE,INDEX,INNER,INPUT,ISSUE,' +
  'JAPAN,JIMMY,JOINT,JONES,JUDGE,KNIFE,KNOWN,LABEL,LARGE,LASER,LATER,LAUGH,LAYER,LEARN,LEASE,LEAST,LEAVE,LEGAL,LEVEL,LEWIS,' +
  'LIGHT,LIMIT,LINKS,LIVES,LOCAL,LOGIC,LOOSE,LOWER,LUCKY,LUNCH,LYING,MAGIC,MAJOR,MAKER,MARCH,MARIA,MATCH,MAYBE,MAYOR,MEANT,' +
  'MEDIA,METAL,MIGHT,MINOR,MINUS,MIXED,MODEL,MONEY,MONTH,MORAL,MOTOR,MOUNT,MOUSE,MOUTH,MOVIE,MUSIC,NEEDS,NEVER,NEWLY,NIGHT,' +
  'NOISE,NORTH,NOTED,NOVEL,NURSE,OCCUR,OCEAN,OFFER,OFTEN,ORDER,OTHER,OUGHT,PAINT,PANEL,PAPER,PARTY,PEACE,PHASE,PHONE,PHOTO,' +
  'PIANO,PIECE,PILOT,PITCH,PLACE,PLAIN,PLANE,PLANT,PLATE,POINT,POUND,POWER,PRESS,PRICE,PRIDE,PRIME,PRINT,PRIOR,PRIZE,PROOF,' +
  'PROUD,PROVE,QUEEN,QUICK,QUIET,QUITE,RADIO,RAISE,RANGE,RAPID,RATIO,REACH,READY,REFER,RIGHT,RIVAL,RIVER,ROBIN,ROMAN,ROUGH,' +
  'ROUND,ROUTE,ROYAL,RURAL,SCALE,SCENE,SCOPE,SCORE,SENSE,SERVE,SEVEN,SHALL,SHAPE,SHARE,SHARP,SHEET,SHELF,SHELL,SHIFT,SHIRT,' +
  'SHOCK,SHOOT,SHORT,SHOWN,SIGHT,SILLY,SINCE,SIXTH,SIXTY,SIZED,SKILL,SLEEP,SLIDE,SMALL,SMART,SMILE,SMITH,SMOKE,SOLID,SOLVE,' +
  'SORRY,SOUND,SOUTH,SPACE,SPARE,SPEAK,SPEED,SPEND,SPENT,SPLIT,SPOKE,SPORT,STAFF,STAGE,STAKE,STAND,START,STATE,STEAM,STEEL'
).split(',')

const WORDS_6 = (
  'ACCEPT,ACCESS,ACROSS,ACTING,ACTION,ACTIVE,ACTUAL,ADVICE,ADVISE,AFFECT,AFRAID,AGENCY,AGENDA,ALMOST,ALWAYS,AMOUNT,ANIMAL,ANNUAL,ANSWER,ANYONE,' +
  'ANYWAY,APPEAL,APPEAR,AROUND,ARRIVE,ARTIST,ASPECT,ASSESS,ASSIST,ASSUME,ATTACH,ATTACK,ATTEND,AUGUST,AUTHOR,AVENUE,BACKED,BARELY,BATTLE,BEAUTY,' +
  'BECAME,BECOME,BEFORE,BEHIND,BELIEF,BELONG,BERLIN,BETTER,BEYOND,BISHOP,BORDER,BOTTLE,BOTTOM,BOUGHT,BRANCH,BREATH,BRIDGE,BRIGHT,BROKEN,BUDGET,' +
  'BURDEN,BUREAU,BUTTON,CAMERA,CAMPUS,CANCER,CANNOT,CARBON,CAREER,CASTLE,CASUAL,CAUGHT,CENTER,CENTRE,CHANCE,CHANGE,CHARGE,CHOICE,CHOOSE,CHOSEN,' +
  'CHURCH,CIRCLE,CLIENT,CLOSED,CLOSER,COFFEE,COLUMN,COMBAT,COMING,COMMIT,COMMON,COMPLY,COPPER,CORNER,COSTLY,COUNTY,COUPLE,COURSE,COVERS,CREATE,' +
  'CREDIT,CRISIS,CUSTOM,DAMAGE,DANGER,DEALER,DEBATE,DECADE,DECIDE,DEFEAT,DEFEND,DEFINE,DEGREE,DEMAND,DEPEND,DEPUTY,DESERT,DESIGN,DESIRE,DETAIL,' +
  'DETECT,DEVICE,DIFFER,DINNER,DIRECT,DOCTOR,DOLLAR,DOMAIN,DOUBLE,DRIVEN,DRIVER,DURING,EASILY,EATING,EDITOR,EFFECT,EFFORT,EIGHTH,EITHER,ELEVEN,' +
  'EMERGE,EMPIRE,EMPLOY,ENABLE,ENDING,ENERGY,ENGAGE,ENGINE,ENOUGH,ENSURE,ENTIRE,ENTITY,EQUITY,ESCAPE,ESTATE,ETHNIC,EUROPE,EVOLVE,EXPECT,EXPERT,' +
  'EXPORT,EXTEND,EXTENT,FABRIC,FACING,FACTOR,FAILED,FAIRLY,FALLEN,FAMILY,FAMOUS,FATHER,FELLOW,FEMALE,FIGURE,FILING,FINGER,FINISH,FISCAL,FLIGHT,' +
  'FLYING,FOLLOW,FORCED,FOREST,FORGET,FORMAL,FORMAT,FORMER,FOSTER,FOUGHT,FOURTH,FRENCH,FRIEND,FUTURE,GARDEN,GATHER,GENDER,GENTLE,GLOBAL,GOLDEN,' +
  'GROUND,GROWTH,GUILTY,HANDED,HANDLE,HAPPEN,HARDLY,HEADED,HEALTH,HEARTS,HEIGHT,HIDDEN,HOLDER,HONEST,HOPING,HUNTER,IMPACT,IMPORT,INCOME,INDEED,' +
  'INJURY,INSIDE,INTEND,INTENT,INVEST,ISLAND,JERSEY,JOSEPH,JUNIOR,KILLED,KILLER,LADDER,LARGER,LATELY,LATEST,LATTER,LAUNCH,LAWYER,LEADER,LEAGUE,' +
  'LEAVES,LEGACY,LEGEND,LENGTH,LESSON,LETTER,LIKELY,LINKED,LIQUID,LITTLE,LIVING,LOCATE,LOOKED,LOSING,MAINLY,MAKING,MANAGE,MANNER,MARGIN,MARKED,' +
  'MARKET,MASTER,MATTER,MATURE,MEDIUM,MEMBER,MEMORY,MENTAL,MERELY,METHOD,MIDDLE,MILLER,MINING,MINUTE,MIRROR,MOBILE,MODERN,MODEST,MODULE,MOMENT,' +
  'MOSTLY,MOTHER,MOTION,MOVING,MURDER,MUTUAL,MYSELF,NARROW,NATION,NATIVE,NATURE,NEARBY,NEARLY,NICELY,NOBODY,NORMAL,NOTICE,NOTION,NUMBER,OBJECT,' +
  'OBTAIN,OFFICE,OFFSET,ONLINE,OPTION,ORANGE,ORIGIN,OTHERS,OUTPUT,PACKED,PARENT,PARTLY,PEOPLE,PERIOD,PERMIT,PERSON,PHRASE,PLANET,PLAYER,PLEASE,' +
  'POLICE,POLICY,PRAYER,PREFER,PRETTY,PRINCE,PRISON,PROFIT,PROPER,PUBLIC,PURELY,PURPLE,PURSUE,PUSHED,PUTTING,QUIET,QUOTED,RAISED,RANDOM,RARELY'
).split(',').filter(w => w.length === 6)

function getWords(len: number): string[] {
  if (len === 4) return WORDS_4
  if (len === 5) return WORDS_5
  return WORDS_6
}

function evaluate(guess: string, secret: string): LetterState[] {
  const n = secret.length
  const result: LetterState[] = Array(n).fill('absent')
  const used = Array(n).fill(false)
  for (let i = 0; i < n; i++) {
    if (guess[i] === secret[i]) {
      result[i] = 'correct'
      used[i] = true
    }
  }
  for (let i = 0; i < n; i++) {
    if (result[i] === 'correct') continue
    for (let j = 0; j < n; j++) {
      if (!used[j] && guess[i] === secret[j]) {
        result[i] = 'present'
        used[j] = true
        break
      }
    }
  }
  return result
}

const KEY_ROWS = [
  'QWERTYUIOP'.split(''),
  'ASDFGHJKL'.split(''),
  ['ENTER', ...'ZXCVBNM'.split(''), 'BACK'],
]

const STATE_BG: Record<LetterState, string> = {
  correct: 'bg-fun-green text-white border-fun-green',
  present: 'bg-fun-yellow text-white border-fun-yellow',
  absent: 'bg-fun-muted text-white border-fun-muted',
  empty: 'bg-fun-card text-fun-text border-fun-border',
}

export default function Wordle({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const cfg = CONFIG[level]

  const [secret, setSecret] = useState<string>(() => {
    const w = getWords(CONFIG['中等'].len)
    return w[Math.floor(Math.random() * w.length)]
  })
  const [guesses, setGuesses] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const [status, setStatus] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle')
  const [toast, setToast] = useState('')

  const startTimeRef = useRef(0)
  const submittedRef = useRef(false)
  const statusRef = useRef(status)
  statusRef.current = status

  const submitEnd = useCallback(
    async (result: 'win' | 'lose', score: number) => {
      if (!userId || submittedRef.current) return
      submittedRef.current = true
      const dur = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
      try {
        await createRecord(userId, { gameId, score, duration: dur, result })
      } catch {}
    },
    [userId, gameId]
  )

  const reset = useCallback(() => {
    const w = getWords(CONFIG[level].len)
    setSecret(w[Math.floor(Math.random() * w.length)])
    setGuesses([])
    setCurrent('')
    setStatus('idle')
    statusRef.current = 'idle'
    submittedRef.current = false
    setToast('')
  }, [level])

  useEffect(() => {
    reset()
  }, [level, reset])

  const showToast = (t: string) => {
    setToast(t)
    window.setTimeout(() => setToast(''), 1200)
  }

  const ensurePlaying = () => {
    if (statusRef.current === 'idle') {
      startTimeRef.current = Date.now()
      statusRef.current = 'playing'
      setStatus('playing')
    }
  }

  const submitGuess = useCallback(() => {
    const st = statusRef.current
    if (st !== 'playing' && st !== 'idle') return
    if (current.length !== cfg.len) {
      showToast(`需要 ${cfg.len} 个字母`)
      return
    }
    ensurePlaying()
    const guess = current.toUpperCase()
    const nextGuesses = [...guesses, guess]
    setGuesses(nextGuesses)
    setCurrent('')
    if (guess === secret) {
      setStatus('won')
      statusRef.current = 'won'
      const remaining = cfg.tries - nextGuesses.length
      void submitEnd('win', (remaining + 1) * 100)
    } else if (nextGuesses.length >= cfg.tries) {
      setStatus('lost')
      statusRef.current = 'lost'
      void submitEnd('lose', 0)
    }
  }, [current, guesses, cfg.len, cfg.tries, secret, submitEnd])

  const onKeyPress = useCallback(
    (key: string) => {
      if (statusRef.current === 'won' || statusRef.current === 'lost') return
      ensurePlaying()
      if (key === 'ENTER') {
        submitGuess()
      } else if (key === 'BACK') {
        setCurrent(c => c.slice(0, -1))
      } else if (/^[A-Z]$/.test(key)) {
        setCurrent(c => (c.length < cfg.len ? c + key : c))
      }
    },
    [cfg.len, submitGuess]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Enter') {
        e.preventDefault()
        onKeyPress('ENTER')
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        onKeyPress('BACK')
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        onKeyPress(e.key.toUpperCase())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeyPress])

  // 计算键盘字母当前最佳状态
  const keyState: Record<string, LetterState> = {}
  for (const g of guesses) {
    const r = evaluate(g, secret)
    for (let i = 0; i < g.length; i++) {
      const prev = keyState[g[i]]
      const next = r[i]
      if (next === 'correct' || (next === 'present' && prev !== 'correct') || !prev) {
        if (!prev || next === 'correct' || (next === 'present' && prev === 'absent')) {
          keyState[g[i]] = next
        }
      }
    }
  }

  const rows: { letters: string[]; states: LetterState[] }[] = []
  for (let r = 0; r < cfg.tries; r++) {
    const letters = Array(cfg.len).fill('')
    const states: LetterState[] = Array(cfg.len).fill('empty')
    if (r < guesses.length) {
      const g = guesses[r]
      const ev = evaluate(g, secret)
      for (let i = 0; i < cfg.len; i++) {
        letters[i] = g[i]
        states[i] = ev[i]
      }
    } else if (r === guesses.length && (status === 'playing' || status === 'idle')) {
      for (let i = 0; i < cfg.len; i++) {
        letters[i] = current[i] ?? ''
      }
    }
    rows.push({ letters, states })
  }

  const pickingIdle = status === 'idle' || status === 'won' || status === 'lost'

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {(['简单', '中等', '复杂'] as const).map(lv => (
          <button
            key={lv}
            type="button"
            disabled={!pickingIdle}
            onClick={() => setLevel(lv)}
            className={`px-4 py-2 rounded-full text-sm font-black border-2 transition-all ${
              level === lv
                ? 'bg-fun-purple text-white border-fun-purple'
                : 'border-fun-border text-fun-text bg-fun-bg hover:border-fun-purple/50'
            } ${!pickingIdle ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {lv}
            {lv === '简单' && ' · 4字母'}
            {lv === '中等' && ' · 5字母'}
            {lv === '复杂' && ' · 6字母·5次'}
          </button>
        ))}
      </div>

      {toast && (
        <div className="px-4 py-2 rounded-full bg-fun-text text-white text-sm font-bold shadow-card">
          {toast}
        </div>
      )}

      <div className="grid gap-1.5">
        {rows.map((row, r) => (
          <div key={r} className="flex gap-1.5">
            {row.letters.map((l, i) => (
              <div
                key={i}
                className={`w-12 h-12 flex items-center justify-center rounded-xl border-2 font-black text-xl shadow-card ${STATE_BG[row.states[i]]}`}
              >
                {l}
              </div>
            ))}
          </div>
        ))}
      </div>

      {status === 'won' && (
        <div className="px-4 py-2 rounded-2xl bg-green-50 border-2 border-fun-green text-fun-green font-black">
          🎉 猜中了！答案就是 {secret}
        </div>
      )}
      {status === 'lost' && (
        <div className="px-4 py-2 rounded-2xl bg-red-50 border-2 border-red-300 text-red-500 font-black">
          😢 答案是 {secret}
        </div>
      )}

      <div className="flex flex-col gap-1.5 mt-1">
        {KEY_ROWS.map((row, r) => (
          <div key={r} className="flex gap-1 justify-center">
            {row.map(k => {
              const isSpecial = k === 'ENTER' || k === 'BACK'
              const label = k === 'BACK' ? '⌫' : k === 'ENTER' ? '↵' : k
              const state = keyState[k] ?? 'empty'
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onKeyPress(k)}
                  className={`h-10 rounded-lg font-black text-sm border-2 shadow-btn transition-all active:scale-95 ${
                    isSpecial ? 'w-12 bg-fun-bg border-fun-border text-fun-text' : `w-8 ${STATE_BG[state]}`
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {(status === 'won' || status === 'lost') && (
        <button
          type="button"
          onClick={reset}
          className="px-6 py-2 rounded-full bg-fun-accent text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
        >
          换个新词
        </button>
      )}
    </div>
  )
}
