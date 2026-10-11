import { writable } from 'svelte/store';
import { isLocalDevelopment } from '$lib/local-development';

export type Account = {
  userId: string;
  username: string;
  providers?: string[];
};

type AccountResponse = {
  user: Account;
  serverNow: string;
};

type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class AccountRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const currentAccount = writable<Account | null>(null);

const LOCAL_ACCOUNT_KEY = 'local-development-account';
const LOCAL_USERNAME = 'local';

function localAccount(): Account | null {
  if (!isLocalDevelopment()) return null;
  try {
    return window.localStorage.getItem(LOCAL_ACCOUNT_KEY)
      ? {
          userId: 'local-development',
          username: window.localStorage.getItem(LOCAL_ACCOUNT_KEY)!,
        }
      : null;
  } catch {
    return null;
  }
}

function setLocalAccount(username: string | null): Account | null {
  if (!isLocalDevelopment()) return null;
  try {
    if (username) window.localStorage.setItem(LOCAL_ACCOUNT_KEY, username);
    else window.localStorage.removeItem(LOCAL_ACCOUNT_KEY);
  } catch {
    return null;
  }
  const account = username ? { userId: 'local-development', username } : null;
  currentAccount.set(account);
  return account;
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function accountRequest(
  path: string,
  init?: RequestInit,
): Promise<AccountResponse> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const body = (await responseBody(response)) as
    AccountResponse | ErrorResponse | null;
  if (!response.ok) {
    const failure = body as ErrorResponse | null;
    throw new AccountRequestError(
      failure?.error?.code ?? 'ACCOUNT_REQUEST_FAILED',
      failure?.error?.message ?? 'The account request failed.',
    );
  }
  return body as AccountResponse;
}

export async function restoreAccount(): Promise<Account | null> {
  if (isLocalDevelopment()) {
    const account = localAccount();
    currentAccount.set(account);
    return account;
  }
  try {
    const result = await accountRequest('/api/me');
    currentAccount.set(result.user);
    return result.user;
  } catch (error) {
    currentAccount.set(null);
    if (
      error instanceof AccountRequestError &&
      (error.code === 'AUTHENTICATION_REQUIRED' ||
        error.code === 'UNAUTHORIZED')
    ) {
      return null;
    }
    throw error;
  }
}

export function beginDiscordLogin(): void {
  if (isLocalDevelopment() && setLocalAccount(LOCAL_USERNAME)) {
    window.location.assign('/key');
    return;
  }
  window.location.assign('/api/auth/discord');
}

export async function completeDiscordOnboarding(
  onboardingToken: string,
  username: string,
): Promise<Account> {
  if (!/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase()))
    throw new AccountRequestError('INVALID_REQUEST', 'Enter a valid username.');
  const result = await accountRequest('/api/auth/discord/complete', {
    method: 'POST',
    body: JSON.stringify({
      onboardingToken,
      username: username.trim().toLowerCase(),
    }),
  });
  currentAccount.set(result.user);
  return result.user;
}

export async function logoutAccount(): Promise<void> {
  if (isLocalDevelopment()) {
    setLocalAccount(null);
    return;
  }
  try {
    await accountRequest('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    if (
      !(error instanceof AccountRequestError) ||
      (error.code !== 'AUTHENTICATION_REQUIRED' &&
        error.code !== 'UNAUTHORIZED')
    )
      throw error;
  } finally {
    currentAccount.set(null);
  }
}
