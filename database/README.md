# Infomaniak MariaDB setup

The application now uses MariaDB for accounts, sessions, roles and patient passports. Uploaded media is stored outside the public web root and served through expiring signed URLs.

Required environment variables are documented in `.env.example`. Use Node.js 22.12 or newer in Infomaniak Node Builder.

After installing dependencies, run `npm run db:init` once, then `npm run db:create-admin` to create the first administrator. Both commands read the database connection from the environment; do not commit `.env`.
