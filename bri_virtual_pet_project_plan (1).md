# Bri Virtual Pet — High-Level Project Plan

## Goal

Build a small, non-commercial VTuber-inspired virtual pet website where players care for Bri, discover her preferences, and try to keep their "wife" alive.

The project should work across desktop and mobile without requiring traditional user accounts.

## Core Experience

- Create a pet/save using a username and short recovery code.
- Continue the same save from another device.
- Manage Bri's basic needs:
  - Food
  - Sleep
  - Health
  - Mental health / attention
- Buy and use items.
- Discover which foods Bri will or will not eat.
- Trigger random events that can affect her state.
- Allow Bri to sometimes ignore the player or refuse interaction.
- Track death and restart cycles.
- Show previous deaths in a graveyard with:
  - Debut date
  - Death date
  - Cause of death
  - Humorous death message
  - "WIFE DIED" presentation

## Save Model

- No email, OAuth, or normal sign-in.
- Player receives:
  - Username
  - 8-digit recovery code
- Server stores the canonical save state.
- Every save has a monotonically increasing version.
- Client changes are submitted against the version they were created from.
- Stale writes are rejected and the client reloads the latest state.
- Requests use idempotency IDs so retries cannot apply the same action twice.

## Game Simulation

- Most simulation logic runs in the browser.
- Passive changes are calculated from elapsed time rather than continuous server-side timers.
- The client can generate:
  - Hunger changes
  - Sleep changes
  - Attention events
  - Random events
  - Item interactions
- Multiple local changes may be bundled into a single save request.
- The server primarily handles persistence, version validation, recovery, and timestamps.

## Initial Technical Direction

### Frontend

- React + TypeScript
- Responsive web UI
- Local cached state for fast interactions
- Pixel-art based presentation

### Backend

- Azure Functions
- Small HTTP API for:
  - Save creation
  - Save recovery
  - Loading state
  - Versioned state updates
  - Graveyard/history

### Storage

A low-cost Azure datastore containing:

- Current pet state
- Save version
- Recovery credentials
- Important timestamps
- Graveyard/history
- Optional recent action history

The exact database should be selected based primarily on free-tier and low-traffic cost characteristics.

## Infrastructure

Manage infrastructure as code and use the project as an Azure learning exercise.

- Terraform
- GitHub Actions
- Azure OIDC authentication
- Azure Static Web Apps or equivalent static hosting
- Azure Functions
- Managed Azure storage/database
- Basic logging and cost alerts

## Art

### POC

Use temporary AI-generated pixel-art assets so development is not blocked.

### Final

Replace temporary assets with commissioned pixel art before the final public version where practical.

Avoid copying existing official artwork or branding directly.

## Development Phases

### Phase 1 — POC

- Basic Bri sprite
- Hunger, sleep, health, and attention
- Time-based decay
- Food interaction
- Death state
- Graveyard
- Local-only save

### Phase 2 — Persistence

- Username + recovery code
- Server-side save
- Cross-device recovery
- Save versioning
- Stale-state rejection
- Idempotent updates

### Phase 3 — Personality

- Full food preference dataset
- Shopping/inventory
- Random events
- Room isolation
- Variable attention needs
- Refused interactions
- Bri-specific dialogue and jokes

### Phase 4 — Presentation

- Final pixel art
- Animations
- Better mobile UI
- Sound if appropriate
- Polished death/graveyard screens

### Phase 5 — Release

- Infrastructure deployment
- Cost limits and alerts
- Basic rate limiting
- Community testing
- Public release or showcase video

## Non-Goals

For the initial release:

- No monetization
- No traditional account system
- No competitive multiplayer
- No leaderboard requiring anti-cheat
- No complex server-side real-time simulation
- No mobile app; responsive web only

## Success Criteria

The project is successful if:

- A player can create a Bri, close the site, and resume later.
- A player can move between PC and mobile safely.
- Two devices cannot silently overwrite each other's newer state.
- Bri's behavior feels unpredictable and personality-driven.
- The site remains inexpensive to operate at community-scale traffic.
