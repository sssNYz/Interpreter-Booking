# Repository Guidelines

## Project Structure & Module Organization
- Source lives under `src/`, or split as `backend/` and `frontend/` if both tiers exist. Keep new modules in the closest existing pattern.
- Tests belong in `tests/` (Python: `tests/test_*.py`; JS: `**/__tests__` or `*.spec.ts`).
- Static assets go in `assets/` or `public/` (follow current usage). Add build-only assets under `assets/` and runtime-served under `public/`.
- Configuration resides in `.env*` files and `config/`. Commit `.env.example` with safe placeholders, never real secrets.

## Build, Test, and Development Commands
- Discover tasks: `make help`, `npm run`, or check `pyproject.toml`/`package.json` scripts.
- Typical examples (use what matches this repo):
  - Node: `npm run dev` (start), `npm test` (unit), `npm run build` (production).
  - Python: `pytest -q` (tests), `ruff check .` (lint), `black .` (format).
  - Docker: `docker compose up --build` (local stack).

## Coding Style & Naming Conventions
- Formatting: prefer existing tools (Prettier/ESLint for JS/TS; Black/Ruff for Python). Run before pushing.
- Indentation: 2 spaces (JS/TS), 4 spaces (Python) unless linters dictate otherwise.
- Naming: `camelCase` for variables/functions, `PascalCase` for classes/components, `snake_case` for Python modules, `kebab-case` for filenames.
- Keep functions small, pure where possible; document public APIs with docstrings/JSDoc.

## Testing Guidelines
- Frameworks: Jest/Vitest for JS/TS, Pytest for Python. Match existing tests.
- Conventions: name tests `*.spec.(js|ts)` or `test_*.py`. Keep fast and isolated; mock external services.
- Coverage: aim for high coverage on core modules; run with `--coverage` (JS) or `--cov` (Pytest) if configured.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat: add booking filter`). Keep changes focused; include rationale in body.
- Branches: `feat/…`, `fix/…`, `chore/…` linked to issue IDs when applicable.
- PRs: clear description, linked issues, screenshots for UI, migration notes, and a concise test plan (what you ran and results).

## Security & Configuration Tips
- Never commit secrets. Use `.env.local` for machine overrides and update `.env.example` when adding new variables.
- Validate inputs on all request boundaries; prefer prepared statements/ORM query builders. Review third‑party dependencies during upgrades.

