# Repository Guidelines

## Project Structure & Module Organization
The codebase uses Next.js App Router: route groups and layouts reside in `src/app`. Shared UI stays in `src/components`, reusable logic in `src/hooks`, utilities in `src/lib`, and schema or seed data in `src/data`. Database tables, Drizzle helpers, and migrations sit under `src/db` with tooling in `drizzle.config.ts`. Bootstrap via `scripts/setup-database.js`. Place tests beside the implementation (e.g., `FeaturePanel.test.tsx`) so reviewers can trace intent quickly.

## Build, Test, and Development Commands
- `pnpm dev` — run the development server on port 4025 with hot reload.
- `pnpm build` — create the production bundle and type-check.
- `pnpm start` — serve the compiled `.next` output, mirroring production.
- `pnpm lint` — enforce the Next.js ESLint preset; fix warnings before PRs.
- `pnpm db:setup` — create the local database and seed default data.
- `pnpm db:push` — apply Drizzle schema changes to the configured database.
- `pnpm db:studio` — open Drizzle Studio for table inspection or quick edits.

## Coding Style & Naming Conventions
Stick to TypeScript, 2-space indentation, and named exports when practical. Components and layouts use PascalCase; hooks start with `use` and stay in `src/hooks`. Keep server-only utilities in clearly named modules (e.g., `lib/server`) and guard browser APIs before use. Styling relies on MUI + Emotion, so colocate styles with the component for discoverability. Run `pnpm lint` (and enable auto-fix in your editor) prior to every commit.

## Testing Guidelines
There is no baked-in runner yet, so contributors should add Jest + React Testing Library (or Playwright for browser flows) as needed for their feature. Name specs `*.test.ts(x)` or `*.spec.ts` and colocate them with the code they cover. Document manual verification steps in the PR, especially for diagram rendering or auth flows. For database updates, include the `pnpm db:push` output or migration summary so reviewers can reproduce locally.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commits (e.g., “Add grid background”). Follow that voice, keep commits focused, and squash noisy fixups. Each PR should summarize the change, link issues, attach screenshots for UI tweaks, and outline test or manual steps. Wait for linting to pass before requesting review.

## Environment & Security Notes
Secrets stay in `.env.local`; never commit credentials. Required values typically include `DATABASE_URL`, `NEXTAUTH_SECRET`, and any external API keys such as `GOOGLE_API_KEY`. Rotate anything that leaks in logs or diffs immediately.
