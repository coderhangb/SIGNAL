# SIGNAL

SIGNAL helps deaf and hard-of-hearing candidates prepare clear interview communication plans.

## Run & Operate

- `npm run dev` — run the SIGNAL frontend
- `npm run preview` — preview the production frontend build
- `npm run build` — build the frontend and API workspaces
- `npm run dev --workspace=@workspace/api-server` — run the API server
- API health check: `/api/healthz`

## Stack

- npm workspaces, Node.js 24, JavaScript, Vite
- UI: React, React Hooks, Tailwind CSS
- API: Express 5, bundled with esbuild
- Logging: Pino

## Where things live

- `artifacts/signal/src/App.jsx` — complete SIGNAL planning flow
- `artifacts/signal/src/index.css` — SIGNAL theme and responsive styling
- `artifacts/api-server/src/routes/signal.js` — invitation analysis, access check, and request drafting
- `lib/api-spec/openapi.yaml` — API contract reference

## Architecture decisions

- The frontend uses a local JavaScript API client so it can run with npm without generated TypeScript hooks.
- The backend keeps the existing three SIGNAL endpoint contracts and returns demo-safe fallback content from the frontend when a service is unavailable.
- The API is still served under `/api` so the frontend and published artifact keep the same routing.

## Product

SIGNAL guides candidates through communication preferences, invitation review, access gaps, editable support requests, and a simulated employer confirmation plan. It includes Vietnamese Sign Language, written communication, live captions, interpreter support, written questions, and text-chat backup options.

## User preferences

The SIGNAL migration uses JavaScript and npm while preserving the existing accessible flow and visual language.

## Gotchas

- Run the API workspace when testing real invitation analysis; the UI retains editable demo data if the API is unavailable.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
