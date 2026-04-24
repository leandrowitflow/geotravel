export function takeSingle<T>(
  label: string,
  res: { data: T | null; error: { message: string } | null },
): NonNullable<T> {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  if (res.data == null) throw new Error(`${label}: no row`);
  return res.data;
}

export function takeRows<T>(
  label: string,
  res: { data: T[] | null; error: { message: string } | null },
): T[] {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data ?? [];
}

export function assertNoError(
  label: string,
  res: { error: { message: string } | null },
): void {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
}
