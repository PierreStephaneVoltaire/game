import { isLocalDevelopment } from '$lib/local-development';
import { listLocalGames } from '$lib/persistence/games';

export type AccountGameKey = {
  gameHash: string;
  lifeStatus: 'alive' | 'dead';
  nickname: string | null;
};

export const NICKNAME_MAX_LENGTH = 40;

const LOCAL_NICKNAMES_KEY = 'local-development-game-nicknames';

function localNicknames(): Record<string, string> {
  try {
    return JSON.parse(
      window.localStorage.getItem(LOCAL_NICKNAMES_KEY) ?? '{}',
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

async function listLocalGameKeys(): Promise<AccountGameKey[]> {
  const nicknames = localNicknames();
  return (await listLocalGames()).map((game) => ({
    gameHash: game.gameHash,
    lifeStatus: game.state.ending?.kind === 'death' ? 'dead' : 'alive',
    nickname: nicknames[game.gameHash] ?? null,
  }));
}

export async function listAccountGameKeys(): Promise<AccountGameKey[]> {
  if (isLocalDevelopment()) return listLocalGameKeys();
  const response = await fetch('/api/me/game-keys', {
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('Could not load your game keys.');
  return ((await response.json()) as { items: AccountGameKey[] }).items;
}

export async function saveGameNickname(
  gameHash: string,
  nickname: string,
): Promise<string | null> {
  const trimmed = nickname.trim().slice(0, NICKNAME_MAX_LENGTH);
  if (isLocalDevelopment()) {
    const nicknames = localNicknames();
    if (trimmed) nicknames[gameHash] = trimmed;
    else delete nicknames[gameHash];
    try {
      window.localStorage.setItem(
        LOCAL_NICKNAMES_KEY,
        JSON.stringify(nicknames),
      );
    } catch {
      throw new Error('Could not save that nickname.');
    }
    return trimmed || null;
  }
  const response = await fetch('/api/games/current/nickname', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-game-key': gameHash },
    body: JSON.stringify({ nickname: trimmed }),
  });
  if (!response.ok) throw new Error('Could not save that nickname.');
  return ((await response.json()) as { nickname: string | null }).nickname;
}
