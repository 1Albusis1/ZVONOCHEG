# Repository Guidelines

## Project Structure & Module Organization
ZVONOCHEG is an npm workspace monorepo for a communications prototype.
- `apps/api/src/server.js`: Node HTTP API, currently exposing `/api/health`.
- `apps/web/`: Vite web entry point, configuration, and `media-probe/` LiveKit verification harness.
- `packages/client/src/`: shared React UI (`App.jsx`) and styles (`app.css`).
- `packages/crypto/`: OPAQUE/MLS experiments, fixtures, `*.test.js` tests, and browser/Electron recovery probes.
- `infra/local/`: PowerShell environment setup and example LiveKit configuration.
- `docs/`: setup instructions, technical design, roadmap, tasks, and manual probe procedures. Consult these before changing protocol behavior.

## Build, Test, and Development Commands
Use Node.js 24 or newer. Run commands from the repository root:
- `npm ci`: install workspace dependencies from the committed lockfile.
- `npm run build`: build the web app and syntax-check the API.
- `. ./infra/local/env.ps1`: configure local ports in each PowerShell terminal.
- `npm run dev:api` and `npm run dev:web`: start API and web processes in separate terminals. With the environment script loaded, use `http://127.0.0.1:5173`; the API listens on port 3300.
- `npm run check -w @zvonocheg/crypto`: run the crypto test suite.
- `npm run check:opaque -w @zvonocheg/crypto`: run only OPAQUE tests.

## Coding Style & Naming Conventions
Follow existing JavaScript ES modules: two-space indentation, single-quoted strings, semicolons, and explicit relative import extensions. Use camelCase for functions and variables, PascalCase for React components, and descriptive hyphenated filenames for probes and fixtures. Keep shared UI in `packages/client`. No formatter or linter is configured; match surrounding code and preserve UTF-8 text.

## Testing Guidelines
Tests use `node:test` and `node:assert/strict`, colocated as `packages/crypto/*.test.js`. Name cases after observable behavior and cover rejection paths such as invalid passwords, altered ciphertext, and revoked devices. No coverage threshold is configured. Run the build and relevant crypto tests before submitting. For browser/Electron recovery or media changes, follow `docs/README.md` and `docs/LIVEKIT-PROBE.md`; record manual results and unverified scenarios.

## Commit & Pull Request Guidelines
History uses imperative messages with type prefixes and optional scopes, such as `fix(media): preserve LiveKit connection failure diagnostics`. Keep commits focused. PRs should describe behavior changes, reference relevant issues or Z-series tasks, and list validation results. Include screenshots for UI changes and probe evidence for crypto/media changes.

## Security & Configuration
Keep credentials, tokens, passwords, and encryption keys out of commits and logs. Supply LiveKit server credentials through environment secrets and use disposable test identities. Preserve loopback defaults for local services.
