import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AccountRequestError,
  currentAccount,
  logoutAccount,
  restoreAccount,
} from './account-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('account client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    currentAccount.set(null);
  });

  it('restores the account without browser storage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          user: { userId: 'user-1', username: 'player_1' },
          serverNow: '2026-08-30T20:00:00.000Z',
        }),
      ),
    );
    await expect(restoreAccount()).resolves.toEqual({
      userId: 'user-1',
      username: 'player_1',
    });
    expect(get(currentAccount)?.username).toBe('player_1');
  });

  it('maps an unauthenticated restore to a signed-out account', async () => {
    currentAccount.set({ userId: 'user-1', username: 'player_1' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        jsonResponse(
          {
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Sign in to continue.',
            },
          },
          401,
        ),
      ),
    );
    await expect(restoreAccount()).resolves.toBeNull();
    expect(get(currentAccount)).toBeNull();
  });

  it('surfaces stable API errors and clears state on logout', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'The account service is unavailable.',
            },
          },
          503,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ serverNow: '2026-08-30T20:00:00.000Z' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(restoreAccount()).rejects.toEqual(
      new AccountRequestError(
        'SERVICE_UNAVAILABLE',
        'The account service is unavailable.',
      ),
    );
    currentAccount.set({ userId: 'user-1', username: 'player_1' });
    await expect(logoutAccount()).resolves.toBeUndefined();
    expect(get(currentAccount)).toBeNull();
  });
});
