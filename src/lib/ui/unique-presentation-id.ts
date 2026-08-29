/**
 * Raw IDs should be unique, but rendered lists must remain usable if malformed
 * or legacy state contains a duplicate. Preserve every entry and suffix only
 * the presentation identity deterministically.
 */
export function uniquePresentationId(
  entries: readonly { id: string }[],
  requested: string,
): string {
  if (!entries.some((entry) => entry.id === requested)) return requested;
  let duplicate = 2;
  while (
    entries.some((entry) => entry.id === `${requested}:duplicate:${duplicate}`)
  )
    duplicate += 1;
  return `${requested}:duplicate:${duplicate}`;
}
