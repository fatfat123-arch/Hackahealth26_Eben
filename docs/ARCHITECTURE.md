# Architecture

## Request flow

TanStack Start renders both public and authenticated routes. `src/server.ts` is the production entry point: it applies bot protection and the optional Swiss-IP restriction before forwarding requests to TanStack Start.

Public passport links use a random `public_id`, not the internal resident ID. The public loader fetches only the selected profile and converts private media paths into expiring signed URLs.

Authenticated server functions use the `eh_session` HTTP-only cookie. Sessions are stored in MariaDB as SHA-256 token hashes. Administrators can manage accounts and use the optional cartooniser; caregivers can manage resident content.

## Main areas

```text
src/routes/                 URL pages and API route adapters
src/components/backoffice/ profile/account administration UI
src/components/passport/   shared public passport and media UI
src/lib/                    domain models, validation and server functions
src/server/                 database, sessions, media and processing services
database/                   canonical MariaDB schema
scripts/                    repeatable operational scripts
Cartooniser/                isolated Python video-processing pipeline
```

## Data storage

MariaDB stores users, sessions and passports. Uploaded media is stored below `MEDIA_ROOT`, outside the public web root. Database records contain relative media paths only. `/api/media` verifies the URL signature and supports HTTP byte ranges for phone video playback.

The `dictionary` and the profile’s list sections are currently JSON columns. `section_order` also stores the visible order and custom sections configured from the back office. When editing their structure, update the types and mappings in `src/lib/patients.ts` and `src/lib/patients.functions.ts` together.

## Media flow

1. The browser validates type and size.
2. `/api/upload` repeats validation and writes the file below `MEDIA_ROOT`.
3. Only the relative path is saved with the resident.
4. The server creates short-lived signed URLs when a profile is loaded.
5. `/api/media` streams the file and supports range requests.

Cartoonisation is optional. The administrator selects an existing video, the Node server invokes `Cartooniser/cartoonise.py`, and the transformed MP4 is uploaded as a new media file. The original path is retained so the filter can be undone before saving.

## Database changes

`database/schema.sql` describes a fresh installation. `scripts/init-db.mjs` must remain safe to execute repeatedly against an existing database. Never deploy a schema change that exists in only one of these files.

## Tests

Vitest and Testing Library tests live in `src/test/`. Python timing tests live in `Cartooniser/tests/`. The JavaScript production gate is `npm run check`.
