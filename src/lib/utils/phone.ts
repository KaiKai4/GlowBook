export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function formatWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizePhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
