# Backend operations

The production backend is the native Python Azure Functions API in `api/`,
backed by Azure Database for PostgreSQL Flexible Server 17. Terraform uses the existing application
resource group and manages both the database and Static Web App. Operators run
initial table creation, content publication, and password reset commands; none of
those jobs run during an ordinary request.

The database uses burstable `B_Standard_B1ms`, 32 GiB storage, seven days of
backups, and no standby. This is a small PostgreSQL configuration, not a
verified cost saving over Azure SQL Basic; compare regional compute, storage,
backup, and any free-tier eligibility before applying.

## Secret bootstrap

Store these Static Web App settings as GitHub Actions secrets before the first
API deployment:

- `DISCORD_CLIENT_SECRET`: Discord application secret.
- `SIGNING_SECRET`: at least 32 random bytes encoded for use as the session and
  continuation-token signing key.
- `AZURE_DATABASE_CLIENT_ID` and `AZURE_DATABASE_CLIENT_SECRET`: credentials
  for a dedicated Entra application with only the PostgreSQL runtime role
  described below. Do not reuse the Azure deployment principal's credentials.

The application deployment workflow writes them to the Static Web App with the
Azure CLI. Terraform deliberately does not accept, output, manage, or read
these values. Do not expose these settings through a public frontend
environment prefix.

The Static Web App is managed by `infra/modules/static-app`. That module uses
the resource endpoint without reading the separate app-settings endpoint, so
secrets installed by the deployment workflow do not enter Terraform state.
Terraform outputs `non_secret_app_settings` containing `ENVIRONMENT`,
`APP_BASE_URL`, `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS`,
`DISCORD_CLIENT_ID`, `DISCORD_CALLBACK_URL`, the game limits, and the content
limits, plus `DATABASE_USERNAME` (default `vpet_api`). It derives a passwordless
`DATABASE_URL` from the PostgreSQL server, database, and administrator name and
applies the complete non-secret map to the Static Web App. Database-setup and
content-publication workflows read that Terraform-managed setting from Azure.

Set repository variables `AZURE_STATIC_WEB_APP_NAME` and
`AZURE_RESOURCE_GROUP_NAME`, plus the OIDC login secrets `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID`. Keep the existing
`AZURE_STATIC_WEB_APPS_API_TOKEN` deployment secret.

If the Static Web App already exists, import it into
`module.static_app.azapi_resource.this` before the first apply; do not create a
replacement app.

Terraform reads the resource-group name from `resource_group_name` and looks
up that existing group. The PostgreSQL module reads tenant and object IDs from
the active AzureRM client. Set `entra_admin_login` to that identity's exact
Entra principal name and `entra_admin_type` to `ServicePrincipal` (default) or
`User` for an interactive Terraform login. The identity running table creation and
publication must also be this administrator, or have a separately provisioned
PostgreSQL role with the required permissions.

The URL uses `postgresql+psycopg`, port 5432, and `sslmode=require`.
`backend.database.get_engine()` obtains an Entra token for each new physical
connection through `DefaultAzureCredential`, which refreshes expired tokens.
Azure-login workflows and local operators use their Azure CLI login. The
hosted API uses `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_SECRET`,
installed by the deployment workflow from the dedicated database identity
secrets and the existing tenant secret. Its `DATABASE_USERNAME` overrides the
administrator in the shared URL. The current managed Functions hosting does
not support managed identity; see the [Static Web Apps FAQ](https://learn.microsoft.com/en-us/azure/static-web-apps/faq).

After table creation, connect as the Entra administrator to the `postgres` database
and create the runtime role using the service principal's **object ID**, not
its client/application ID (replace the placeholder):

```sql
SELECT * FROM pgaadauth_create_principal_with_oid(
  'vpet_api', '<runtime-service-principal-object-id>', 'service', false, false
);
```

Then connect as the same administrator to the application database and grant:

```sql
GRANT USAGE ON SCHEMA public TO vpet_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vpet_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vpet_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vpet_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO vpet_api;
```

Use `database_runtime_username` consistently if overriding the role name.
Default privileges apply to objects created by the administrator executing
these statements. Microsoft documents the [Entra role mapping](https://learn.microsoft.com/en-us/azure/postgresql/security/security-manage-entra-users)
and [token authentication](https://learn.microsoft.com/en-us/azure/postgresql/security/security-connect-with-managed-identity).

## Initial database setup

After the user has run Terraform init/plan/apply, dispatch
`database-setup.yml`. It creates the initial tables from the SQLAlchemy models
against `DATABASE_URL`. The equivalent local command is:

```sh
PYTHONPATH=api python -c 'from backend.database import create_schema; create_schema()'
```

This is a fresh database setup. Table creation leaves existing tables alone;
it does not alter their structure. After setup, create the runtime role, publish
the first content bundle, and deploy the API. Repository policy leaves all
deployment actions to the user.

CI creates the same tables in a PostgreSQL 17 service and checks authentication,
reset/OAuth expiry, content publication, and game/event JSON persistence against
it. Unit tests retain their in-memory SQLite setup.

The firewall permits Azure-hosted clients with the existing `0.0.0.0` Azure
services rule; this includes Azure tenants other than your own, so Entra
authentication remains mandatory. Local operators or runners outside Azure
need their exact outbound IP allowed before connecting.

## First content publish

Dispatch `global-data-sync.yml` after the schema exists and before enabling
gameplay. The publisher validates the JSON authoring files, rejects bundles
larger than `CONTENT_BUNDLE_MAX_BYTES` (2 MiB by default), inserts an immutable
SQL bundle, and changes the `current` pointer in the same transaction. Revert a
bad content release by publishing or pointing `current` at a known-good
immutable version; do not edit an existing version row.

## Pull request previews

Pull requests targeting `main` deploy a separate Azure preview environment.
Terraform explicitly enables `stagingEnvironmentPolicy` on the Static Web App;
apply that setting before running the PR deployment. If staging environments
are disabled, Azure's deploy action can exit successfully without uploading.
The workflow therefore requires the action's deployment URL and publishes it
in the run summary. Use that URL for UI validation, not the production hostname.
Closing the PR removes its preview environment.

The API-secret configuration step currently runs only on pushes. Preview API
authentication also requires the appropriate environment settings and an exact
Discord callback registered for the preview hostname.

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
