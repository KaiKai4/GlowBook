// Marco y estado vacio compartidos por los graficos de reportes.

export function ChartFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-brand-100 bg-surface p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        <p className="mt-1 text-sm text-fg-subtle">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function EmptyChart({ label = "Aún no hay datos para graficar." }: { label?: string }) {
  return <p className="py-20 text-center text-sm text-fg-subtle">{label}</p>;
}
