export function isObjectWithKey<K extends PropertyKey>(
  value: unknown,
  key: K,
): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value;
}
