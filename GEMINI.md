# Gemini Project Context: Cadastro de Despesas

Comprehensive guide for the Expense Management System (Frontend & Backend).

## 🚀 System Overview
This project is a full-stack application for registering and managing expenses. It consists of a FastAPI backend and a Vue 3 frontend.

---

## 💻 Frontend: `front-cadastro-despesas`

### **Technologies**
- **Framework:** Vue 3 (Composition API with `<script setup>`)
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS / PostCSS
- **Testing:** Jest (Unit), Cypress (E2E)

### **Key Commands**
- `npm run dev`: Start development server (port 5173)
- `npm run build`: Production build (includes type-check)
- `npm run test:unit`: Run Jest unit tests
- `npm run test:e2e`: Run Cypress E2E tests (headless)
- `npm run cy:open`: Open Cypress Test Runner

### **Architecture & Conventions**
- **View Management:** Simple state machine in `App.vue` using `currentView` (`lista` | `nova`).
- **Data Handling:** Monetary values are handled as **strings** throughout the frontend to avoid floating-point issues.
- **API Layer:** `src/api/` contains thin wrappers over a central `client.ts`.
- **Testing:** Always use `data-cy` attributes for selectors in tests.
- **Proxy:** Vite proxies `/api/*` to `http://localhost:8000`.

---

## ⚙️ Backend: `api-cadastro-despesas`

### **Technologies**
- **Framework:** FastAPI
- **Language:** Python 3.13
- **Package Manager:** `uv`
- **Database:** PostgreSQL 17 (via SQLAlchemy Async + asyncpg)
- **Migrations:** Alembic
- **Testing:** Pytest + Testcontainers (Postgres)
- **Linting:** Ruff

### **Key Commands**
- `uv sync --extra dev`: Synchronize dependencies
- `fastapi dev`: Start development server (port 8000)
- `pytest`: Run full test suite (requires Docker)
- `alembic upgrade head`: Apply database migrations
- `ruff check . --fix`: Lint and auto-fix code
- `docker compose up -d`: Start local PostgreSQL

### **Architecture & Conventions**
- **Request Lifecycle:** DB engine and session factories are stored in `app.state` via lifespan context.
- **Dependency Injection:** Routers access the DB via `request.app.state`.
- **Models:** Abstract `BaseModel` provides UUID PKs and auto-updated `data_cadastro`/`data_alteracao`.
- **Circular Imports:** Handled using `from __future__ import annotations` and `TYPE_CHECKING` blocks.
- **Migrations:** Alembic is configured with post-write hooks to automatically run `ruff` on new revisions.

---

## 🛠 Shared Development Standards
1. **Verification:** Always run tests before pushing.
2. **Linting:** Ensure code passes project-specific linters (Ruff for Backend, `vue-tsc` for Frontend).
3. **Environment:** Use `.env.example` as a template for local configuration.
