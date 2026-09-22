# SIGNAL developer context

Use README.md, CODE_PLAN.md, IMPLEMENTATION_STATUS.md and TEST_REPORT.md as the current references.

- JavaScript, React 19, Vite 7, Express 5 and npm workspaces remain the runtime stack.
- Active endpoints are /api/v2. The original /api/signal handlers are unmounted historical code.
- API failures never substitute demo data. Rules/manual/template and AI-assisted modes are labelled separately.
- PostgreSQL is required for real sessions, plans and HR sharing. PGlite is used only by test harnesses.
- The test API serves synthetic data locally on 4173; it is not a production fallback.
- No email delivery or public deployment occurs automatically.
- npm ci, npm run dev:api, npm run dev; configuration and full test commands are in README.md.
- lib/* generated TypeScript packages remain outside npm runtime workspaces. Do not turn on pnpm/catalog generation implicitly.
- No migration runs in post-merge hooks. Run npm run db:migrate explicitly against a development DB.
