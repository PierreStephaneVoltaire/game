export async function withGameLock<T>(
  gameHash: string,
  operation: 'sync' | 'transition',
  task: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks)
    return await navigator.locks.request(`game:${gameHash}:${operation}`, task);
  return task();
}
