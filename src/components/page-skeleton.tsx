import { Skeleton } from "@/components/ui/skeleton";

// Suspense fallback shaped like a page: title, a strip, then rows.
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-16 w-full max-w-lg" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
