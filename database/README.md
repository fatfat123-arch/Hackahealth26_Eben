# Infomaniak MariaDB setup

L’application utilise MariaDB pour les comptes, les sessions, les rôles et les passeports des résidents. Les médias téléversés sont stockés hors de la racine web publique et servis au moyen d’URL signées à durée limitée.

Required environment variables are documented in `.env.example`. Use Node.js 22.12 or newer in Infomaniak Node Builder.

After installing dependencies, run `npm run db:init` once, then `npm run db:create-admin` to create the first administrator. Both commands read the database connection from the environment; do not commit `.env`.
