# Movie Recommendation Application

A React + TypeScript single-page app that pulls movies from [The Movie Database (TMDB)](https://www.themoviedb.org/) into Supabase Postgres, lets users track which movies they've watched (with a rating and date), get a random recommendation by genre, export their lists to Excel, and — for admins — manage users/roles and view an audit log.

This is a rewrite of an earlier Flask/Postgres/Docker version. Supabase now provides the entire backend: managed Postgres, Auth, Row Level Security, and Edge Functions.

Languages: [English](#english) | [Magyar](#magyar)

---

<a name="english"></a>
## English

### How it works

* **The frontend** (`src/`) — a Vite + React + TypeScript SPA that talks directly to Supabase via `@supabase/supabase-js`. No app server of its own.
* **Supabase Postgres** — stores `profiles`/`roles`/`user_roles` (identity & RBAC on top of `auth.users`), `movies`/`genres`/`movie_genres` (the catalog), `user_movies` (each user's watch history/ratings), and `audit_log` (admin-only activity trail). Every table has Row Level Security enabled — see `supabase/migrations/`.
* **Supabase Auth** — email/password accounts (`auth.users`); a database trigger provisions a `profiles` row and the default `user` role on signup.
* **`supabase/functions/tmdb-sync`** — an Edge Function that holds the TMDB credential (never exposed to the browser), fetches genres/movies, and upserts them into Postgres. Invoked by the "Update" button on the Movies page and once daily via `pg_cron`.
* **`supabase/functions/admin-users`** — an Edge Function used only for account operations that require the Supabase Admin API (create user, delete user, reset another user's password). It re-checks the caller's admin role itself before touching anything.

```
Browser (React SPA) --supabase-js--> Supabase (Postgres + Auth + RLS)
                     --supabase-js--> Supabase Edge Functions (tmdb-sync, admin-users) --> TMDB API
```

### Project structure

* **`src/components/`** — Shared UI: `Navbar`, `Layout`, `AuthLayout`, the two route guards (`ProtectedRoute`, `AdminRoute` — UX-only, Row Level Security is the real enforcement), `MovieTable`, `RatingDialog`.
* **`src/context/`** — `AuthContext` / `AuthProvider`: the single source of truth for the current Supabase session, roles, and loading state, kept in sync via `supabase.auth.onAuthStateChange`.
* **`src/hooks/`** — One file per data domain, each a thin TanStack Query wrapper around Supabase: `useAuth` (reads the context), `useMovies` (the catalog), `useMyMovies` (watch history, plus the mark/rewatch/unwatch mutations), `useGenres`, `useAdminUsers` (admin CRUD, calling the `admin-users` Edge Function for anything that needs the Admin API), `useAuditLog`.
* **`src/lib/`** — `supabaseClient` (the single client instance), `passwordSchema` (Zod schemas shared by the register and admin-user forms), `exportToExcel` (the SheetJS wrapper behind the "Export to Excel" buttons).
* **`src/pages/`** — One component per route (see `routes/router.tsx`): `LandingPage`, `LoginPage`, `RegisterPage`, `HomePage`, `MoviesPage`, `MyMoviesPage`, `RecommendationPage`, `ErrorPage`, plus `pages/admin/` (`AdminUsersPage`, `AdminUserFormPage`, `AdminAuditLogPage`).
* **`src/routes/router.tsx`** — The single `createBrowserRouter` definition; wires each page to `ProtectedRoute` / `AdminRoute` as needed.
* **`src/types/database.types.ts`** — Generated from the Postgres schema (`npx supabase gen types typescript`) — regenerate after any migration that changes tables or columns.
* **`src/test/`** — Vitest setup (jest-dom matchers); component tests live next to what they test, in `__tests__/` folders.
* **`supabase/migrations/`** — The database schema and its history, applied in order: roles/profiles/RBAC, the movie/genre catalog, `user_movies` (watch history), `audit_log` plus its logging triggers, the `pg_cron` schedule, and a later security-hardening migration (FK `ON DELETE` behavior, `target_user_id`, username constraints). This is the actual source of truth for the schema and every RLS policy.
* **`supabase/functions/`** — Edge Functions (Deno): `tmdb-sync` (holds the TMDB credential, fetches genres/movies, upserts them into Postgres) and `admin-users` (privileged account operations via the Supabase Admin API, re-checking the caller's admin role itself before doing anything); `_shared/cors.ts` holds the CORS headers shared by both.
* **`supabase/tests/database/`** — pgTAP tests asserting RLS actually isolates data between users and blocks non-admin writes, one file per table group.
* **`supabase/config.toml`** — Local Supabase CLI stack configuration (ports, auth settings, etc.) used by `npx supabase start`.
* **`scripts/`** — Node maintenance scripts: `seed-admin-users.mjs` (idempotent default-account bootstrap, run automatically via the `predev` npm script), `bootstrap-tmdb-sync.mjs` (one-time historical TMDB backfill), `lib/logger.mjs` (shared timestamped console + file logging used by both).
* **`docker-compose.yml` / `Dockerfile.dev` / `nginx/`** — Optional Docker dev stack for the frontend + nginx only (see "Running via Docker" below). Supabase itself runs via its own separately-managed Docker stack, started with `npx supabase start`.

### Tech stack

* React 19, TypeScript, Vite
* Supabase (Postgres, Auth, Row Level Security, Edge Functions, `pg_cron`)
* TanStack Query, React Router, react-hook-form + Zod
* SheetJS (`xlsx`) for client-side Excel export
* Vitest + React Testing Library (component tests), pgTAP (RLS tests)

### Prerequisites

* [Node.js](https://nodejs.org/) 22+ (required by `@supabase/supabase-js`)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the local Supabase stack)
* The [Supabase CLI](https://supabase.com/docs/guides/cli) (used here via `npx supabase`, no separate install required)
* A free [TMDB](https://www.themoviedb.org/) account and API key — either a v3 API key or a v4 API Read Access Token both work

### Getting started (local development)

1. Copy the environment template and fill in your own values:
   ```
   cp .env.example .env.local
   ```
2. Start the local Supabase stack (applies all migrations automatically):
   ```
   npx supabase start
   ```
   Copy the printed `API_URL`/`ANON_KEY` into `.env.local` as `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, and the `SERVICE_ROLE_KEY` into your shell environment as `SUPABASE_SERVICE_ROLE_KEY` (needed by the scripts below — never put it in `.env.local`).
3. Give the Edge Functions your TMDB credential for local testing:
   ```
   printf "TMDB_TOKEN=your_token\nTMDB_HOSTNAME=api.themoviedb.org\n" > supabase/.env.local
   npx supabase functions serve --env-file supabase/.env.local
   ```
4. Install and run the frontend. `npm run dev` automatically (re-)seeds the default admin/user accounts first via a `predev` script — it reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the `DEFAULT_*` vars from your shell environment (see `.env.example`), and is idempotent (skips accounts that already exist), so it's safe on every startup. If those vars aren't exported, seeding is skipped with a warning and dev starts normally — run it manually any time with `node scripts/seed-admin-users.mjs`.
   ```
   npm install
   npm run dev
   ```
5. Open `http://localhost:5173`.

### Script logs

`scripts/seed-admin-users.mjs` and `scripts/bootstrap-tmdb-sync.mjs` log through `scripts/lib/logger.mjs`: timestamped, color-coded console output, plus every line also appended to a local-date-stamped file under `logs/` (e.g. `logs/2026-07-14.log`) — one file per calendar day, so past runs are easy to find without scrolling one giant log. `logs/` is git-ignored. This only covers the two Node scripts; the frontend (browser, no filesystem access) and the Supabase Edge Functions aren't part of it — for those, use Supabase Studio's log explorer (`STUDIO_URL` from `npx supabase status`, e.g. `http://127.0.0.1:54323`) or, for the locally-running edge runtime specifically, `docker logs -f supabase_edge_runtime_<project_id>` (this CLI's `supabase functions` has no `logs` subcommand — see "Troubleshooting").

### Running via Docker (optional)

Steps 1-3 above (Supabase) still run via `npx supabase start` — it's already its own Docker Compose stack (Postgres, Auth, PostgREST, Storage, Edge Functions), and re-implementing that by hand wouldn't add anything. `docker-compose.yml` at the repo root instead containerizes just the **web app + nginx**, mirroring the old Flask setup's nginx-in-front-of-the-app layout:

1. `cp .env.docker.example .env.docker` and fill in `SUPABASE_SERVICE_ROLE_KEY` (from `npx supabase start`'s output) and the `DEFAULT_*` accounts.
2. `docker compose up --build`.
3. Open `http://localhost:8090` — nginx proxies to the `web` container's Vite dev server, hot reload included. Supabase itself is reached directly by the browser at `http://127.0.0.1:54321`, unchanged.

The `predev` seed step runs automatically inside the `web` container on every start, same as the host workflow, just reading `.env.docker` instead of shell exports.

In Docker Desktop this shows up as two separate, independently-started container groups: `movie_app_supabase` (from `npx supabase start`) and `movie_app_web` (`web` + `nginx`, from this `docker-compose.yml`). A couple of things you may see there that are normal, not errors:

* `supabase_edge_runtime` only runs while `npx supabase functions serve` (step 3 above) is active in a terminal — seeing it stopped just means that command isn't currently running, and the "Update from TMDB"/admin-user Edge Functions won't respond until it is.
* `supabase_vector` (Logflare's log shipper, used for the Studio's log explorer) can cycle through restarts on some local setups; it's cosmetic and doesn't affect the app, Auth, or the database.

### Troubleshooting

* **"Update from TMDB" (or an admin-users action) fails with `Edge Function returned a non-2xx status code`.** That's `supabase-js`'s generic message whenever an Edge Function responds with an error status — the actual reason lives in the function's own logs, not in that message. Locally, the most common cause is that `npx supabase start` on its own runs the edge runtime *without* your TMDB secret loaded, so `tmdb-sync` crashes as soon as it reads `TMDB_TOKEN` (`Deno.env.get('TMDB_TOKEN')` is `undefined`). Fix: run step 3 from "Getting started" in its own terminal and keep it running for as long as you want these features to work:
  ```
  npx supabase functions serve --env-file supabase/.env.local
  ```
  To see the real underlying error yourself, reproduce the request while tailing the edge runtime container's logs: `docker logs -f supabase_edge_runtime_<project_id>` (run `npx supabase status` if you need the exact container name).
* **`npm run dev` fails to start with `Error: EBUSY: resource busy or locked, rename '...\node_modules\.vite\deps_temp_... -> ...\node_modules\.vite\deps'`.** This is a Windows-only Vite dependency-optimizer cache issue — unrelated to Supabase or the app itself. It means something else (an antivirus/Windows Defender real-time scan, OneDrive or another cloud-sync client, a leftover `vite` process from an earlier `npm run dev`) briefly held a file lock while Vite tried to swap its cache folder. Fix: delete `node_modules/.vite` and re-run `npm run dev`. If it recurs often, exclude the project folder from real-time antivirus scanning, or make sure the project directory isn't inside a cloud-synced folder.

### Deploying

1. `npx supabase link --project-ref <your-project-ref>`, then `npx supabase db push` to apply migrations to your cloud project.
2. `npx supabase functions deploy tmdb-sync` and `npx supabase functions deploy admin-users`.
3. `npx supabase secrets set TMDB_TOKEN=... TMDB_HOSTNAME=api.themoviedb.org`. Optionally also set `ALLOWED_ORIGIN=https://your-app.example` to scope the functions' CORS headers to your deployed frontend instead of the local-dev default of `*`.
4. One-time, in the Supabase SQL editor (never in a committed migration):
   ```sql
   select vault.create_secret('<service-role-key>', 'tmdb_sync_service_key');
   alter database postgres set app.settings.tmdb_sync_url = 'https://<project-ref>.supabase.co/functions/v1/tmdb-sync';
   ```
   This lets the daily `pg_cron` job in `supabase/migrations/..._schedule_tmdb_sync.sql` call the function.
5. Run `node scripts/seed-admin-users.mjs` against the cloud project (with `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` pointed at it).
6. Build the frontend (`npm run build`) and deploy the resulting `dist/` to your static host, with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set to the cloud project's values.

### Loading movies from a wider date range

By default, the daily cron sync only fetches movies released **today** — this keeps the routine sync fast. From the **Movies** page, any logged-in user can also set a **From date** on the "Update from TMDB" control to backfill a range up to **31 days** back through today in one click (e.g. catching up after a few days offline). The `tmdb-sync` Edge Function enforces that 31-day cap for regular (non-service-role) callers — see `MAX_USER_RANGE_DAYS` in `supabase/functions/tmdb-sync/index.ts`.

For a larger one-off backfill (e.g. years of history right after first deploying), use the bootstrap script instead, which runs with the service role key and isn't subject to that cap:

```
PRIMARY_RELEASE_DATE_GTE=2024-02-27 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/bootstrap-tmdb-sync.mjs
```

### Using the application

* Register a new account at `/register` (new accounts get the `user` role) or use the seeded default accounts — see `.env.example` for the credentials you configured. **Note:** login is by **email**, not username (a deliberate change from the original app — Supabase Auth identifies accounts by email).
* **Everyone (logged in):**
  * **Home** — landing page after login.
  * **Movies** — browse movies currently in the database. **Update from TMDB** fetches new movies for a chosen date range: the **From date** picker defaults to today, but picking an earlier date backfills everything released from that date through today (capped at 31 days for logged-in users — see below for wider backfills). **Export to Excel** downloads the list. Mark a movie as watched with a rating and date.
  * **My Movies** — movies you've marked as watched, with your rating and date. Rewatch (re-rate/re-date) or mark not seen, or export the list.
  * **Recommendation** — pick a genre and get a random suggestion from movies you haven't marked as watched.
  * **Log Out**
* **Admin only:**
  * **Users** — list, create, edit (username/role), delete users, and reset passwords.
  * **Audit Log** — a table of account and watch-history activity, with a date picker (jump to any past day, like the original app's per-day log files) and a text search across action/actor/details. This replaces the original app's raw log-file viewer — there's no app server left to write log files to, so writes/role-changes/TMDB syncs are now logged straight into Postgres instead (see `audit_log` in `supabase/migrations/`).

### Testing

* `npm run test` — Vitest + React Testing Library (auth forms, route guards).
* `npx supabase test db --local` — pgTAP tests verifying Row Level Security actually isolates data between users and blocks non-admin writes (`supabase/tests/database/`).

### Security notes

* `.env.local`, `supabase/.env.local`, and this repo's real `.env` are all git-ignored — never commit them.
* The service role key is only ever used server-side (Edge Functions, the two `scripts/*.mjs` bootstrap scripts) — it must never reach the frontend bundle.
* Row Level Security is the *entire* authorization boundary now (there's no server middleware): every table has RLS enabled, and the pgTAP suite exists specifically to catch regressions in those policies.
* Change the seeded default admin/user passwords before using this anywhere beyond local development.

### Migrating from the earlier Flask/Docker version

The previous Flask + Postgres + Docker/nginx stack (`services/`, `db/`, its own `docker-compose.yml`) has been retired in favor of the Supabase-based stack described above. The `docker-compose.yml` present now is unrelated to that old one — it only containerizes the web app + nginx for local dev (see "Running via Docker" above); the database/backend layer is Supabase's own CLI-managed stack, not a service in this compose file. Notable behavior changes:

* **Login is by email, not username** (Supabase Auth's native identifier).
* **Session handling** uses Supabase's sliding refresh-token expiry instead of a hard 1-hour logout.
* **The System Log page is now the Audit Log page**, reading a structured Postgres table instead of raw log files.
* Password complexity rules are enforced client-side (Zod), matching the original app's own client/app-level (not database-level) validation.

### License

MIT — see [LICENSE](LICENSE).

---

<a name="magyar"></a>
## Magyar

### Hogyan működik

* **A frontend** (`src/`) — egy Vite + React + TypeScript SPA, amely a `@supabase/supabase-js` könyvtáron keresztül közvetlenül a Supabase-szel kommunikál. Nincs saját alkalmazásszervere.
* **Supabase Postgres** — ebben tárolódik a `profiles`/`roles`/`user_roles` (identitás és szerepkör-kezelés az `auth.users` felett), a `movies`/`genres`/`movie_genres` (a filmkatalógus), a `user_movies` (a felhasználók megtekintési előzményei/értékelései), valamint az `audit_log` (csak adminok által látható tevékenységnapló). Minden táblán Row Level Security van bekapcsolva — lásd `supabase/migrations/`.
* **Supabase Auth** — email/jelszó alapú fiókok (`auth.users`); egy adatbázis trigger regisztrációkor létrehozza a `profiles` sort és az alapértelmezett `user` szerepkört.
* **`supabase/functions/tmdb-sync`** — egy Edge Function, amely tárolja a TMDB hitelesítő adatot (soha nem kerül a böngészőbe), lekéri a műfajokat/filmeket, és beszúrja/frissíti azokat a Postgres-ben. A Movies oldal **Update** gombja és egy napi `pg_cron` job hívja.
* **`supabase/functions/admin-users`** — egy Edge Function, amely csak azokhoz a fiókműveletekhez kell, amelyek a Supabase Admin API-t igénylik (felhasználó létrehozása/törlése, jelszó visszaállítása másnak). A hívó admin szerepkörét saját maga ellenőrzi, mielőtt bármit is végrehajtana.

```
Böngésző (React SPA) --supabase-js--> Supabase (Postgres + Auth + RLS)
                      --supabase-js--> Supabase Edge Functions (tmdb-sync, admin-users) --> TMDB API
```

### Projekt felépítése

* **`src/components/`** — Megosztott UI elemek: `Navbar`, `Layout`, `AuthLayout`, a két route guard (`ProtectedRoute`, `AdminRoute` — ezek csak UX célt szolgálnak, a tényleges védelmet a Row Level Security adja), `MovieTable`, `RatingDialog`.
* **`src/context/`** — `AuthContext` / `AuthProvider`: az aktuális Supabase munkamenet, szerepkörök és betöltési állapot egyetlen forrása, a `supabase.auth.onAuthStateChange`-en keresztül tartva szinkronban.
* **`src/hooks/`** — Adatterületenként egy fájl, mindegyik egy vékony TanStack Query wrapper a Supabase felett: `useAuth` (a context-et olvassa), `useMovies` (a katalógus), `useMyMovies` (megtekintési előzmények, plusz a mark/rewatch/unwatch mutációk), `useGenres`, `useAdminUsers` (admin CRUD, az Admin API-t igénylő műveletekhez az `admin-users` Edge Functiont hívja), `useAuditLog`.
* **`src/lib/`** — `supabaseClient` (az egyetlen kliens példány), `passwordSchema` (a regisztrációs és admin-felhasználó űrlapok közös Zod sémái), `exportToExcel` (az "Export to Excel" gombok mögötti SheetJS wrapper).
* **`src/pages/`** — Route-onként egy komponens (lásd `routes/router.tsx`): `LandingPage`, `LoginPage`, `RegisterPage`, `HomePage`, `MoviesPage`, `MyMoviesPage`, `RecommendationPage`, `ErrorPage`, valamint a `pages/admin/` (`AdminUsersPage`, `AdminUserFormPage`, `AdminAuditLogPage`).
* **`src/routes/router.tsx`** — Az egyetlen `createBrowserRouter` definíció; ez köti össze az egyes oldalakat a `ProtectedRoute` / `AdminRoute` védelemmel, ahol szükséges.
* **`src/types/database.types.ts`** — A Postgres sémából generálva (`npx supabase gen types typescript`) — minden olyan migráció után regenerálandó, amely táblát vagy oszlopot módosít.
* **`src/test/`** — Vitest setup (jest-dom matcherek); a komponens tesztek a tesztelt fájlok mellett, `__tests__/` mappákban találhatók.
* **`supabase/migrations/`** — Az adatbázis sémája és története, sorrendben alkalmazva: roles/profiles/RBAC, a film/műfaj katalógus, `user_movies` (megtekintési előzmények), `audit_log` a hozzá tartozó naplózó triggerekkel, a `pg_cron` ütemezés, majd egy későbbi biztonsági-keményítő migráció (FK `ON DELETE` viselkedés, `target_user_id`, felhasználónév-megkötések). Ez a séma és minden RLS szabály tényleges forrása.
* **`supabase/functions/`** — Edge Functionök (Deno): `tmdb-sync` (tárolja a TMDB hitelesítő adatot, lekéri a műfajokat/filmeket, beszúrja/frissíti őket a Postgres-ben) és `admin-users` (a Supabase Admin API-t igénylő, privilegizált fiókműveletek — a hívó admin szerepkörét saját maga ellenőrzi, mielőtt bármit végrehajtana); a `_shared/cors.ts` tartalmazza a mindkettő által használt CORS fejléceket.
* **`supabase/tests/database/`** — pgTAP tesztek, amelyek ellenőrzik, hogy az RLS valóban elkülöníti a felhasználók adatait, és blokkolja a nem admin írásokat; táblacsoportonként egy fájl.
* **`supabase/config.toml`** — A helyi Supabase CLI stack konfigurációja (portok, auth beállítások stb.), amelyet az `npx supabase start` használ.
* **`scripts/`** — Node karbantartó szkriptek: `seed-admin-users.mjs` (idempotens alapértelmezett fiók bootstrap, automatikusan a `predev` npm szkripten keresztül fut), `bootstrap-tmdb-sync.mjs` (egyszeri, korábbi TMDB adatok visszatöltése), `lib/logger.mjs` (mindkettő által használt, közös időbélyeges konzol- és fájlnaplózás).
* **`docker-compose.yml` / `Dockerfile.dev` / `nginx/`** — Opcionális Docker fejlesztői stack, kizárólag a frontendhez + nginxhez (lásd lentebb: "Futtatás Dockerrel"). Maga a Supabase a saját, külön kezelt Docker stackjén keresztül fut, amelyet az `npx supabase start` indít el.

### Felhasznált technológiák

* React 19, TypeScript, Vite
* Supabase (Postgres, Auth, Row Level Security, Edge Functions, `pg_cron`)
* TanStack Query, React Router, react-hook-form + Zod
* SheetJS (`xlsx`) az Excel exporthoz (kliensoldalon)
* Vitest + React Testing Library (komponens tesztek), pgTAP (RLS tesztek)

### Előfeltételek

* [Node.js](https://nodejs.org/) 22+ (a `@supabase/supabase-js` ezt igényli)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (a helyi Supabase stackhez)
* [Supabase CLI](https://supabase.com/docs/guides/cli) (itt `npx supabase`-en keresztül használva, nem kell külön telepíteni)
* Egy ingyenes [TMDB](https://www.themoviedb.org/) fiók és API kulcs — mind a v3 API kulcs, mind a v4 API Read Access Token működik

### Indítás lépései (helyi fejlesztés)

1. Másold le a környezeti változó sablont, és töltsd ki a saját értékeiddel:
   ```
   cp .env.example .env.local
   ```
2. Indítsd el a helyi Supabase stacket (automatikusan alkalmazza az összes migrációt):
   ```
   npx supabase start
   ```
   Másold be a kiírt `API_URL`/`ANON_KEY` értékeket a `.env.local` fájlba `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` néven, a `SERVICE_ROLE_KEY`-t pedig a shell környezetedbe `SUPABASE_SERVICE_ROLE_KEY` néven (az alábbi szkriptekhez kell — soha ne kerüljön a `.env.local` fájlba).
3. Add meg a TMDB hitelesítő adatot az Edge Functionöknek helyi teszteléshez:
   ```
   printf "TMDB_TOKEN=your_token\nTMDB_HOSTNAME=api.themoviedb.org\n" > supabase/.env.local
   npx supabase functions serve --env-file supabase/.env.local
   ```
4. Telepítsd és indítsd a frontendet. Az `npm run dev` egy `predev` szkripten keresztül automatikusan (újra) létrehozza az alapértelmezett admin/user fiókokat — a `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` és a `DEFAULT_*` változókat a shell környezetedből olvassa (lásd `.env.example`), és idempotens (a már létező fiókokat kihagyja), így minden indításkor biztonságosan lefuthat. Ha ezek a változók nincsenek beállítva, a seedelés figyelmeztetéssel kimarad, a dev szerver pedig rendben elindul — kézzel bármikor lefuttatható: `node scripts/seed-admin-users.mjs`.
   ```
   npm install
   npm run dev
   ```
5. Nyisd meg: `http://localhost:5173`.

### Szkript naplók

A `scripts/seed-admin-users.mjs` és a `scripts/bootstrap-tmdb-sync.mjs` a `scripts/lib/logger.mjs`-en keresztül naplóz: időbélyeges, színkódolt konzolkimenet, plusz minden sor bekerül egy, a helyi dátumhoz igazított fájlba is a `logs/` mappában (pl. `logs/2026-07-14.log`) — naptári naponként egy fájl, így a korábbi futások könnyen megtalálhatók egyetlen hatalmas log görgetése nélkül. A `logs/` git által figyelmen kívül van hagyva. Ez csak a két Node szkriptre vonatkozik; a frontend (böngésző, nincs fájlrendszer-hozzáférése) és a Supabase Edge Functionök nem részei ennek — ezekhez használd a Supabase Studio log explorerjét (`STUDIO_URL` az `npx supabase status`-ból, pl. `http://127.0.0.1:54323`), vagy kifejezetten a helyben futó edge runtime-hoz a `docker logs -f supabase_edge_runtime_<project_id>` parancsot (ennek a CLI-nek a `supabase functions` parancsában nincs `logs` alparancs — lásd "Hibaelhárítás").

### Futtatás Dockerrel (opcionális)

A fenti 1-3. lépés (Supabase) továbbra is `npx supabase start`-tal fut — ez már önmagában egy Docker Compose stack (Postgres, Auth, PostgREST, Storage, Edge Functions), így ezt kézzel újraépíteni nem adna hozzá semmit. A repó gyökerében lévő `docker-compose.yml` csak a **frontendet + nginxet** konténerizálja, a régi Flask-os, nginx-az-app-előtt elrendezést követve:

1. `cp .env.docker.example .env.docker`, majd töltsd ki a `SUPABASE_SERVICE_ROLE_KEY`-t (az `npx supabase start` kimenetéből) és a `DEFAULT_*` fiókokat.
2. `docker compose up --build`.
3. Nyisd meg: `http://localhost:8090` — az nginx a `web` konténer Vite dev szerverét proxyzza, hot reloaddal együtt. A Supabase-t maga a böngésző éri el közvetlenül a `http://127.0.0.1:54321` címen, változatlanul.

A `predev` seed lépés minden induláskor automatikusan lefut a `web` konténerben is, ugyanúgy mint a host-alapú workflow-nál, csak a shell exportok helyett a `.env.docker` fájlból olvasva.

A Docker Desktopban ez két külön, egymástól függetlenül induló konténercsoportként jelenik meg: `movie_app_supabase` (az `npx supabase start`-ból) és `movie_app_web` (`web` + `nginx`, ebből a `docker-compose.yml`-ből). Néhány dolog, amit itt látva nem hiba:

* A `supabase_edge_runtime` csak addig fut, amíg az `npx supabase functions serve` (fenti 3. lépés) aktív egy terminálban — ha leállítva látod, az csak azt jelenti, hogy ez a parancs éppen nem fut, és az "Update from TMDB" / admin felhasználókezelő Edge Functionök nem fognak válaszolni, amíg nem fut.
* A `supabase_vector` (a Logflare log-továbbítója, a Studio log explorerjéhez kell) néhány helyi környezetben újraindulási ciklusba kerülhet; ez kozmetikai jellegű, nem befolyásolja az appot, az Auth-ot vagy az adatbázist.

### Hibaelhárítás

* **Az "Update from TMDB" (vagy egy admin-users művelet) `Edge Function returned a non-2xx status code` hibával fut el.** Ez a `supabase-js` általános üzenete arra, ha egy Edge Function hibás státusszal válaszol — a tényleges ok magának a függvénynek a logjaiban van, nem ebben az üzenetben. Helyben a leggyakoribb ok, hogy az `npx supabase start` önmagában úgy indítja el az edge runtime-ot, hogy a TMDB titkos kulcsod nincs betöltve, így a `tmdb-sync` már a `TMDB_TOKEN` beolvasásakor elszáll (a `Deno.env.get('TMDB_TOKEN')` értéke `undefined`). Megoldás: futtasd le az "Indítás lépései" 3. lépését egy külön terminálban, és hagyd futni, amíg ezekre a funkciókra szükséged van:
  ```
  npx supabase functions serve --env-file supabase/.env.local
  ```
  A tényleges hiba megtekintéséhez reprodukáld a kérést úgy, hogy közben az edge runtime konténer logjait figyeled: `docker logs -f supabase_edge_runtime_<project_id>` (a pontos konténernévhez futtasd az `npx supabase status`-t).
* **Az `npm run dev` nem indul el, és ezt írja ki: `Error: EBUSY: resource busy or locked, rename '...\node_modules\.vite\deps_temp_... -> ...\node_modules\.vite\deps'`.** Ez egy tisztán Windows-os Vite dependency-optimizer cache hiba — nincs köze a Supabase-hez vagy magához az alkalmazáshoz. Azt jelenti, hogy valami más (egy víruskereső/Windows Defender valós idejű vizsgálata, a OneDrive vagy más felhő-szinkronizáló kliens, egy korábbi `npm run dev`-ből visszamaradt `vite` folyamat) rövid időre zárolt egy fájlt, miközben a Vite megpróbálta kicserélni a cache mappáját. Megoldás: töröld a `node_modules/.vite` mappát, majd futtasd újra az `npm run dev`-et. Ha gyakran előfordul, zárd ki a projekt mappáját a valós idejű víruskeresésből, vagy győződj meg róla, hogy a projekt könyvtára nincs egy felhőbe szinkronizált mappában.

### Éles telepítés

1. `npx supabase link --project-ref <a-projekted-ref-je>`, majd `npx supabase db push` a migrációk alkalmazásához a felhő projekten.
2. `npx supabase functions deploy tmdb-sync` és `npx supabase functions deploy admin-users`.
3. `npx supabase secrets set TMDB_TOKEN=... TMDB_HOSTNAME=api.themoviedb.org`. Opcionálisan állítsd be az `ALLOWED_ORIGIN=https://your-app.example` értéket is, hogy a függvények CORS fejlécei a saját telepített frontendedre szűküljenek a helyi fejlesztésnél használt `*` alapérték helyett.
4. Egyszeri lépésként, a Supabase SQL Editorban (soha ne commitolt migrációban):
   ```sql
   select vault.create_secret('<service-role-key>', 'tmdb_sync_service_key');
   alter database postgres set app.settings.tmdb_sync_url = 'https://<project-ref>.supabase.co/functions/v1/tmdb-sync';
   ```
   Ez teszi lehetővé, hogy a `supabase/migrations/..._schedule_tmdb_sync.sql`-ben lévő napi `pg_cron` job meghívja a függvényt.
5. Futtasd le a `node scripts/seed-admin-users.mjs`-t a felhő projekt ellen (a `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` arra mutasson).
6. Buildeld a frontendet (`npm run build`), és töltsd fel a keletkező `dist/` mappát a választott statikus hosztingra, a `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` értékeket a felhő projektre állítva.

### Filmek letöltése tágabb dátumintervallumból

Alapesetben a napi cron szinkron csak a **mai napon** megjelent filmeket tölti le — ez gyorsan tartja a rutin szinkront. A **Movies** oldalon bármelyik bejelentkezett felhasználó beállíthat egy **From date** dátumot az "Update from TMDB" vezérlőn, hogy egy kattintással legfeljebb **31 napra** visszamenőleg töltsön vissza filmeket a mai napig (pl. ha pár napig nem futott a szinkron). A `tmdb-sync` Edge Function ezt a 31 napos korlátot kényszeríti ki a nem service-role hívóknál — lásd `MAX_USER_RANGE_DAYS` a `supabase/functions/tmdb-sync/index.ts` fájlban.

Egy ennél nagyobb, egyszeri visszatöltéshez (pl. évekre visszamenő adatokhoz közvetlenül az első éles telepítés után) használd a bootstrap szkriptet, amely a service role kulccsal fut, és nem vonatkozik rá ez a korlát:

```
PRIMARY_RELEASE_DATE_GTE=2024-02-27 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/bootstrap-tmdb-sync.mjs
```

### Az alkalmazás használata

* Regisztrálj egy új fiókot a `/register` oldalon (az új fiókok `user` szerepkört kapnak), vagy használd az előre létrehozott alapértelmezett fiókokat — lásd `.env.example` a beállított hitelesítő adatokért. **Megjegyzés:** a bejelentkezés **email** alapú, nem felhasználónév alapú (ez tudatos változás az eredeti alkalmazáshoz képest — a Supabase Auth email alapján azonosítja a fiókokat).
* **Minden bejelentkezett felhasználó számára elérhető:**
  * **Home** — bejelentkezés utáni főoldal.
  * **Movies** — az adatbázisban lévő filmek böngészése. Az **Update from TMDB** egy választott dátumtartományból tölt le új filmeket: a **From date** dátumválasztó alapértelmezetten a mai napra áll, de egy korábbi dátum kiválasztásával az onnantól a mai napig megjelent összes film visszatölthető (bejelentkezett felhasználóknál legfeljebb 31 nap — lásd lentebb a tágabb visszatöltéshez). Az **Export to Excel** letölti a listát. Egy film megtekintettnek jelölhető értékeléssel és dátummal.
  * **My Movies** — a megtekintettnek jelölt filmek, az értékeléssel és dátummal. Újranézés (újraértékelés/újradátumozás) vagy megtekintetlenné jelölés, illetve exportálás.
  * **Recommendation** — műfaj kiválasztása után véletlenszerű ajánlást ad a még nem megtekintett filmek közül.
  * **Log Out**
* **Csak admin számára:**
  * **Users** — felhasználók listázása, létrehozása, szerkesztése (felhasználónév/szerepkör), törlése, jelszó visszaállítása.
  * **Audit Log** — a fiók- és megtekintési tevékenységek táblázata, dátumválasztóval (bármelyik korábbi napra ugorhatsz, ahogy az eredeti alkalmazás napi log fájljainál) és szöveges kereséssel (action/actor/details mezőkben). Ez váltja fel az eredeti alkalmazás nyers log fájl nézegetőjét — nincs többé alkalmazásszerver, amely fájlba írna, így az írások/szerepkör-változások/TMDB szinkronok most közvetlenül a Postgres-be kerülnek naplózásra (lásd `audit_log` a `supabase/migrations/`-ben).

### Tesztelés

* `npm run test` — Vitest + React Testing Library (auth űrlapok, route guardok).
* `npx supabase test db --local` — pgTAP tesztek, amelyek ellenőrzik, hogy a Row Level Security valóban elkülöníti-e a felhasználók adatait, és blokkolja-e a nem admin írásokat (`supabase/tests/database/`).

### Biztonsági megjegyzések

* A `.env.local`, a `supabase/.env.local`, és a repó valódi `.env` fájlja is git által figyelmen kívül van hagyva — soha ne commitold ezeket.
* A service role kulcsot kizárólag szerveroldalon használjuk (Edge Functionök, a két `scripts/*.mjs` bootstrap szkript) — soha nem kerülhet a frontend kódba.
* A Row Level Security most a *teljes* jogosultsági határ (nincs szerver middleware): minden táblán be van kapcsolva az RLS, és a pgTAP tesztkészlet kifejezetten azért létezik, hogy elkapja az ezekben a szabályokban bekövetkező regressziókat.
* Az előre létrehozott admin/user jelszavakat cseréld le, mielőtt bármi máshoz használnád, mint helyi fejlesztés.

### Migrálás a korábbi Flask/Docker verzióról

A korábbi Flask + Postgres + Docker/nginx stack (`services/`, `db/`, saját `docker-compose.yml`) megszűnt, helyette a fent leírt Supabase-alapú stack működik. A most jelenlévő `docker-compose.yml` nem ugyanaz, mint a régi — csak a frontendet + nginxet konténerizálja helyi fejlesztéshez (lásd fent: "Futtatás Dockerrel"); az adatbázis/backend réteg a Supabase saját CLI-vel kezelt stackje, nem szolgáltatás ebben a compose fájlban. Fontosabb viselkedésbeli változások:

* **A bejelentkezés email alapú, nem felhasználónév alapú** (a Supabase Auth natív azonosítója).
* **A munkamenet-kezelés** a Supabase csúszó refresh-token lejáratát használja a korábbi kemény, 1 órás kijelentkeztetés helyett.
* **A System Log oldal helyett most az Audit Log oldal van**, amely egy strukturált Postgres táblát olvas nyers log fájlok helyett.
* A jelszó komplexitási szabályok kliensoldalon (Zod) érvényesülnek, ugyanúgy, ahogy az eredeti alkalmazásban is kliens/alkalmazás szinten (nem adatbázis szinten) történt az ellenőrzés.

### Licenc

MIT — lásd: [LICENSE](LICENSE).
