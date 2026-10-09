import { Check, Store } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SalonNameState } from "./use-salon-name";

// Tarjeta "Información general": nombre del salón.
export function SalonGeneralCard({ name }: { name: SalonNameState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-4 w-4 text-brand-500" />
          Información general
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={name.saveName} className="space-y-4">
          <Input
            name="name"
            label="Nombre del salón"
            value={name.nameValue}
            onChange={(e) => name.editName(e.target.value)}
            required
            maxLength={120}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" loading={name.saving}>
              Guardar nombre
            </Button>
            {name.nameSaved && (
              <span className="flex items-center gap-1 text-sm text-success-fg">
                <Check className="h-4 w-4" /> Guardado
              </span>
            )}
          </div>
          {name.nameError && (
            <p className="rounded-lg bg-danger-subtle border border-danger-border px-3 py-2 text-sm text-danger-strong">
              {name.nameError}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
