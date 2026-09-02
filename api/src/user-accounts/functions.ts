import { app } from '@azure/functions';
import { AccountService } from './account-service.js';
import { createAccountHandlers } from './http.js';
import { createAccountRepositories } from './table-repositories.js';

const handlers = createAccountHandlers(
  new AccountService(createAccountRepositories()),
);

app.http('register', {
  route: 'auth/register',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: handlers.register,
});

app.http('login', {
  route: 'auth/login',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: handlers.login,
});

app.http('logout', {
  route: 'auth/logout',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: handlers.logout,
});

app.http('me', {
  route: 'me',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: handlers.me,
});
