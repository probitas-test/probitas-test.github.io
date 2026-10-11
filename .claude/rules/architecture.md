---
paths: "app/**/*.{ts,tsx}, scripts/**/*.ts, vite.config.ts"
---

# Site Architecture

## Directory Structure

```
documents/
├── app/                         # Application source
│   ├── server.ts                # HonoX entry point
│   ├── client.ts                # Client-side JavaScript (bundled by Vite)
│   ├── routes/                  # HonoX file-based routes
│   │   ├── _renderer.tsx        # Global layout renderer (jsxRenderer)
│   │   ├── index.tsx            # Home page route
│   │   ├── AI.tsx               # AI documentation route
│   │   ├── api/
│   │   │   ├── index.tsx        # API index route
│   │   │   └── [package].tsx    # Dynamic API package route
│   │   └── docs/
│   │       ├── index.tsx        # Docs index route
│   │       └── [slug].tsx       # Dynamic docs route
│   ├── templates/               # Page-level JSX components
│   │   ├── Layout.tsx           # Main layout component
│   │   ├── HomeLayout.tsx       # Home page layout
│   │   ├── components.tsx       # Shared UI components
│   │   ├── home.tsx             # Home page template
│   │   ├── scripts.ts           # Inline scripts for SSG
│   │   ├── api/                 # API page templates
│   │   └── docs/                # Documentation page templates
│   ├── components/              # Reusable UI components
│   │   ├── Header.tsx           # Global header navigation
│   │   ├── SearchModal.tsx      # Search modal component
│   │   ├── ScrollToTop.tsx      # Scroll-to-top button
│   │   ├── TableOfContents.tsx  # Table of contents sidebar
│   │   └── DocLayout.tsx        # Documentation page layout
│   └── lib/                     # Core modules
│       ├── api-docs.ts          # API documentation types & utilities
│       ├── api-markdown.ts      # API markdown generation
│       ├── markdown.ts          # Markdown processing & link rewriting
│       ├── llms.ts              # LLM-friendly endpoints generation
│       ├── path.ts              # basePath() helper for GitHub Pages
│       ├── signature-formatters.ts  # Type signature formatting
│       ├── type-format.ts       # Type formatting (TypeDoc types to text and links)
│       └── type-references.ts   # Type reference resolution
├── data/                        # Data modules
│   ├── api/                     # Generated API JSON (TypeDoc)
│   ├── docs.ts                  # Documentation pages configuration
│   └── api-pages.ts             # API documentation loader
├── docs/                        # Markdown documentation source
├── public/                      # Static assets (CSS, images, favicon)
├── scripts/                     # Build and generation scripts
│   ├── post-build.js            # Pagefind indexing & llms.txt.html→llms.txt rename
│   └── generate-api-docs.ts     # Generate API docs from the npm packages
├── package.json                 # npm dependencies
├── vite.config.ts               # Vite + HonoX SSG configuration
└── tsconfig.json                # TypeScript configuration
```

## Routes

| Path                        | Format   | Description                |
| --------------------------- | -------- | -------------------------- |
| `/`                         | HTML     | Landing page               |
| `/index.md`                 | Markdown | Overview for LLMs          |
| `/llms.txt`                 | Text     | LLM site map               |
| `/docs/*`                   | HTML     | Documentation pages        |
| `/docs/*.md`                | Markdown | Raw markdown for LLMs      |
| `/api/`                     | HTML     | API reference index        |
| `/api/{package}/`           | HTML     | Package API reference      |
| `/api/{package}/index.json` | JSON     | Raw API data               |
| `/api/{package}/index.md`   | Markdown | API documentation for LLMs |

## Build Workflow

### 1. API Documentation Generation

```bash
npm run generate-api
```

1. Lists the `@probitas-test/*` packages of the npm organization
2. Installs their latest versions into a temporary directory
3. Runs TypeDoc on each package's entry point (the published `.ts` sources),
   documenting other `@probitas-test` packages' symbols a package re-exports
4. Drops namespaces and TypeDoc's theme-only data, and saves the TypeDoc JSON
   to `data/api/{package}.json`
5. Generates `data/api/index.json` with package metadata

The site reads the TypeDoc JSON for types only and never loads TypeDoc at
runtime. `vite.config.ts` keeps Vite from resolving `typedoc`, because HonoX
otherwise walks into it while looking for islands.

### 2. Static Site Generation

```bash
npm run build
```

1. **Client Build**: Builds client.ts → dist/static/client.js
2. **SSG Build**: HonoX + Vite SSG generates HTML/JSON/Markdown files (Vite
   automatically copies public/ to dist/)
3. **Post-Build**: Renames llms.txt.html → llms.txt, runs Pagefind

## Client-Side Features

The site includes JavaScript functionality (see `app/client.ts` and
`app/templates/scripts.ts`):

- **Theme switching**: Light/dark mode with localStorage persistence
- **Code highlighting**: Dynamic highlight.js loading with theme sync
- **Code copy buttons**: Copy-to-clipboard for code blocks
- **Carousel**: Interactive example carousel on home page
- **Search modal**: Pagefind-powered search (Cmd/Ctrl+K)
- **Scroll-to-top**: Floating button for long pages
