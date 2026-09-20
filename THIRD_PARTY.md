# Third-party dependencies

Parallel plans a conference for a whole team: it imports a public agenda, learns what the team came
to learn, and splits teammates across overlapping sessions so the team covers the most ground. The
plan goes out by email and changes come back as replies.

This document lists every direct dependency the project declares, the exact version it is pinned to,
the licence that version ships under, and what Parallel actually does with it. It exists so anyone
assessing the project can see what is inside it without reading the code.

**Audit date: 2026-09-20.** All versions are exact pins — the project uses `save-exact=true`, so
`package.json` contains no ranges.

**Summary finding: no GPL, LGPL, AGPL or SSPL licensed dependency was found.** Details are in
[Excluded licence check](#excluded-licence-check) below.

## Runtime dependencies

These ship in the deployed application.

| Package                           | Version | Licence    | What Parallel uses it for                                                                                                                                                                                               |
| --------------------------------- | ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@fontsource-variable/geist`      | 5.3.0   | OFL-1.1    | Self-hosted Geist variable font, imported in `src/styles/globals.css` and bound to the `--font-geist-sans` token used for body text.                                                                                    |
| `@fontsource-variable/geist-mono` | 5.3.0   | OFL-1.1    | Self-hosted Geist Mono variable font, bound to `--font-geist-mono` for times, identifiers and other tabular text.                                                                                                       |
| `@fontsource-variable/manrope`    | 5.3.0   | OFL-1.1    | Self-hosted Manrope variable font, bound to `--font-manrope` and used for headings.                                                                                                                                     |
| `@hugeicons/core-free-icons`      | 4.3.4   | MIT        | The icon set. Every icon in the product comes from here; no inline SVG or second icon library is used.                                                                                                                  |
| `@hugeicons/react`                | 1.1.10  | MIT        | The `<HugeiconsIcon />` renderer for that set, used across 16 UI files (sidebar, board cards, setup panels, landing sections).                                                                                          |
| `convex`                          | 1.46.0  | Apache-2.0 | The backend. `convex/react` supplies the reactive client and the `useQuery`/`useMutation`/`useAction` hooks; `convex/server` and `convex/values` define the schema, queries, mutations, actions, HTTP routes and crons. |
| `react`                           | 19.3.0  | MIT        | The UI framework the whole frontend is written in.                                                                                                                                                                      |
| `react-dom`                       | 19.3.0  | MIT        | Mounts that UI into the browser via `createRoot` in `src/main.tsx`.                                                                                                                                                     |
| `react-router`                    | 8.4.0   | MIT        | Client-side routing for the agenda, goals, board, notes and brief screens, plus the landing page and the not-found route (12 UI files).                                                                                 |

## Development dependencies

These are used to build, lint, type-check, format and test the project. None of them ship to users.

| Package                      | Version | Licence    | What Parallel uses it for                                                                                                                                                                                                                                       |
| ---------------------------- | ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@convex-dev/static-hosting` | 0.2.1   | Apache-2.0 | Convex component that serves the built frontend from the deployment's own domain with SPA fallback; wired in `convex/convex.config.ts` and driven by the `deploy` script. Its runtime half runs inside the Convex deployment rather than in the browser bundle. |
| `@eslint/js`                 | 10.0.1  | MIT        | ESLint's own recommended rule set, the first layer of `eslint.config.js`.                                                                                                                                                                                       |
| `@tailwindcss/vite`          | 4.3.3   | MIT        | Tailwind's Vite plugin, registered in `vite.config.ts` so styles compile during dev and build.                                                                                                                                                                  |
| `@types/node`                | 26.6.2  | MIT        | Node type definitions for `vite.config.ts` (which imports `node:url`) and for the `types` list in `tsconfig.json`.                                                                                                                                              |
| `@types/react`               | 19.3.0  | MIT        | React type definitions for the strict TypeScript build.                                                                                                                                                                                                         |
| `@types/react-dom`           | 19.3.0  | MIT        | React DOM type definitions for the same build.                                                                                                                                                                                                                  |
| `@vitejs/plugin-react`       | 6.1.1   | MIT        | React support and fast refresh in Vite, registered in `vite.config.ts`.                                                                                                                                                                                         |
| `eslint`                     | 10.11.0 | MIT        | The linter behind `pnpm lint`; also the host for the project's local rule that keeps shipped code comment-free.                                                                                                                                                 |
| `eslint-config-prettier`     | 10.1.8  | MIT        | Turns off the ESLint rules that would fight Prettier's formatting.                                                                                                                                                                                              |
| `eslint-plugin-react-hooks`  | 7.1.1   | MIT        | Enforces the rules of hooks across the UI, via its flat `recommended-latest` config.                                                                                                                                                                            |
| `globals`                    | 17.12.0 | MIT        | Supplies the browser global names to ESLint so DOM APIs are not reported as undefined.                                                                                                                                                                          |
| `prettier`                   | 3.9.8   | MIT        | Formatting, configured by `.prettierrc.json` and run through `pnpm format` / `pnpm format:check`.                                                                                                                                                               |
| `tailwindcss`                | 4.3.3   | MIT        | The CSS engine. `src/styles/globals.css` imports it, and `src/styles/theme.css` defines the design tokens every component styles against.                                                                                                                       |
| `typescript`                 | 5.9.3   | Apache-2.0 | Type checking for the app, the Convex functions and the tests (`pnpm typecheck`, and `tsc --noEmit` ahead of every build).                                                                                                                                      |
| `typescript-eslint`          | 8.70.0  | MIT        | The TypeScript parser and `strictTypeChecked` rules that make up most of the lint configuration.                                                                                                                                                                |
| `vite`                       | 8.3.0   | MIT        | The dev server and production bundler.                                                                                                                                                                                                                          |
| `vitest`                     | 5.0.1   | MIT        | The unit test runner. 15 test files cover the deterministic planning engine, the email parsing and routing layer, and the brief builder.                                                                                                                        |

## Excluded licence check

The project excludes dependencies licensed under **GPL, LGPL, AGPL or SSPL**.

**Result: clean. None of the 26 direct dependencies is licensed under any of those.** The observed
licences are MIT (20), Apache-2.0 (3) and SIL OFL-1.1 (3, the three font packages).

The same check was extended beyond the direct list as a sanity check: every `package.json` in the
installed tree was read — 205 distinct packages including all transitive dependencies — and none
declares a GPL-, LGPL-, AGPL- or SSPL-family licence.

**Licence metadata disagreements: none found.** For every direct dependency, the `license` field in
its `package.json` matches the text of the licence file shipped alongside it. Two details worth
recording rather than hiding:

- `eslint`, `@eslint/js` and `prettier` ship the MIT permission text without an "MIT License" title
  line. The body is the standard MIT text and the declared licence is MIT, so this is a formatting
  difference, not a disagreement.
- `vite` and `vitest` ship long `LICENSE.md` files that state the project's own MIT licence first and
  then reproduce the licences of the dependencies they bundle. The licence of the package itself is
  MIT in both cases; the appended texts belong to bundled third parties and were checked for
  excluded licences along with everything else.

No dependency's licence was recorded as "undetermined" — every one was readable from both its
`package.json` and a licence file in the package.

## Unused dependencies

None. Every package listed above was traced to a use in the repository: an import in the application
or Convex source, a CSS `@import`, an entry in `vite.config.ts`, `eslint.config.js`, `tsconfig.json`
or `.prettierrc.json`, or a `package.json` script.

## Externally hosted services called at runtime

Beyond the packages above, the running application depends on four hosted services. Each is called
from server-side Convex code with a key held in Convex environment variables, except Convex itself.

| Service   | Endpoint                              | Where it is called                                                               | What it does for Parallel                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convex    | the project's own deployment          | `src/lib/convex-client.ts`, all of `convex/`                                     | Hosts the database, the functions and the realtime subscriptions, and serves the built frontend. The browser connects using the deployment URL injected at build time.                                                                                                                                            |
| Firecrawl | `https://api.firecrawl.dev/v2/scrape` | `convex/model/firecrawlClient.ts`                                                | Fetches a public conference agenda page and returns it as markdown for import. Each import records the source URL, fetch time and a content hash.                                                                                                                                                                 |
| OpenAI    | `https://api.openai.com/v1/responses` | `convex/model/openaiClient.ts`                                                   | Four structured-output jobs only: normalising scraped markdown into sessions, scoring session relevance against team goals, parsing inbound email replies, and drafting the brief from approved notes. It never does schedule math — who attends what is decided by deterministic TypeScript in `convex/engine/`. |
| AgentMail | `https://api.agentmail.to/v0/inboxes` | `convex/model/agentmailClient.ts` (outbound), `convex/http.ts` (inbound webhook) | The email interface: sends plan and cover-request emails from one shared inbox and receives replies through a signed webhook.                                                                                                                                                                                     |

The landing page additionally loads an animated background script,
`unicornstudio.js@v1.4.29`, from the jsDelivr CDN at runtime. It is cosmetic, is not an npm
dependency, and nothing in the product depends on it.

## How this audit was performed

Everything below is read-only and can be repeated from a clean checkout after `pnpm install`.

1. **The dependency list** was taken from the `dependencies` and `devDependencies` blocks of
   `package.json`, not from a lockfile or a memory of what the project uses.
2. **Installed versions** were confirmed against the `version` field of each installed package, to
   prove the pin in `package.json` is what is actually on disk:

   ```sh
   node -p "require('./node_modules/<pkg>/package.json').version"
   ```

3. **Licences** were read from the installed package itself — never assumed from the package's
   reputation. For each one, both the `license` field of `node_modules/<pkg>/package.json` and the
   text of its `LICENSE` / `LICENSE.md` / `license` file were read and compared:

   ```sh
   node -p "require('./node_modules/<pkg>/package.json').license"
   head -20 node_modules/<pkg>/LICENSE
   ```

4. **The exclusion check** matched every declared licence against the GPL, LGPL, AGPL and SSPL
   family, then repeated the match over the licence text of each direct dependency and over the
   `license` field of every `package.json` in the installed tree.
5. **Usage** was established by searching the repository for each package's import or configuration
   entry, so the "what Parallel uses it for" column describes a real call site rather than the
   package's general purpose:

   ```sh
   grep -rn "<pkg>" --include="*.ts" --include="*.tsx" --include="*.css" src convex tests
   ```

6. **Hosted services** were found by searching the source for outbound HTTPS endpoints rather than
   by assuming which providers are in use:

   ```sh
   grep -rnoE '"https://[^"]+"' --include="*.ts" --include="*.tsx" src convex
   ```

This audit covers declared licences as published by each package. It is not legal advice.
