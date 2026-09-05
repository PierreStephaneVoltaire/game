import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AccountRequestError,
  credentialsAreValid,
  currentAccount,
  loginAccount,
  logoutAccount,
  registerAccount,
  restoreAccount,
  resetPassword,
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

  it('sends password login through the account API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        user: { userId: 'user-1', username: 'player_1' },
        serverNow: '2026-08-30T20:00:00.000Z',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await loginAccount('Player_1', 'short');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'player_1',
        password: 'short',
      }),
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
    });
  });

  it('rejects invalid credentials before sending a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(credentialsAreValid('', '')).toBe(false);
    expect(credentialsAreValid('player_1', 'short')).toBe(true);
    expect(credentialsAreValid('player_1', 'x'.repeat(129))).toBe(false);
    await expect(registerAccount('player_1', 'short')).rejects.toEqual(
      new AccountRequestError(
        'INVALID_REQUEST',
        'Use at least 8 characters for a new password.',
      ),
    );
    await expect(loginAccount('', '')).rejects.toEqual(
      new AccountRequestError(
        'INVALID_REQUEST',
        'Enter a valid username and password.',
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('accepts eight-character passwords for registration and reset', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        jsonResponse({ user: { userId: 'user-1', username: 'player_1' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await registerAccount('Player_1', 'abcdefgh');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      username: 'player_1',
      password: 'abcdefgh',
    });
    await resetPassword('reset-token', 'abcdefgh');
    await expect(registerAccount('player_1', 'abcdefg')).rejects.toThrow(
      'at least 8',
    );
    await expect(resetPassword('reset-token', 'abcdefg')).rejects.toThrow(
      '8–128',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces stable API errors and clears state on logout', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid username or password.',
            },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ serverNow: '2026-08-30T20:00:00.000Z' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      loginAccount('player_1', 'incorrect password'),
    ).rejects.toEqual(
      new AccountRequestError(
        'INVALID_CREDENTIALS',
        'Invalid username or password.',
      ),
    );
    currentAccount.set({ userId: 'user-1', username: 'player_1' });
    await expect(logoutAccount()).resolves.toBeUndefined();
    expect(get(currentAccount)).toBeNull();
  });
});
