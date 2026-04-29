export function GameCardSkeleton() {
  return (
    <div className="bg-crt-bg-card border-2 border-dashed border-crt-yellow/50 shadow-crt-card p-6 min-h-[260px] flex flex-col items-center justify-center gap-3">
      <div className="font-pixel text-[10px] text-crt-yellow animate-blink tracking-widest">
        NOW LOADING
      </div>
      <div className="font-mono-crt text-[18px] text-crt-cyan tracking-[0.3em]">
        ▓▓▓▓▓▒▒▒▒▒
      </div>
      <div className="font-mono-crt text-[12px] text-crt-text-dim tracking-widest">
        PLEASE WAIT...
      </div>
    </div>
  )
}
