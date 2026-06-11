import { Skeleton } from "@/components/ui/skeleton";

export default function AppointmentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-brand-100 bg-white p-4">
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {Array.from({ length: 20 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      </div>
    </div>
  );
}
