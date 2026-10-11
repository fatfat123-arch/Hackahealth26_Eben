# Contributing

## Development workflow

1. Pull the latest `main` branch.
2. Create a short-lived branch for the change.
3. Keep secrets and real resident data outside Git.
4. Add or update tests for behavioural changes.
5. Run `npm run check`.
6. Open a pull request describing the user-visible change and deployment impact.

## Code conventions

- Use TypeScript and the `@/` alias for imports from `src/`.
- Keep server-only code in `src/server/` or files ending in `.server.ts`.
- Validate untrusted input both in the browser and on the server.
- Keep French interface wording clear and respectful.
- Preserve keyboard navigation, visible focus, contrast and large touch targets.
- Use `PassportView`, `DictionaryGrid` and `DictionaryMedia` for public and preview rendering.
- Put database changes in both `database/schema.sql` and the idempotent migration logic in `scripts/init-db.mjs`.
- Do not edit `src/routeTree.gen.ts`; Vite regenerates it from `src/routes/`.

## Before requesting review

```sh
npm run check
```

Also verify the changed journey on a desktop browser and an iPhone-sized viewport. Media changes should be tested with a real uploaded file, not only the demonstration assets.

## Production-sensitive changes

Call out changes involving:

- database schema or migrations;
- environment variables;
- authentication or public passport privacy;
- media paths or file formats;
- Python cartoonisation dependencies;
- the Infomaniak build or start command.
