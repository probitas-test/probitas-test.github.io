# Probitas Documentation

[![GitHub Pages](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://probitas-test.github.io/)
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

# Enter the development shell (Node.js, Pagefind, just)
nix develop

# Install dependencies
just install

# Start development server
just dev
```

## Commands

| Command                | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Start dev server with HMR                            |
| `npm run build`        | Build static site to `dist/` (client + SSG + search) |
| `npm run preview`      | Preview built site                                   |
| `npm test`             | Check internal links in the built site               |
| `npm run generate-api` | Regenerate API documentation JSON                    |
| `just ci`              | Everything CI checks (Nix format, build, link check) |

## Project Structure

```
.
├── app/                 # HonoX routes, templates, components, and libraries
├── docs/                # Markdown documentation source
├── data/
│   ├── api/             # Generated API JSON (TypeDoc)
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

- [Nix](https://nixos.org/) with flakes enabled; `nix develop` provides Node.js,
  Pagefind and [just](https://just.systems/). Without Nix, install Node.js 24.

### Regenerating API Documentation

API documentation is generated from the npm packages using
[TypeDoc](https://typedoc.org/):

```bash
npm run generate-api
```

This script:

1. Lists the `@probitas-test/*` packages of the npm organization
2. Installs their latest versions into a temporary directory
3. Runs TypeDoc on each package's entry point
4. Saves each package's TypeDoc JSON to `data/api/`, with an index of the
   packages in `data/api/index.json`

Releases do this automatically: probitas and probitas-packages send a
`packages-published` repository dispatch after publishing, and the
`Update API Reference` workflow (`.github/workflows/update-api.yml`) waits for
the versions to reach npm, regenerates the data, checks the build, and opens a
pull request from the `api-docs/update` branch (or updates the open one). Run
the workflow manually to regenerate from the current npm versions.

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
2. GitHub Actions runs `just ci`, which builds the site and checks its links
3. Static files in `dist/` are deployed to GitHub Pages

Live site: https://probitas-test.github.io/

## License

[MIT](./LICENSE) © 2025 Alisue
