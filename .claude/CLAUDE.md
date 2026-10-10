# Probitas Documentation Site

Documentation for Probitas - a scenario-based testing framework shipped as a
single `probitas` binary (Bun runtime embedded).

## Quick Reference

- **Runtime**: Node.js + HonoX + Vite SSG
- **API Generation**: Deno 2.6 (`deno doc --json` schema version 1)
- **Deploy**: GitHub Pages

## Commands

```bash
npm run dev        # Dev server with HMR
npm run build      # Build static site (client + SSG + Pagefind)
npm run preview    # Preview production build

# API docs generation (requires Deno 2.6 on PATH)
npm run generate-api
```

## Pre-Completion Verification

BEFORE reporting task completion, run and ensure zero errors:

```bash
npm run build
```

## Reference Probitas Packages

When referencing Probitas API:

- Scenarios import from `@probitas-test/probitas` (npm); the JSR mirror is
  `@probitas/probitas`
- Use `deno doc jsr:@probitas/{package}` for API data
- Check `../probitas/` for the user-facing package and CLI source
- Check `../probitas-packages/` for framework and client package source
