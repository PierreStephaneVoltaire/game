import {
  createHash,
  randomBytes as nodeRandomBytes,
  randomUUID as nodeRandomUUID,
} from 'node:crypto';
import { InvalidCredentialsError } from './errors.js';
import { PasswordService } from './password-service.js';
import type {
  AuthenticatedSession,
  SafeUser,
  SessionEntity,
  SessionRepository,
  UserEntity,
  UserRepository,
} from './types.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_HASH = [
  'scrypt',
  '16384',
  '8',
  '1',
  Buffer.alloc(16).toString('base64url'),
  Buffer.alloc(64).toString('base64url'),
].join('$');

export type AccountServiceDependencies = {
  users: UserRepository;
  sessions: SessionRepository;
  passwords?: PasswordService;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
  randomUuid?: () => string;
};

export class AccountService {
  private readonly passwords: PasswordService;
  private readonly now: () => Date;
  private readonly randomBytes: (size: number) => Buffer;
  private readonly randomUuid: () => string;

  constructor(private readonly dependencies: AccountServiceDependencies) {
    this.passwords = dependencies.passwords ?? new PasswordService();
    this.now = dependencies.now ?? (() => new Date());
    this.randomBytes = dependencies.randomBytes ?? nodeRandomBytes;
    this.randomUuid = dependencies.randomUuid ?? nodeRandomUUID;
  }

  async register(
    username: string,
    password: string,
  ): Promise<AuthenticatedSession> {
    const now = this.now();
    const user: UserEntity = {
      partitionKey: 'USER',
      rowKey: username,
      userId: this.randomUuid(),
      passwordHash: await this.passwords.hash(password),
      gameHashesJson: '[]',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      schemaVersion: 1,
    };
    await this.dependencies.users.create(user);
    return this.createSession(user);
  }

  async login(
    username: string,
    password: string,
  ): Promise<AuthenticatedSession> {
    const user = await this.dependencies.users.find(username);
    const matches = await this.passwords.verify(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !matches) throw new InvalidCredentialsError();
    return this.createSession(user);
  }

  async authenticate(token: string | null): Promise<SafeUser | null> {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const session = await this.dependencies.sessions.find(tokenHash);
    if (!session) return null;
    if (Date.parse(session.expiresAt) <= this.now().getTime()) {
      await this.dependencies.sessions.delete(tokenHash);
      return null;
    }
    const user = await this.dependencies.users.find(session.username);
    if (!user || user.userId !== session.userId) return null;
    return { userId: user.userId, username: user.rowKey };
  }

  async logout(token: string | null): Promise<boolean> {
    if (!token) return false;
    const tokenHash = hashToken(token);
    const session = await this.dependencies.sessions.find(tokenHash);
    if (!session) return false;
    await this.dependencies.sessions.delete(tokenHash);
    return true;
  }

  private async createSession(user: UserEntity): Promise<AuthenticatedSession> {
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);
    const token = this.randomBytes(32).toString('base64url');
    const session: SessionEntity = {
      partitionKey: 'SESSION',
      rowKey: hashToken(token),
      username: user.rowKey,
      userId: user.userId,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    await this.dependencies.sessions.create(session);
    return {
      user: { userId: user.userId, username: user.rowKey },
      token,
      expiresAt,
    };
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
