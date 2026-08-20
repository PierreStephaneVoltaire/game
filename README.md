# Virtual Pet

A small, static starter site for a colorful virtual pet project.

## Requirements

- Node.js 24.14.0
- Corepack-enabled pnpm 11.22.0
- TypeScript 5.9 with strict checking

All Svelte components use `<script lang="ts">`. Route modules use `.ts` files, and
`svelte-check` runs as part of the standard verification commands.

## Local development

```sh
corepack enable
pnpm install
pnpm dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.

## Verification

```sh
pnpm check
pnpm lint
pnpm format
pnpm build
pnpm preview
```

The current site is fully static. It has no Azure credentials, API calls, persistence, generated art, or external image and font dependencies.

Set the surprise pet name locally without committing it:

```sh
cp .env.example .env
```

Then set `PUBLIC_PET_NAME` in `.env` before running or building.

Visible copy lives in `src/lib/i18n/en.ts`; add another locale module there when translations are needed.

## Project direction

The next persistence milestone will add an Azure Functions API and Azure Table Storage. Browser code will never receive the storage connection string or directly write save data.
