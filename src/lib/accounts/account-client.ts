import { writable } from 'svelte/store';

export type Account = {
  userId: string;
  username: string;
  providers?: string[];
  hasPassword?: boolean;
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

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function credentialsAreValid(
  username: string,
  password: string,
): boolean {
  return (
    USERNAME_PATTERN.test(username.trim().toLowerCase()) &&
    password.length >= 1 &&
    password.length <= 128
  );
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

async function authenticate(
  action: 'login' | 'register',
  username: string,
  password: string,
): Promise<Account> {
  if (!credentialsAreValid(username, password))
    throw new AccountRequestError(
      'INVALID_REQUEST',
      'Enter a valid username and password.',
    );
  if (action === 'register' && password.length < 8)
    throw new AccountRequestError(
      'INVALID_REQUEST',
      'Use at least 8 characters for a new password.',
    );
  const result = await accountRequest(`/api/auth/${action}`, {
    method: 'POST',
    body: JSON.stringify({
      username: username.trim().toLowerCase(),
      password,
    }),
  });
  currentAccount.set(result.user);
  return result.user;
}

export function registerAccount(
  username: string,
  password: string,
): Promise<Account> {
  return authenticate('register', username, password);
}

export function beginDiscordLogin(): void {
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

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 8 || newPassword.length > 128)
    throw new AccountRequestError(
      'INVALID_REQUEST',
      'Password must be 8–128 characters.',
    );
  await accountRequest('/api/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export function loginAccount(
  username: string,
  password: string,
): Promise<Account> {
  return authenticate('login', username, password);
}

export async function logoutAccount(): Promise<void> {
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
