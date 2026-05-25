# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-25

### Added
- **31 MCP tools** covering accounts, campaign groups, campaigns, creatives, audiences, conversions, and analytics.
- **Standard metrics calculator** (`src/lib/metrics.ts`) — CTR, CPC, CPM, conversion rate, cost per conversion, audience penetration, average dwell time.
- **Audience demographics** — Breakdown by job function, seniority, industry, company size, geography.
- **Conversions & lead gen** — Conversion actions, lead form submissions, qualified leads, CPL.
- **Advanced analytics** — Period comparisons, daily trends with weekday analysis.
- **Creative content resolution** — Auto-detects IMAGE, VIDEO, CAROUSEL, ARTICLE, TEXT from posts/shares.
- **Image upload** — Two-step LinkedIn upload (initialize → PUT binary).
- **Draft-aware deletes** — Draft entities delete immediately; live entities set to `PENDING_DELETION`.
- **Dry-run stress test** (`scripts/stress-test.js`) — Validates the entire server without LinkedIn credentials.
- **Unit tests** (`tests/metrics.test.js`) — 15 tests for the standard metrics calculator using Node.js built-in runner.
- **GitHub Actions CI** — Runs build, lint, stress test, and unit tests on Node 20 and 22.

### Changed
- Adopted account-scoped API endpoints (`/adAccounts/{id}/adCampaigns`) instead of global paths.
- RestLi partial updates use `POST` with `X-RestLi-Method: PARTIAL_UPDATE` header.

### Fixed
- TypeScript compilation errors (`TS2322`, `TS2339`) in `linkedin-client.ts`, `campaigns.ts`, and `creatives.ts`.

## [1.0.0] - 2026-05-24

### Added
- Initial MCP server with stdio transport.
- Basic LinkedIn Marketing API client with env-token auth.
- Core CRUD tools for accounts, campaigns, and creatives.
