export type Change = {
  path: Array<string | number>;
  value?: unknown;
  remove?: true;
  appendText?: true;
};

export function stateChanges(
  before: unknown,
  after: unknown,
  path: Change['path'] = [],
): Change[] {
  if (Object.is(before, after)) return [];
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    Array.isArray(before) === Array.isArray(after)
  ) {
    if (Array.isArray(before) && Array.isArray(after)) {
      const changes = after.flatMap((value, index) =>
        stateChanges(before[index], value, [...path, index]),
      );
      if (before.length > after.length)
        changes.push({ path: [...path, 'length'], value: after.length });
      return changes;
    }
    const previous = before as Record<string, unknown>;
    const next = after as Record<string, unknown>;
    return [
      ...Object.keys(previous)
        .filter((key) => !(key in next))
        .map((key) => ({ path: [...path, key], remove: true as const })),
      ...Object.entries(next).flatMap(([key, value]) =>
        Object.hasOwn(previous, key)
          ? stateChanges(previous[key], value, [...path, key])
          : [{ path: [...path, key], value: structuredClone(value) }],
      ),
    ];
  }
  return [{ path, value: structuredClone(after) }];
}

export function applyChanges<T>(state: T, changes: Change[]): T {
  let next = structuredClone(state);
  for (const change of changes) {
    if (
      change.path.some((key) =>
        ['__proto__', 'prototype', 'constructor'].includes(String(key)),
      )
    )
      throw new Error('Invalid trace path.');
    if (!change.path.length) {
      next = structuredClone(change.value) as T;
      continue;
    }
    let target = next as Record<string | number, unknown>;
    for (const key of change.path.slice(0, -1)) {
      const child = target[key] as typeof target;
      target[key] = Array.isArray(child) ? [...child] : { ...child };
      target = target[key] as typeof target;
    }
    const key = change.path.at(-1)!;
    if (change.remove) delete target[key];
    else if (change.appendText)
      target[key] = String(target[key]) + String(change.value);
    else target[key] = structuredClone(change.value);
  }
  return next;
}
