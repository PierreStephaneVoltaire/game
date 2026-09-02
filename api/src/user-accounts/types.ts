export type SafeUser = {
  userId: string;
  username: string;
};

export type UserEntity = {
  partitionKey: 'USER';
  rowKey: string;
  userId: string;
  passwordHash: string;
  gameHashesJson: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
};

export type SessionEntity = {
  partitionKey: 'SESSION';
  rowKey: string;
  username: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export interface UserRepository {
  create(user: UserEntity): Promise<void>;
  find(username: string): Promise<UserEntity | null>;
}

export interface SessionRepository {
  create(session: SessionEntity): Promise<void>;
  find(tokenHash: string): Promise<SessionEntity | null>;
  delete(tokenHash: string): Promise<void>;
}

export type AuthenticatedSession = {
  user: SafeUser;
  token: string;
  expiresAt: Date;
};
