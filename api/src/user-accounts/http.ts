import type {
  Cookie,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { AccountService } from './account-service.js';
import {
  InvalidCredentialsError,
  InvalidRequestError,
  UsernameTakenError,
} from './errors.js';
import { parseCredentials } from './validation.js';

const COOKIE_NAME = 'virtual_pet_session';
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type Handler = (
  request: HttpRequest,
  context: InvocationContext,
) => Promise<HttpResponseInit>;

function response(
  status: number,
  jsonBody: unknown,
  cookies: Cookie[] = [],
): HttpResponseInit {
  return {
    status,
    jsonBody,
    cookies,
    headers: { 'content-type': 'application/json' },
  };
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  cookies: Cookie[] = [],
): HttpResponseInit {
  return response(status, { error: { code, message, requestId } }, cookies);
}

function sessionCookie(request: HttpRequest, value: string): Cookie {
  const forwardedProtocol = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  return {
    name: COOKIE_NAME,
    value,
    path: '/',
    httpOnly: true,
    secure:
      forwardedProtocol === 'https' ||
      new URL(request.url).protocol === 'https:',
    sameSite: 'Lax',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

function expiredSessionCookie(request: HttpRequest): Cookie {
  return { ...sessionCookie(request, ''), maxAge: 0 };
}

function cookieValue(request: HttpRequest, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name)
      return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

function sameOrigin(request: HttpRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const hosts = [
    new URL(request.url).host,
    request.headers.get('host'),
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim(),
    process.env.APP_BASE_URL
      ? new URL(process.env.APP_BASE_URL).host
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  return hosts.includes(originHost);
}

async function requestBody(request: HttpRequest): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json'))
    throw new InvalidRequestError();
  try {
    return await request.json();
  } catch {
    throw new InvalidRequestError();
  }
}

function serverNow(): string {
  return new Date().toISOString();
}

export function createAccountHandlers(service: AccountService): {
  register: Handler;
  login: Handler;
  logout: Handler;
  me: Handler;
} {
  const runCredentials =
    (action: 'register' | 'login'): Handler =>
    async (request, context) => {
      if (!sameOrigin(request))
        return errorResponse(
          403,
          'INVALID_ORIGIN',
          'The request origin is not allowed.',
          context.invocationId,
        );
      try {
        const credentials = parseCredentials(await requestBody(request));
        const session = await service[action](
          credentials.username,
          credentials.password,
        );
        return response(
          action === 'register' ? 201 : 200,
          { user: session.user, serverNow: serverNow() },
          [sessionCookie(request, session.token)],
        );
      } catch (error) {
        if (error instanceof InvalidRequestError)
          return errorResponse(
            400,
            'INVALID_REQUEST',
            'Enter a valid username and password.',
            context.invocationId,
          );
        if (error instanceof UsernameTakenError)
          return errorResponse(
            409,
            'USERNAME_TAKEN',
            'That username is already in use.',
            context.invocationId,
          );
        if (error instanceof InvalidCredentialsError)
          return errorResponse(
            401,
            'INVALID_CREDENTIALS',
            'Invalid username or password.',
            context.invocationId,
          );
        context.error(error);
        return errorResponse(
          500,
          'PERSISTENCE_ERROR',
          'The account service could not complete the request.',
          context.invocationId,
        );
      }
    };

  return {
    register: runCredentials('register'),
    login: runCredentials('login'),
    logout: async (request, context) => {
      const expired = expiredSessionCookie(request);
      if (!sameOrigin(request))
        return errorResponse(
          403,
          'INVALID_ORIGIN',
          'The request origin is not allowed.',
          context.invocationId,
          [expired],
        );
      try {
        const removed = await service.logout(cookieValue(request, COOKIE_NAME));
        if (!removed)
          return errorResponse(
            401,
            'AUTHENTICATION_REQUIRED',
            'Sign in to continue.',
            context.invocationId,
            [expired],
          );
        return response(200, { serverNow: serverNow() }, [expired]);
      } catch (error) {
        context.error(error);
        return errorResponse(
          500,
          'PERSISTENCE_ERROR',
          'The account service could not complete the request.',
          context.invocationId,
          [expired],
        );
      }
    },
    me: async (request, context) => {
      try {
        const user = await service.authenticate(
          cookieValue(request, COOKIE_NAME),
        );
        if (!user)
          return errorResponse(
            401,
            'AUTHENTICATION_REQUIRED',
            'Sign in to continue.',
            context.invocationId,
          );
        return response(200, { user, serverNow: serverNow() });
      } catch (error) {
        context.error(error);
        return errorResponse(
          500,
          'PERSISTENCE_ERROR',
          'The account service could not complete the request.',
          context.invocationId,
        );
      }
    },
  };
}
