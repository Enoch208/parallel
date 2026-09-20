export function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Index ${String(index)} is outside a list of ${String(items.length)}`);
  }
  return item;
}

export function valueFor<K, V>(map: ReadonlyMap<K, V>, key: K, label: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new RangeError(`Unknown ${label}: ${String(key)}`);
  }
  return value;
}
