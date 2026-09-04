# Backend operations

The production backend is the native Python Azure Functions API in `api/`,
backed by one Azure SQL Database. Terraform uses the existing application
resource group and manages both the database and Static Web App. Operators run
database migrations, content publication, and password reset commands; none of
those jobs run during an ordinary request.

## Secret bootstrap

Store these Static Web App settings as GitHub Actions secrets before the first
API deployment:

- `DISCORD_CLIENT_SECRET`: Discord application secret.
- `SIGNING_SECRET`: at least 32 random bytes encoded for use as the session and
  continuation-token signing key.

The application deployment workflow writes them to the Static Web App with the
Azure CLI. Terraform deliberately does not accept, output, manage, or read
these values. Do not expose either setting through a public frontend
environment prefix.

The Static Web App is managed by `infra/modules/static-app`. That module uses
the resource endpoint without reading the separate app-settings endpoint, so
secrets installed by the deployment workflow do not enter Terraform state.
Terraform outputs `non_secret_app_settings` containing `ENVIRONMENT`,
`APP_BASE_URL`, `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS`,
`DISCORD_CLIENT_ID`, `DISCORD_CALLBACK_URL`, the game limits, and the content
limits. It derives `DATABASE_URL` from the managed SQL server and database and
applies the complete non-secret map to the Static Web App. Migration and
content-publication workflows read that Terraform-managed setting from Azure.

Set repository variables `AZURE_STATIC_WEB_APP_NAME` and
`AZURE_RESOURCE_GROUP_NAME`, plus the OIDC login secrets `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID`. Keep the existing
`AZURE_STATIC_WEB_APPS_API_TOKEN` deployment secret.

If the Static Web App already exists, import it into
`module.static_app.azapi_resource.this` before the first apply; do not create a
replacement app.

Terraform reads the resource-group name from `resource_group_name` and looks
up that existing group. The SQL module reads tenant and object IDs from the
active AzureRM client; only the administrator display name remains an explicit
non-secret input.

## Database creation and drift check

After the user has run Terraform init/plan/apply, dispatch
`database-migrate.yml`. It runs `alembic upgrade head` against `DATABASE_URL`.
CI independently upgrades a temporary database and runs `alembic check`, so a
model change without a corresponding migration fails before deployment.

Never run an Alembic downgrade against production. Roll application code back
while retaining the additive schema, then ship a corrective forward migration.

## First content publish

Dispatch `global-data-sync.yml` after the schema exists and before enabling
gameplay. The publisher validates the JSON authoring files, rejects bundles
larger than `CONTENT_BUNDLE_MAX_BYTES` (2 MiB by default), inserts an immutable
SQL bundle, and changes the `current` pointer in the same transaction. Revert a
bad content release by publishing or pointing `current` at a known-good
immutable version; do not edit an existing version row.

## Discord setup

Register the exact `DISCORD_CALLBACK_URL` with the Discord application. The API
uses Authlib for OAuth state validation and requests identity/profile data;
provider access tokens are discarded. Enable the frontend button only after a
production callback succeeds. Accounts are never linked by matching email.

## Manual password reset

There is no forgot-password endpoint or email service. Verify the player before
issuing a reset:

1. For a Discord-linked account, the request must come from the exact Discord
   user ID stored for that account.
2. For a password-only account with a contact handle, the request must arrive
   from that handle.
3. If neither exists, require convincing account details such as game hashes
   and pet names. If ownership cannot be established, the account is
   unrecoverable.

With production `DATABASE_URL` and `APP_BASE_URL` set, run:

```sh
PYTHONPATH=api python -m backend.auth.issue_reset USERNAME --issued-by ADMIN_HANDLE
```

The command invalidates prior unused tokens, stores only the SHA-256 digest,
and prints one URL. Deliver it privately to the verified player. It expires in
one hour, works once, changes the password to Argon2, and revokes every session
for that user. Never paste the raw link into logs, tickets, or public chat.
