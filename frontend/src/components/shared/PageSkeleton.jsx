/**
 * Full-page skeleton shown as Suspense fallback while lazy-loaded pages are
 * being fetched. Matches the PageWrapper layout so the shell doesn't jump.
 */
export default function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" role="status" aria-live="polite">
      {/* Title bar skeleton */}
      <div className="h-8 w-48 rounded-md bg-muted" />

      {/* Card skeletons */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-8 w-16 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="h-4 w-36 rounded bg-muted" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>

      <span className="sr-only">Pagina wordt geladen...</span>
    </div>
  );
}
