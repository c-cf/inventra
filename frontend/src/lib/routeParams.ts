/** A route segment as a positive integer id, or null when it is not one. */
export function parsePositiveId(raw: string | undefined): number | null {
  return raw !== undefined && /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : null;
}
