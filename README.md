# EH Passport

EH Passport creates communication passports for people with communication disabilities. A resident’s public passport can be opened from a QR code or NFC badge; authorised staff manage profiles, media and caregiver accounts from the private back office.

The interface is in French and is designed for phones, accessibility and use in care settings.

## Main features

- public passports with resettable, non-indexed links;
- QR code and NFC badge workflow;
- administrator and caregiver accounts;
- image, GIF, audio and looping video dictionary entries;
- optional video cartoonisation for administrators;
- downloadable profile and badge PDFs;
- archived profiles and accounts;
- private media served through expiring signed URLs;
- optional restriction to Swiss IP addresses.

## Technology

- Node.js 22.12+
- TanStack Start, React, TypeScript and Vite
- MariaDB
- local private media storage in the current deployment
- optional Python, TensorFlow Lite, OpenCV and PyAV cartoonisation pipeline

## Start locally

You need Node.js 22.12 or newer and access to a MariaDB database.

```sh
git clone git@github.com:fatfat123-arch/Hackahealth26_Eben.git
cd Hackahealth26_Eben
npm ci
cp .env.example .env
```

Edit `.env` with your local database credentials, then initialise the database and first administrator:

```sh
npm run db:init
npm run db:create-admin
npm run dev
```

`db:create-admin` asks interactively for the administrator’s email, name and temporary password; the password is hidden while typing.

Open [http://localhost:8080](http://localhost:8080). The fictional demonstration profile is available at `/demo`.

Never commit `.env`, database credentials, uploaded resident media or generated builds.

## Where to make changes

| Area                                        | Location                     |
| ------------------------------------------- | ---------------------------- |
| Pages and URLs                              | `src/routes/`                |
| Back-office components                      | `src/components/backoffice/` |
| Public passport and media players           | `src/components/passport/`   |
| Shared business rules                       | `src/lib/`                   |
| Authentication, database and media services | `src/server/`                |
| Database schema                             | `database/schema.sql`        |
| Safe schema upgrades                        | `scripts/init-db.mjs`        |
| Global styles                               | `src/styles.css`             |
| Images, mascots, fonts and tutorial media   | `src/assets/`                |
| Automated tests                             | `src/test/`                  |
| Python cartoonisation                       | `Cartooniser/`               |
| Production configuration template           | `.env.example`               |

TanStack Start uses file-based routing. `src/routeTree.gen.ts` is generated automatically and must not be edited manually. See `src/routes/README.md` for route naming conventions.

## Commands

```sh
npm run dev              # development server on port 8080
npm run typecheck        # TypeScript verification
npm test                 # complete test suite
npm run lint             # ESLint
npm run build            # production build
npm run check            # lint, types, tests and production build
npm run db:init          # create or safely update the schema
npm run db:create-admin  # create/reset the administrator from ADMIN_* variables
npm run ip-ranges:update # refresh Swiss IP ranges from RIPE NCC
npm start                # run the compiled production application
```

Run `npm run check` before pushing or deploying.

## Configuration

Copy `.env.example` to `.env`. The important settings are:

| Variable                                                  | Purpose                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MariaDB connection                                           |
| `MEDIA_ROOT`                                              | Private directory containing uploaded files                  |
| `MEDIA_SIGNING_SECRET`                                    | Secret used for expiring media URLs; minimum 24 characters   |
| `PUBLISHED_ORIGIN`                                        | Public origin used in QR and NFC links                       |
| `SWISS_IP_ONLY`                                           | Set to `true` to restrict requests to Swiss IP ranges        |
| `LOGIN_RATE_LIMIT_*`                                      | Login protection settings                                    |
| `CARTOONISER_*`                                           | Optional Python executable, upload size and timeout settings |

More details are available in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Data and privacy

Real resident data belongs in MariaDB and the private media directory, never in Git. `src/data/passport.ts` contains only the fictional demonstration profile. Public passport responses expose the calculated age rather than the complete birth date.

## Cartooniser

The website works without the optional filter. To enable it, install the Python dependencies and configure `CARTOONISER_PYTHON`. Full instructions are in [Cartooniser/USAGE.txt](Cartooniser/USAGE.txt).
