# Virtual Pet

A static, session-only companion-care game built with SvelteKit and strict
TypeScript. A run supports Realtime and Streaming clocks, deterministic care and
autonomous events, a 226-item shop and inventory, room placement, persistent
statuses, streaming income and career progression, background projects,
complete in-memory history, and terminal graveyard presentation.

The app deliberately has no account recovery, persistence, backend, telemetry,
or runtime network API. Refreshing starts a fresh Realtime run. The clock mode
is chosen during sign-in and there is no in-app reset, restart, recovery, or
mode switch. Runs do not inherit keepsakes, debt, Followers, or unlocks.

## Requirements

- Node.js 24.14.0
- Corepack-enabled pnpm 11.22.0

## Run locally

```sh
corepack enable
pnpm install
pnpm dev
```

For the static production build:

```sh
pnpm build
pnpm preview
```

## Verification

```sh
pnpm validate:data
pnpm validate:assets
pnpm validate:product
pnpm check
pnpm lint
pnpm format
pnpm test
pnpm build
pnpm test:e2e
```

Catalogue nutrition and behavior are authored under
`src/lib/data/catalogue/` and compiled into the bundled game definition. All
gameplay uncertainty is derived from the displayed run seed; the simulation
does not use `Math.random()`.

The catalogue contains 110 Food, 2 Medicine, 3 Care, 73 Reusable, 23 Upgrade,
and 15 Decoration items. Nutrition research and exact primary-source records
are documented in `docs/research/FOOD_NUTRITION_SOURCES.md`.

See `docs/GAME_RULES.md` for the player-facing rules,
`docs/RULES_AND_FILES.md` for source ownership, and `CONTEXT.md` for the domain
vocabulary.

## Azure and Terraform credentials

The backend/Terraform deployment specification uses Azure Static Web Apps,
Azure Storage Tables, and an encrypted Azure Blob remote state backend. The
current frontend can still be run locally with the commands above; these
credentials are only needed when provisioning or deploying the cloud
environment.

### Local Terraform

Install the Azure CLI, Terraform 1.16.x, and the Azure Functions Core Tools if
you are also running the API locally. Sign in with an Azure identity that has
permission to create the resource group, Static Web App, storage account,
tables, and budget resources:

```sh
az login
az account list --output table
az account set --subscription "<AZURE_SUBSCRIPTION_ID>"
az account show --query '{subscription:id,tenant:tenantId,user:user.name}'
```

Terraform's AzureRM provider uses this Azure CLI session for local commands.
Do not put a client secret, storage connection string, OAuth secret, model API
key, or deployment token in the repository, shell history, frontend variables,
or checked-in `.tfvars` files.

### One-time state bootstrap

Terraform cannot create the remote backend that it is using. Bootstrap the
state storage first, using `infra/bootstrap`, then initialize the application
stack under `infra/environments/prod` with the `azurerm` backend. Use a stable
state key such as `virtual-pet/prod.tfstate` and migrate bootstrap state to
protected remote storage immediately.

Before running Terraform, provide the required non-secret inputs through the
environment-specific variable file or environment variables:

```text
environment
location
name_prefix
subscription_id
```

Keep any secret-bearing values in an ignored local file or a CI secret store.
The storage connection string and OAuth, email, and epitaph provider keys are
Terraform-sensitive values. The production storage account and canonical
tables must have deletion protection enabled.

Typical local checks are:

```sh
terraform -chdir=infra fmt -check -recursive
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
terraform -chdir=infra plan
```

Apply only a reviewed saved plan. Do not use an unreviewed
`terraform apply -auto-approve` for ordinary application commits.

### CI credentials with GitHub OIDC

For GitHub Actions, create an Azure app registration/service principal with a
federated credential matching this repository and its deployment branch or
environment. Grant it only the roles required by the Terraform scope: usually
`Contributor` on the target resource group or subscription, plus
`Storage Blob Data Contributor` on the remote-state storage account. Creating
role assignments requires the corresponding role-assignment permission, so
have an administrator create that assignment when the CI identity should not
have broad directory privileges.

Configure these as GitHub Actions variables/secrets rather than repository
files:

```text
ARM_USE_OIDC=true
ARM_CLIENT_ID=<application-client-id>
ARM_TENANT_ID=<directory-tenant-id>
ARM_SUBSCRIPTION_ID=<azure-subscription-id>
```

The workflow must request the `id-token: write` permission and authenticate
with Azure's official login action before `terraform init`, `plan`, or `apply`.
Use OIDC instead of a long-lived service-principal password. Keep any Static
Web Apps deployment token in the CI secret store only, mark sensitive outputs
as sensitive, and never print it in logs.

For local API development, copy
`api/local.settings.example.json` to `api/local.settings.json`, use local
Azurite credentials or explicitly configured development values, and keep the
real file gitignored. Production OAuth callbacks must be exact HTTPS URLs
registered with the providers; no public `VITE_` variable may contain a
backend secret.
