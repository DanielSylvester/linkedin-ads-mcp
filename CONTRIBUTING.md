# Contributing

Thanks for your interest in contributing!

## Development Setup

```bash
# Clone and install
npm install

# Build once
npm run build

# Watch mode
npm run dev

# Run all tests (builds automatically via pretest hook)
npm test
```

## Testing

We have two test layers:

1. **Dry-run stress test** (`scripts/stress-test.js`) — Spawns the MCP server over stdio, tests tool registration, schema validation, error handling, and parallel stability. No LinkedIn credentials required.
2. **Unit tests** (`tests/*.test.js`) — Tests pure functions and modules using Node.js built-in `node:test` runner. Mocks `global.fetch` for API client tests.

All tests must pass before merging.

## Code Style

- TypeScript 5.7+
- ES modules (`"type": "module"`)
- Prefer explicit types over `any`
- Follow existing patterns in `src/tools/` for new tools

## Adding a New Tool

1. Add the tool definition and handler in the appropriate `src/tools/*.ts` file
2. Register it in `src/server.ts` via the relevant `*Tools` class
3. Export it from the class's `getToolList()` method
4. Add the tool name to `scripts/stress-test.js` expected tools list
5. Run `npm test` to verify

## Pull Request Process

1. Fork the repo and create a feature branch
2. Make your changes with clear commit messages
3. Ensure `npm test` passes
4. Open a PR against `main` with a description of the change

## Reporting Issues

Please include:
- Node.js version (`node -v`)
- Steps to reproduce
- Expected vs actual behavior
- Any error messages or logs
