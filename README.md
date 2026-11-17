# Pronogti administrator frontend

Vue 3 + TypeScript + Vite application for the Pronogti administrator panel.
The structure follows Meatshop's admin frontend and uses the workspace
`@katren/vue-business-app` and `@katren/vue-collection-lib` packages.

## Workspace

Place this directory at:

```text
dronm-workspace/
	apps/
		pronogti-admin/
	packages/
		vue-business-app/
		vue-collection-lib/
```

The app references those packages through `file:../../packages/...`; it does
not fetch private Katren packages from the public npm registry. The tested
source versions are business-app 0.1.8 and collection-lib 0.1.15. Keep the
workspace's existing root configuration and lockfile. Install using the
workspace package manager so linked libraries can resolve their Vue, PrimeVue,
Valibot and router peer dependencies. Node.js 22.12 or newer is required.

With npm workspaces already configured in the root:

```sh
cd dronm-workspace
npm install
npm run dev --workspace=pronogti-admin
```

For an existing pnpm workspace, use its normal install command and
`pnpm --filter pronogti-admin dev`.

## Development

The default dev server is `http://localhost:5174` with a strict port.
`.env.development` configures the API prefix `/api`; Vite forwards that prefix
to `http://127.0.0.1:59000` and removes `/api`. For example, the browser calls
`/api/admin/session` and the backend receives `/admin/session`.

Use `.env.local` for local overrides:

```dotenv
VITE_BASE_API=/api
VITE_API_PROXY_TARGET=http://127.0.0.1:59000
VITE_API_TIMEOUT=15000
```

Start the updated Pronogti backend with PostgreSQL and Redis configured, apply
its pending administrator-authentication migration, and provision an
administrator using the backend's administrator command. No default username
or password is shipped in this frontend.

## Authentication and shell

The Meatshop-style login form calls `POST /admin/login` with `name` and `pwd`.
The backend stores authentication in a separate HttpOnly administrator cookie.
`GET /admin/session` restores the current identity after a reload. Browser
storage is not treated as proof of login. The public token returned in `auth`
is a CSRF nonce; it is sent as `X-Admin-Session` on state-changing requests and
is not a bearer credential. Logout calls `POST /admin/logout`.

The application starts with an authenticated home page and a read-only current
user profile. The shared business-app menu and program-information dialog use
`GET /admin/main-menu` and `GET /admin/prog-about`. Menu construction, user CRUD,
financial editing and Meatshop-specific features are not registered in this
starter. There is no WebSocket connection to the public/kiosk application.

The API adapter maps shared business-app endpoints into the administrator
namespace. The primary `api/http.ts` connection keeps an origin/prefix base so
future generated paths such as `/admin/salons` are not prefixed twice.

## Structure and Codegen

```text
src/
	api/             HTTP connection, authentication API and CRUD adapter
	auth/            Session state and stale-request protection
	collections/     Collection definitions
	components/      Application components
	composables/     Application composables
	config/          API and business-app configuration
	forms/           Generated form contracts
	i18n/            Shared and application translations
	locales/         Russian translations and generated locale extension
	references/      Reference definitions
	router/          Manual routes and generated route manifest
	schemas/         Valibot schemas
	stores/          Pinia authentication store
	styles/          Shared compact collection styles
	types/           Application types
	utils/           Safe route helpers
	views/           Login, home and current profile
tests/              Authentication and transport regression tests
```

The backend's `codegen.yaml` already points to this application. The app includes
the common schemas, CRUD adapter, generated-route extension and collection
directories expected by the generator. `src/router/routeManifest.ts` combines
manual routes with `routeManifest.gen.ts`; `src/i18n/index.ts` merges application
translations with `ru.gen.json`. Domain collections can be added through the
backend schemas as their administrator endpoints are implemented.

## Checks

From this app directory, after workspace dependencies are installed:

```sh
npm test
npm run type-check
npm run build
```

Tests cover authoritative session restoration, login/logout, expired sessions,
stale responses, administrator-only DTOs, CSRF headers and safe return routes.

## Production

Set `VITE_BASE_API` to the deployment's API prefix or API origin/prefix. It is
not a URL ending in `/admin`. Configure the backend's `admin.allowed_origins`
for the administrator frontend origin and its administrator cookie for HTTPS.

When serving the public Pronogti app at `/`, this app can use a separate host
or a path such as `/admin-panel/` by setting `VITE_BASE_URL=/admin-panel/` before
building. Configure SPA fallback for that path. Forward API requests to the
same Pronogti executable and retain `Set-Cookie`, `Origin`, and request headers.
The Vite development proxy is not part of the production build.
