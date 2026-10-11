# Infomaniak deployment

## Requirements

- an Infomaniak Node.js site using Node.js 22.12 or newer;
- a MariaDB database and dedicated application user;
- a writable private media directory outside the public web root;
- production environment variables based on `.env.example`;
- Python dependencies only when cartoonisation is enabled.

## Node.js Manager configuration

Source directory:

```text
/srv/customer/sites/eh-passport.ch
```

Build command:

```sh
git pull --ff-only origin main && npm ci --no-audit --no-fund && npm run db:init && npm run build
```

Start command:

```sh
npm start
```

After changing code or environment variables, run **Build** and then **Restart** in Infomaniak Node.js Manager. Running `git pull` over SSH updates the source but does not replace the already-running Node process.

## First deployment

1. Copy `.env.example` to the server-side `.env` and set production values.
2. Generate a unique `MEDIA_SIGNING_SECRET` of at least 24 random characters.
3. Set `PUBLISHED_ORIGIN` to the HTTPS production domain.
4. Create `MEDIA_ROOT` outside the public site directory and grant the Node.js application write access.
5. Run the configured build command.
6. Run `npm run db:create-admin` from an interactive SSH console and answer the email, name and temporary-password prompts. The password is hidden while typing and is never stored in shell history.
7. Start the application and test login, a public passport, an image and a video on a phone.

## Cartooniser

Follow `Cartooniser/USAGE.txt`, then set `CARTOONISER_PYTHON` to the working Python executable. The website remains usable if the cartooniser is not installed; only the optional filter is unavailable.

## Rollback

Use Git to select the last known-good commit, rebuild in Node.js Manager and restart. Database migrations must remain backwards-compatible because `db:init` is intentionally non-destructive.
