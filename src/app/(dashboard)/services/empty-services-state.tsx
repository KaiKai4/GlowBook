import { Plus, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyServicesState({ onCreateCategory }: { onCreateCategory: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <Scissors className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm text-neutral-500">Crea tu primera categoria para empezar.</p>
      <Button variant="primary" className="mt-4" onClick={onCreateCategory}>
        <Plus className="h-4 w-4" />
        Nueva categoria
      </Button>
    </div>
  );
}
