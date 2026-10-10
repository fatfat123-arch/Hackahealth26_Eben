# EH Passport

Communication passports for people with communication disabilities, built for
the Eben-Hézer HackaHealth 2026 challenge.

The application provides:

- public, QR-accessible communication passports;
- a French administration space for staff and caregivers;
- image, GIF, audio, and video dictionary entries;
- optional video cartoonisation during upload;
- QR-code and NFC setup guidance.

## Stack

- TanStack Start, React, TypeScript, and Vite
- Node.js on Infomaniak
- MariaDB for accounts, sessions, roles, and passports
- private media storage with expiring signed links
- Python/TensorFlow Lite cartoonisation pipeline

## Local development

Requires Node.js 22.12 or newer.

```sh
npm install
cp .env.example .env
npm run db:init
npm run db:create-admin
npm run dev
```

The application is available at `http://localhost:8080`. The fictional public
profile used for demonstrations is at `/demo`.

## Commands

```sh
npm run dev             # start the development server
npm run build           # create the production build
npm start               # run the production build using .env
npm test                # run automated tests
npm run lint            # run ESLint
npm run db:init         # create/update the MariaDB schema
npm run db:create-admin # create or reset an administrator
```

## Production

Production is hosted at [eh-passport.ch](https://eh-passport.ch) with
Infomaniak Node.js Builder. Environment variables are documented in
`.env.example`; real credentials must remain in the server-side `.env` file.

Build command:

```sh
npm install --no-audit --no-fund && npm run build
```

Start command:

```sh
npm start
```

Optional HTTP Basic protection is configured in the server-side `.env` file:

```text
HTTP_BASIC_AUTH_USERNAME=eh-passport
HTTP_BASIC_AUTH_PASSWORD=choose-a-strong-password
```

The protection is enabled only when `HTTP_BASIC_AUTH_PASSWORD` is set. The
password must never be committed to Git.

## Cartooniser

The optional media-processing pipeline lives in `Cartooniser/`. See
`Cartooniser/USAGE.txt` for setup and usage instructions.

Production settings:

```text
CARTOONISER_PYTHON=/absolute/path/to/python
CARTOONISER_MAX_BYTES=104857600
CARTOONISER_TIMEOUT_MS=900000
```
