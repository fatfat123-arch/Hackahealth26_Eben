<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Keep the public passport’s replaceable fictional profile and media references in `src/data/passport.ts`; the page must consume this single source rather than embed person-specific content throughout the UI.
- Use Radix multiple accordions for the public sections, with no default open values, to retain keyboard accessibility and independent expansion.
- Keep dictionary playback in a dedicated browser-safe component with user-controlled audio/video and a pause control for GIFs, so media remains accessible without introducing server dependencies.
- Render the primary main landmark in the root layout and define page-specific metadata on every content route to preserve accessible structure and sharing information.
- Patient passports live in the `patients` table (dictionary as jsonb, lists as text[]); `src/data/passport.ts` only feeds the demo page at `/demo`. Why: one shared, editable source for the back-office and `/passeport/$id`.
- The app entry point `/` is the staff login form, shared with `/connexion` through one component, so both addresses behave identically. Why: the back-office is the primary use of the app; the fictional demo passport is a sample reachable at `/demo`.
- Media sit in the private `passport-media` bucket and are stored as paths; URLs are signed at read time (staff via RLS, public page via a server function scoped to one patient id). Why: public buckets are blocked in this workspace and patients must not be listable.
- Roles (`admin`, `caregiver`) live in `user_roles` and are checked with `has_role`/`is_staff` in RLS; creating/editing caregiver accounts goes through admin-checked server functions. Why: permissions enforced server-side, never by hidden buttons.
- Back-office pages live under `src/routes/_authenticated/espace/`; public sign-ups are disabled so only admins create accounts.
- Enrich the public passport view object with contact display fields at the patient-to-view boundary without changing patient persistence or forms; keep unknown real contact identities unnamed to avoid misrepresenting who answers the stored number.
