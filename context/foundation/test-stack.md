# Test stack

## E2E

<!-- Written by /10x-e2e-setup. Re-run it to change this section; other skills only read it. -->

- runner: Playwright Test, @playwright/test 1.63.0
- config: playwright.config.ts
- single-spec command: npx playwright test tests/e2e/seed.spec.ts
- full-suite command: npx playwright test
- base URL: http://localhost:4321
- port: 4321 (detected from Astro's documented dev/preview default, matches scripts/smoke.mjs's BASE_URL default; no explicit server.port in astro.config.mjs; override with E2E_PORT)
- web server command: npm run build && npm run preview -- --port $E2E_PORT; reuseExistingServer outside CI
- auth setup project: setup (tests/e2e/auth.setup.ts), credentials from E2E_USERNAME / E2E_PASSWORD in .env
- storageState: playwright/.auth/user.json (gitignored)
- seed: tests/e2e/seed.spec.ts — protects risk #1 (unauthenticated/cross-user access to dog/match/message data is blocked): an unauthenticated request to /dashboard redirects to /auth/signin instead of showing data
- browser CLI: playwright-cli, command skill at .github/skills/playwright-cli (also mirrored at .agents/skills/playwright-cli)
- updated: 2026-10-03
