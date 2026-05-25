"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UnsavedChangesContextValue {
  // Each editing component registers itself by id, so several dirty forms on the
  // same page are tracked independently (e.g. multiple role cards).
  setDirty: (id: string, dirty: boolean) => void;
  // Sidebar (and any other navigation) routes through this. If something is dirty
  // it opens the confirmation modal instead of navigating immediately.
  confirmNavigate: (href: string) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dirtySources = useRef<Set<string>>(new Set());
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const setDirty = useCallback((id: string, dirty: boolean) => {
    if (dirty) dirtySources.current.add(id);
    else dirtySources.current.delete(id);
  }, []);

  const confirmNavigate = useCallback(
    (href: string) => {
      if (dirtySources.current.size > 0) {
        setPendingHref(href);
      } else {
        router.push(href);
      }
    },
    [router]
  );

  // Native warning for full-page exits (tab close / reload / browser back).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtySources.current.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function leaveWithoutSaving() {
    const href = pendingHref;
    dirtySources.current.clear();
    setPendingHref(null);
    if (href) router.push(href);
  }

  return (
    <UnsavedChangesContext.Provider value={{ setDirty, confirmNavigate }}>
      {children}
      <Dialog
        open={pendingHref !== null}
        onClose={() => setPendingHref(null)}
        title="Cambios sin guardar"
      >
        <div className="space-y-5">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-sm text-stone-600">
              Hiciste cambios que todavía no has guardado. Si sales de esta sección
              ahora, esos cambios se perderán.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingHref(null)}>
              Seguir editando
            </Button>
            <Button variant="destructive" onClick={leaveWithoutSaving}>
              Salir sin guardar
            </Button>
          </div>
        </div>
      </Dialog>
    </UnsavedChangesContext.Provider>
  );
}

// Call from an editing component with its current dirty state. Registers/clears
// automatically and cleans up on unmount.
export function useUnsavedChanges(dirty: boolean) {
  const ctx = useContext(UnsavedChangesContext);
  const id = useId();
  useEffect(() => {
    ctx?.setDirty(id, dirty);
    return () => ctx?.setDirty(id, false);
  }, [ctx, id, dirty]);
}

// Returns the guarded navigation function (null if no provider is mounted).
export function useNavigationGuard() {
  return useContext(UnsavedChangesContext)?.confirmNavigate ?? null;
}
