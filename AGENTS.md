# Project guidance

- Use npm and keep `package-lock.json` as the only dependency lockfile.
- Keep production compatible with Node.js 22.12+ and Infomaniak Node.js Builder.
- Store application data in MariaDB through `src/server/db.server.ts`; schema setup belongs in `database/schema.sql` and `scripts/init-db.mjs`.
- Never commit `.env`, credentials, uploaded patient media, generated builds, or experiment output.
- Keep public passport data access server-side and issue expiring signed URLs for private media.
- Keep the fictional demonstration profile in `src/data/passport.ts`; real profiles come from MariaDB.
- Preserve French interface copy, keyboard accessibility, readable contrast, and large interaction targets.
- Render public sections through the shared `PassportView` and dictionary media through `DictionaryGrid`/`DictionaryMedia`.
- Keep mascot artwork centralized in `src/components/mascot.tsx`.
- Keep tutorial screenshot enlargement and annotations in `TutorialPhotos` using the unmodified source images.
- Keep the Cartooniser optional. Uploads must work when it is not selected or unavailable.
- Run `npx tsc --noEmit`, `npm test`, and `npm run build` before deployment.
