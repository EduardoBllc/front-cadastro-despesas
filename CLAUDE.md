# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # start Vite dev server (http://localhost:5173)
npm run build        # type-check + build for production
npm run typecheck    # run vue-tsc without emitting

# Unit tests (Jest + jsdom)
npm run test:unit              # run all unit tests
npx jest tests/unit/Foo.test.ts  # run a single test file

# E2E tests (Cypress)
npm run cy:open      # open Cypress Test Runner interactively
npm run cy:run       # headless Cypress run (dev server must be running)
npm run test:e2e     # start dev server + run Cypress headlessly
```

## Architecture

Single-page Vue 3 app (Composition API + `<script setup>`) styled with Tailwind CSS. There is no router — `App.vue` manages a two-view state machine (`lista` | `nova`) with a single `currentView` ref.

### Layers

| Layer | Location | Responsibility |
|---|---|---|
| Views (as components) | `src/components/DespesaList.vue`, `DespesaForm.vue` | Page-level UI and state |
| Sub-components | `src/components/ItemFormRow.vue` | Reusable row for expense items |
| API functions | `src/api/despesas.ts`, `src/api/categorias.ts` | Thin wrappers over `client` |
| HTTP client | `src/api/client.ts` | Fetch wrapper; throws `Error` with `detail` from API JSON |
| Types | `src/types/api.ts` | All shared interfaces; monetary values are `string`, not `number` |

### API proxy

In development, Vite proxies `/api/*` → `http://localhost:8000` (stripping the `/api` prefix). The `client.ts` always calls `/api/...`, so the backend must be running locally. Set `VITE_API_URL` in `.env` (see `.env.example`) if the backend runs on a different port.

### Testing conventions

- **Unit tests** live in `tests/unit/` and use `@vue/test-utils` + Jest. API modules are mocked with `jest.mock(...)`.
- **E2E tests** live in `cypress/e2e/` and rely on fixture files in `cypress/fixtures/`.
- All interactive elements have `data-cy` attributes (e.g. `data-cy="btn-submit"`) — use these selectors in both unit and E2E tests.
- The `@` alias resolves to `src/` in both application code and test configs.
