export function mergeRecords(records: Array<Record<string, number>>) {
  const result: Record<string, number> = {};
  for (const record of records)
    for (const [key, value] of Object.entries(record))
      result[key] = (result[key] ?? 0) + value;
  return result;
}

export function frequency(values: string[]) {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function nullable(
  value: number | null,
  render: (value: number) => string,
) {
  return value === null ? '—' : render(value);
}

export function compact(value: number) {
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1_000) return `${value / 1_000}K`;
  return String(value);
}

export function integer(value: number | null) {
  return value === null ? '—' : Math.round(value).toLocaleString('en-US');
}

export function number(value: number, precision: number) {
  return value.toFixed(precision);
}

export function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function signed(value: number) {
  return value > 0 ? `+${integer(value)}` : integer(value);
}
