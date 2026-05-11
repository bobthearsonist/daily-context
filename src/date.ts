export function normalizeDate(value: string): string {
  const trimmed = value.trim();
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  const dashed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dashed) {
    return trimmed;
  }

  throw new Error(`Expected date as YYYY-MM-DD or YYYYMMDD, got '${value}'.`);
}

export function compactDate(value: string): string {
  return normalizeDate(value).replace(/-/g, "");
}

export function dateTag(value: string): string {
  const [year, month, day] = normalizeDate(value).split("-");
  return `date/${year}/${month}/${day}`;
}
