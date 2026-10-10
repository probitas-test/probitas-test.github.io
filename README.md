# Probitas Documentation

[![GitHub Pages](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://probitas-test.github.io/documents)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Documentation site for [Probitas](https://github.com/probitas-test/probitas) - a
scenario-based testing framework shipped as a single binary.

## Features

- 📖 Comprehensive documentation with markdown source
- 🔗 Auto-generated API reference from TypeScript source
- 🤖 LLM-friendly endpoints (`/llms.txt`, `*.md`)
- ⚡ Static site generation with HonoX + Vite SSG

## Quick Start

```bash
# Clone the repository
git clone https://github.com/probitas-test/probitas-test.github.io.git
cd probitas-test.github.io

# Install dependencies
npm ci

# Start development server
npm run dev
```

## Commands

| Command                | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Start dev server with HMR                            |
| `npm run build`        | Build static site to `dist/` (client + SSG + search) |
| `npm run preview`      | Preview built site                                   |
| `npm run generate-api` | Regenerate API documentation JSON (requires Deno)    |

## Project Structure

```
.
├── app/                 # HonoX routes, templates, components, and libraries
├── docs/                # Markdown documentation source
├── data/
│   ├── api/             # Generated API JSON (deno doc --json)
│   ├── index/           # Example scenarios shown on the home page
│   └── docs.ts          # Documentation pages configuration
├── public/              # Static assets (CSS, images, favicon)
├── scripts/             # Build & generation scripts
├── tests/               # Integration tests
└── probitas/            # Probitas scenarios checking the site
```

## Routes

| Path                        | Format   | Description           |
| --------------------------- | -------- | --------------------- |
| `/`                         | HTML     | Landing page          |
| `/index.md`                 | Markdown | Overview for LLMs     |
| `/llms.txt`                 | Text     | LLM site map          |
| `/docs/*`                   | HTML     | Documentation pages   |
| `/docs/*.md`                | Markdown | Raw markdown for LLMs |
| `/api/`                     | HTML     | API reference index   |
| `/api/{package}/`           | HTML     | Package API reference |
| `/api/{package}/index.json` | JSON     | API data              |
| `/api/{package}/index.md`   | Markdown | API docs for LLMs     |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Deno](https://deno.land/) 2.6 to regenerate the API documentation

### Regenerating API Documentation

API documentation is generated from the JSR packages using `deno doc`:

```bash
npm run generate-api
```

This script:

1. Fetches all `@probitas/*` packages from JSR API (skipping packages that are
   no longer part of Probitas)
2. Runs `deno doc --json` for each package
3. Processes and saves the output to `data/api/`
4. Formats the generated JSON files

The site renders version 1 of the `deno doc --json` schema. Newer Deno releases
emit version 2, which the script rejects; until the site supports the new
schema, run it with Deno 2.6 first on `PATH` (the script spawns `deno` itself).

### Build Process

The `npm run build` command performs the following steps:

1. **Client Build**: Bundles `app/client.ts`
2. **Static Site Generation**: Uses HonoX + Vite SSG to generate HTML, JSON, and
   Markdown files (`public/` is copied to `dist/`)
3. **Search Indexing**: Runs [Pagefind](https://pagefind.app/) to generate a
   search index

## Deployment

This site is deployed to **GitHub Pages** via GitHub Actions.

1. Push to `main` branch
2. GitHub Actions runs `npm run build`
3. Static files in `dist/` are deployed to GitHub Pages

Live site: https://probitas-test.github.io/

## License

[MIT](./LICENSE) © 2025 Alisue
