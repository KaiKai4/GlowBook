export function buildCustomersHref({
  q,
  page,
}: {
  q?: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  const query = q?.trim();

  if (query) params.set("q", query);
  if (page && page > 1) params.set("page", String(page));

  const serialized = params.toString();
  return serialized ? `/customers?${serialized}` : "/customers";
}
