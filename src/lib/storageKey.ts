export function shopStorageFolder(shopId: string): string {
  const bytes = new TextEncoder().encode(shopId);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return `shop-${hex}`;
}

export function safeImageExtension(fileName: string, fallback: 'jpg' | 'png' = 'jpg'): string {
  const raw = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (/^(jpg|jpeg|png|webp|gif)$/.test(raw)) return raw;
  return fallback;
}
