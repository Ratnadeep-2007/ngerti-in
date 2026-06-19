# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js app using the App Router. Main source lives under `src/`:
- `src/app/` contains routes, layouts, and API endpoints.
- `src/components/` holds reusable UI pieces, including `video-player/`, `quiz/`, `companion/`, and `ui/`.
- `src/lib/` contains core logic such as Lingo/Groq wrappers, transcript extraction, session storage, and types.
- `src/contexts/` stores React context providers.
- `src/data/` contains static demo data.
- `docs/` holds longer product notes and implementation ideas.

## Build, Test, and Development Commands
- `npm run dev` starts the local development server.
- `npm run build` creates a production build.
- `npm run start` runs the production build locally.
- `npm run lint` runs ESLint with the Next.js core-web-vitals and TypeScript rules.

## Coding Style & Naming Conventions
Follow the existing TypeScript/React style in the repo:
- Use 2-space indentation and double quotes.
- Prefer functional components and hooks.
- Use `PascalCase` for React components and `camelCase` for functions, variables, and helper modules.
- Keep route files named `page.tsx`, `layout.tsx`, or `route.ts` inside the appropriate `src/app/...` folder.
- Use the `@/*` path alias for imports from `src/`.

## Testing Guidelines
There is no dedicated test runner in `package.json` yet. Use:
- `npm run lint` for static validation.
- `npm run dev` for manual smoke testing the main flows: landing page, learn flow, translations, and certificate download.
If you add tests, keep them close to the feature and use a clear naming pattern like `*.test.tsx` or `*.spec.ts`.

## Commit & Pull Request Guidelines
Recent commits are short, imperative, and descriptive, such as `Update README.md` or `Fix link formatting in README promo section`. Keep commit messages concise and focused on one change.
For pull requests, include:
- A brief summary of what changed.
- Screenshots or screen recordings for UI updates.
- Notes on any environment or behavior changes.

## Security & Configuration Tips
Keep secrets in `.env` or `.env.local`, not in source control. This app expects `GROQ_API_KEY`, `LINGODOTDEV_API_KEY`, and `LINGODOTDEV_ENGINE_ID`. Avoid committing generated files or local build output such as `.next/`.
