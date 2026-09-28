export function GameCardSkeleton() {
  return (
    <div className="library-card min-h-[236px] animate-pulse" aria-hidden="true">
      <div className="mb-3 h-[30px] w-[30px] rounded bg-[#eeeee3]" />
      <div className="mb-3 h-6 w-2/3 rounded bg-[#e5e7da]" />
      <div className="mb-2 h-4 w-full rounded bg-[#eeeee3]" />
      <div className="mb-4 h-4 w-5/6 rounded bg-[#eeeee3]" />
      <div className="mb-3 flex gap-2">
        <div className="h-5 w-12 rounded bg-[#eeeee3]" />
        <div className="h-5 w-12 rounded bg-[#eeeee3]" />
      </div>
      <div className="mt-auto border-t border-[#e5dfd1] pt-3">
        <div className="h-4 w-16 rounded bg-[#eeeee3]" />
      </div>
    </div>
  )
}
