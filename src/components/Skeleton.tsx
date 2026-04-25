export function GameCardSkeleton() {
  return (
    <div className="bg-fun-card border-2 border-fun-border rounded-3xl overflow-hidden">
      <div className="relative h-44 bg-fun-border animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-5 w-2/3 bg-fun-border rounded animate-pulse" />
        <div className="h-4 w-full bg-fun-border rounded animate-pulse" />
        <div className="h-4 w-4/5 bg-fun-border rounded animate-pulse" />
        <div className="flex gap-2 pt-2">
          <div className="h-5 w-12 bg-fun-border rounded-full animate-pulse" />
          <div className="h-5 w-12 bg-fun-border rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}
