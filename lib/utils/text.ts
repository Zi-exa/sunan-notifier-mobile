const NAMED_ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntity(entity: string): string {
  const normalized = entity.trim().toLowerCase();

  if (normalized.startsWith('#x')) {
    const code = Number.parseInt(normalized.slice(2), 16);
    if (!Number.isNaN(code)) {
      return String.fromCodePoint(code);
    }
  }

  if (normalized.startsWith('#')) {
    const code = Number.parseInt(normalized.slice(1), 10);
    if (!Number.isNaN(code)) {
      return String.fromCodePoint(code);
    }
  }

  return NAMED_ENTITY_MAP[normalized] ?? `&${entity};`;
}

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&([^;]+);/g, (_fullMatch, entity: string) => decodeEntity(entity));
}

export function stripHtmlTags(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
}

export function sanitizeRichText(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const withoutTags = stripHtmlTags(value);
  const decoded = decodeHtmlEntities(withoutTags);
  const normalized = decoded
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalized.length > 0 ? normalized : undefined;
}
