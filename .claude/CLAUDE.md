# Probitas Documentation Site

Documentation for Probitas - a scenario-based testing framework shipped as a
single `probitas` binary (Bun runtime embedded).

## Quick Reference

- **Runtime**: Node.js + HonoX + Vite SSG
- **API Generation**: TypeDoc JSON from the npm packages
- **Deploy**: GitHub Pages

## Commands

```bash
npm run dev        # Dev server with HMR
npm run build      # Build static site (client + SSG + Pagefind)
npm run preview    # Preview production build
npm test           # Check internal links in the built site
npm run generate-api  # Regenerate data/api/ from the npm packages
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
- `data/api/{package}.json` holds the generated TypeDoc JSON of each package
- Check `../probitas/` for the user-facing package and CLI source
- Check `../probitas-packages/` for framework and client package source
