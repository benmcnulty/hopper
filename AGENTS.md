# Repository Guidelines

## Project Structure & Module Organization
- `src/main.ts` boots the Bun server, embeds frontend assets, and wires WebSocket handlers.
- `src/server/` holds backend modules: detection, queueing, execution, Ollama client, and WebSocket fan-out.
- `src/frontend/` contains the shipped UI (`index.html`, `app.js`, `styles.css`); keep assets self-contained.
- `src/types.ts` stores shared interfaces; update here before reusing shapes across layers.
- `dist/` is the compiled binary; avoid manual edits. `bun.lock` locks dependencies.

## Build, Test, and Development Commands
- `bun install` — install dependencies.
- `bun run dev` — start the orchestrator at `http://localhost:3000` (auto-opens on macOS).
- `bun run build` — compile to a standalone binary at `dist/ai-orchestrator`.
- `bun run start` — execute the compiled binary for release validation.

## Coding Style & Naming Conventions
- TypeScript with `"strict": true`; keep types explicit and prefer ES modules.
- 2-space indentation, trailing semicolons, camelCase for identifiers, PascalCase for types.
- Favor small, single-purpose modules; keep server logic in `src/server` and UI-only logic in `src/frontend`.
- Prefer named exports; reserve default exports for embedded assets.

## Testing Guidelines
- No automated tests yet; when adding, use `bun test` with colocated `*.test.ts`.
- Cover queue ordering, process lifecycle, and WebSocket message flows; mock external CLIs and Ollama calls.
- Keep tests deterministic—avoid real network calls or shelling out without stubs.

## Commit & Pull Request Guidelines
- Commit messages: imperative and scoped; prefer Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`) as in the current history.
- Pull requests should include a purpose summary, linked issues, screenshots/GIFs for UI-visible changes, and testing notes.
- Avoid committing generated binaries unless a release requires it; rely on `bun run build` for reproducible outputs.
- When adding modules or types, update related docs (`README.md`, `CLAUDE.md`) to keep the architecture map current.

## Security & Configuration Tips
- Do not check in API keys or local model credentials; use environment variables or OS keychain.
- Validate and sanitize prompt inputs before spawning processes; respect folder-level permissions when invoking external agents.
- Keep dependencies locked via `bun.lock` and avoid unreviewed runtime downloads; prefer local-only Ollama access.
