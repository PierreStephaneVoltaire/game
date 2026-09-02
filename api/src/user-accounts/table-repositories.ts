import { TableClient, type TableEntity } from '@azure/data-tables';
import { UsernameTakenError } from './errors.js';
import type {
  SessionEntity,
  SessionRepository,
  UserEntity,
  UserRepository,
} from './types.js';

function statusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return (error as { statusCode?: number }).statusCode;
}

async function findEntity<T extends object>(
  client: TableClient,
  partitionKey: string,
  rowKey: string,
): Promise<TableEntity<T> | null> {
  try {
    return (await client.getEntity<T>(
      partitionKey,
      rowKey,
    )) as unknown as TableEntity<T>;
  } catch (error) {
    if (statusCode(error) === 404) return null;
    throw error;
  }
}

export class AzureUserRepository implements UserRepository {
  constructor(private readonly client: TableClient) {}

  async create(user: UserEntity): Promise<void> {
    try {
      await this.client.createEntity(user);
    } catch (error) {
      if (statusCode(error) === 409) throw new UsernameTakenError();
      throw error;
    }
  }

  async find(username: string): Promise<UserEntity | null> {
    const entity = await findEntity<UserEntity>(this.client, 'USER', username);
    return entity ? (entity as UserEntity) : null;
  }
}

export class AzureSessionRepository implements SessionRepository {
  constructor(private readonly client: TableClient) {}

  async create(session: SessionEntity): Promise<void> {
    await this.client.createEntity(session);
  }

  async find(tokenHash: string): Promise<SessionEntity | null> {
    const entity = await findEntity<SessionEntity>(
      this.client,
      'SESSION',
      tokenHash,
    );
    return entity ? (entity as SessionEntity) : null;
  }

  async delete(tokenHash: string): Promise<void> {
    try {
      await this.client.deleteEntity('SESSION', tokenHash);
    } catch (error) {
      if (statusCode(error) !== 404) throw error;
    }
  }
}

export function createAccountRepositories(environment = process.env): {
  users: UserRepository;
  sessions: SessionRepository;
} {
  const connectionString = environment.AZURE_STORAGE_CONNECTION_STRING;
  const usersTable = environment.USERS_TABLE;
  const authRecordsTable = environment.AUTH_RECORDS_TABLE;
  if (!connectionString || !usersTable || !authRecordsTable)
    throw new Error('Account storage configuration is incomplete.');
  return {
    users: new AzureUserRepository(
      TableClient.fromConnectionString(connectionString, usersTable),
    ),
    sessions: new AzureSessionRepository(
      TableClient.fromConnectionString(connectionString, authRecordsTable),
    ),
  };
}
