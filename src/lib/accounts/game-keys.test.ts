import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAccountGameKeys, saveGameNickname } from './game-keys';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('game key client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests the account game keys', async () => {
    const items = [
      { gameHash: '00421873', lifeStatus: 'alive', nickname: 'Cozy' },
      { gameHash: '00421874', lifeStatus: 'dead', nickname: null },
    ];
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ items }));
    vi.stubGlobal('fetch', fetch);
    await expect(listAccountGameKeys()).resolves.toEqual(items);
    expect(fetch).toHaveBeenCalledWith('/api/me/game-keys', {
      credentials: 'same-origin',
    });
  });

  it('saves a trimmed nickname for one game key', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ gameHash: '00421873', nickname: 'Cozy' }),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(saveGameNickname('00421873', '  Cozy ')).resolves.toBe('Cozy');
    expect(fetch).toHaveBeenCalledWith('/api/games/current/nickname', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-game-key': '00421873' },
      body: JSON.stringify({ nickname: 'Cozy' }),
    });
  });

  it('reports failed requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    await expect(listAccountGameKeys()).rejects.toThrow();
    await expect(saveGameNickname('00421873', 'Cozy')).rejects.toThrow();
  });
});
