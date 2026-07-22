export function GameCardSkeleton() {
  return (
    <div className="min-h-[260px] overflow-hidden rounded-lg border-4 border-white bg-white shadow-[0_4px_0_#9ac6df,0_10px_24px_rgba(34,91,130,0.14)]">
      <div className="pixel-card-art relative h-36 animate-pulse bg-gradient-to-br from-[#c6f4ff] via-[#88d96f] to-[#63b7ff]" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-2/3 animate-pulse rounded-md bg-[#d9edf8]" />
        <div className="h-4 w-full animate-pulse rounded-md bg-[#e9f5ff]" />
        <div className="h-4 w-5/6 animate-pulse rounded-md bg-[#e9f5ff]" />
        <div className="flex gap-2 pt-1">
          <div className="h-7 w-16 animate-pulse rounded-md bg-[#e9f5ff]" />
          <div className="h-7 w-14 animate-pulse rounded-md bg-[#e9f5ff]" />
        </div>
        <div className="h-11 w-full animate-pulse rounded-lg bg-[#1275ee]/25" />
      </div>
    </div>
  )
}
