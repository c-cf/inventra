const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCurrency(amount: number): string {
  return currency.format(amount);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * An API timestamp in the viewer's local time, as "YYYY-MM-DD HH:mm".
 * The API sends ISO 8601 in UTC ("2026-11-22T18:46:25Z"); a value without a zone
 * (how SQLite stores it) is treated as UTC too. Anything unparseable is returned as is.
 */
export function formatTimestamp(value: string): string {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
