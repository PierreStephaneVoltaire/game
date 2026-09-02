import { InvalidRequestError } from './errors.js';

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(value: unknown): string {
  if (typeof value !== 'string') throw new InvalidRequestError();
  const username = value.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) throw new InvalidRequestError();
  return username;
}

export function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    throw new InvalidRequestError();
  return value;
}

export function parseCredentials(value: unknown): {
  username: string;
  password: string;
} {
  if (!value || typeof value !== 'object') throw new InvalidRequestError();
  const record = value as Record<string, unknown>;
  return {
    username: normalizeUsername(record.username),
    password: validatePassword(record.password),
  };
}
