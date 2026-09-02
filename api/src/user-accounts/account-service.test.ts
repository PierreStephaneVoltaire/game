import { HttpRequest, type InvocationContext } from '@azure/functions';
import { describe, expect, it, vi } from 'vitest';
import { AccountService, hashToken } from './account-service.js';
import { InvalidCredentialsError, UsernameTakenError } from './errors.js';
import { createAccountHandlers } from './http.js';
import { PasswordService } from './password-service.js';
import type {
  SessionEntity,
  SessionRepository,
  UserEntity,
  UserRepository,
} from './types.js';
import { normalizeUsername, validatePassword } from './validation.js';

class MemoryUsers implements UserRepository {
  readonly values = new Map<string, UserEntity>();

  async create(user: UserEntity): Promise<void> {
    if (this.values.has(user.rowKey)) throw new UsernameTakenError();
    this.values.set(user.rowKey, user);
  }

  async find(username: string): Promise<UserEntity | null> {
    return this.values.get(username) ?? null;
  }
}

class MemorySessions implements SessionRepository {
  readonly values = new Map<string, SessionEntity>();

  async create(session: SessionEntity): Promise<void> {
    this.values.set(session.rowKey, session);
  }

  async find(tokenHash: string): Promise<SessionEntity | null> {
    return this.values.get(tokenHash) ?? null;
  }

  async delete(tokenHash: string): Promise<void> {
    this.values.delete(tokenHash);
  }
}

function service(now = new Date('2026-08-30T20:00:00.000Z')): {
  accounts: AccountService;
  users: MemoryUsers;
  sessions: MemorySessions;
} {
  const users = new MemoryUsers();
  const sessions = new MemorySessions();
  return {
    accounts: new AccountService({
      users,
      sessions,
      passwords: new PasswordService((size) => Buffer.alloc(size, 7)),
      now: () => now,
      randomBytes: (size) => Buffer.alloc(size, 9),
      randomUuid: () => '00000000-0000-4000-8000-000000000001',
    }),
    users,
    sessions,
  };
}

function context(): InvocationContext {
  return {
    invocationId: 'request-1',
    error: vi.fn(),
  } as unknown as InvocationContext;
}

function request(
  route: string,
  body?: unknown,
  headers: Record<string, string> = {},
  baseUrl = 'https://pet.example',
): HttpRequest {
  return new HttpRequest({
    method: body === undefined ? 'GET' : 'POST',
    url: `${baseUrl}/api/${route}`,
    headers: {
      origin: 'https://pet.example',
      host: 'pet.example',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : { string: JSON.stringify(body) },
  });
}

describe('password accounts', () => {
  it('normalizes usernames and enforces credential boundaries', () => {
    expect(normalizeUsername('  Player_1 ')).toBe('player_1');
    expect(() => normalizeUsername('bad-name')).toThrow();
    expect(validatePassword('a'.repeat(12))).toHaveLength(12);
    expect(validatePassword('a'.repeat(128))).toHaveLength(128);
    expect(() => validatePassword('a'.repeat(11))).toThrow();
    expect(() => validatePassword('a'.repeat(129))).toThrow();
  });

  it('hashes passwords and verifies only the matching value', async () => {
    const passwords = new PasswordService((size) => Buffer.alloc(size, 4));
    const encoded = await passwords.hash('correct horse battery staple');
    expect(encoded).not.toContain('correct horse battery staple');
    await expect(
      passwords.verify('correct horse battery staple', encoded),
    ).resolves.toBe(true);
    await expect(passwords.verify('incorrect password', encoded)).resolves.toBe(
      false,
    );
  });

  it('creates a user and stores only the session-token hash', async () => {
    const { accounts, users, sessions } = service();
    const result = await accounts.register(
      'player_1',
      'correct horse battery staple',
    );
    const user = users.values.get('player_1');
    expect(user).toMatchObject({
      partitionKey: 'USER',
      rowKey: 'player_1',
      gameHashesJson: '[]',
      schemaVersion: 1,
    });
    expect(user?.passwordHash).not.toContain('correct horse battery staple');
    expect(sessions.values.has(result.token)).toBe(false);
    expect(sessions.values.has(hashToken(result.token))).toBe(true);
    await expect(accounts.authenticate(result.token)).resolves.toEqual(
      result.user,
    );
  });

  it('rejects duplicate normalized usernames and removes logged-out sessions', async () => {
    const { accounts, sessions } = service();
    const created = await accounts.register(
      'player_1',
      'correct horse battery staple',
    );
    await expect(
      accounts.register('player_1', 'another secure password'),
    ).rejects.toBeInstanceOf(UsernameTakenError);
    await expect(accounts.logout(created.token)).resolves.toBe(true);
    expect(sessions.values.size).toBe(0);
    await expect(accounts.authenticate(created.token)).resolves.toBeNull();
  });

  it('uses the same failure for unknown users and wrong passwords', async () => {
    const { accounts } = service();
    await accounts.register('player_1', 'correct horse battery staple');
    await expect(
      accounts.login('player_1', 'incorrect password'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      accounts.login('missing_user', 'incorrect password'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('expires and removes old sessions', async () => {
    const started = new Date('2026-08-30T20:00:00.000Z');
    let now = started;
    const users = new MemoryUsers();
    const sessions = new MemorySessions();
    const accounts = new AccountService({
      users,
      sessions,
      passwords: new PasswordService((size) => Buffer.alloc(size, 7)),
      now: () => now,
      randomBytes: (size) => Buffer.alloc(size, 9),
      randomUuid: () => '00000000-0000-4000-8000-000000000001',
    });
    const created = await accounts.register(
      'player_1',
      'correct horse battery staple',
    );
    now = new Date(created.expiresAt.getTime() + 1);
    await expect(accounts.authenticate(created.token)).resolves.toBeNull();
    expect(sessions.values).toHaveLength(0);
  });

  it('returns secure account cookies and rejects cross-origin mutations', async () => {
    const { accounts } = service();
    const handlers = createAccountHandlers(accounts);
    const registered = await handlers.register(
      request('auth/register', {
        username: 'Player_1',
        password: 'correct horse battery staple',
      }),
      context(),
    );
    expect(registered.status).toBe(201);
    expect(registered.cookies?.[0]).toMatchObject({
      name: 'virtual_pet_session',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    });
    const rejected = await handlers.login(
      request(
        'auth/login',
        { username: 'player_1', password: 'correct horse battery staple' },
        { origin: 'https://attacker.example' },
      ),
      context(),
    );
    expect(rejected.status).toBe(403);
    expect(rejected.jsonBody).toMatchObject({
      error: { code: 'INVALID_ORIGIN' },
    });
  });

  it('accepts the configured public origin behind the managed proxy', async () => {
    vi.stubEnv('APP_BASE_URL', 'https://pet.example');
    const { accounts } = service();
    const registered = await createAccountHandlers(accounts).register(
      request(
        'auth/register',
        {
          username: 'player_1',
          password: 'correct horse battery staple',
        },
        { host: 'internal.functions.example' },
        'https://internal.functions.example',
      ),
      context(),
    );
    expect(registered.status).toBe(201);
    vi.unstubAllEnvs();
  });
});
