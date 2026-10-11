# probitas-test.github.io

Documentation site for [Probitas](https://github.com/probitas-test/probitas) - a
scenario-based testing framework shipped as a single binary.

- **Runtime**: Node.js + HonoX + Vite SSG
- **API reference**: TypeDoc JSON generated from the npm packages
- **Deploy**: GitHub Pages, from `main`

## How it is built

- **Test first.** Red → green → refactor. Write the failing test before the
  code that makes it pass.
- **Each layer holds one thing.** Put a fact in the one layer that owns it,
  and nowhere else.

  | Layer | Holds |
  | --- | --- |
  | Tests | the details that pin the behaviour down: rules, boundaries, tables |
  | Code | how it is done |
  | Commits | why a change was made |
  | Comments | why it is not done another way |

- **Dependencies are current.** Before adding or bumping one, look up its
  latest release in the registry. Do not copy a version from memory or from
  another repository.

Site structure, routes and the build pipeline are described in
[`.claude/rules/architecture.md`](.claude/rules/architecture.md); writing
guidelines for the pages under `docs/` in
[`.claude/rules/content.md`](.claude/rules/content.md).

## Commands

Run `nix develop` (or use direnv with `.envrc.sample`) first so every tool is
on PATH, then:

```bash
just install       # npm ci
just dev           # Dev server with HMR
just build         # Build static site (client + SSG + Pagefind)
just preview       # Preview production build
just test          # Check internal links in the built site
just generate-api  # Regenerate data/api/ from the npm packages
```

## Quality gate

Run `just ci` before reporting a change as done. CI runs the same recipe.

## Reference Probitas packages

When referencing the Probitas API:

- Scenarios import from `@probitas-test/probitas` (npm); the JSR mirror is
  `@probitas/probitas`
- `data/api/{package}.json` holds the generated TypeDoc JSON of each package
- Check `../probitas/` for the user-facing package and CLI source
- Check `../probitas-packages/` for framework and client package source

## Layout

| Path | What lives there |
| --- | --- |
| `app/` | HonoX routes, templates, components and libraries |
| `data/` | page configuration, home page examples, generated API JSON |
| `docs/` | Markdown source of the documentation pages (site content) |
| `public/` | static assets copied into the site |
| `scripts/` | post-build step and the API reference generator |
| `tests/` | link check of the built site |
| `probitas/` | Probitas scenarios checking a served site (`DOCS_BASE_URL`) |
| `.github/` | CI and the GitHub Pages deployment |

## Language

- README, docs and commit messages: English
- Code comments, log and error messages: English

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), as
described in [`.gitmessage`](.gitmessage) (install it with
`git config commit.template .gitmessage`):

```
<type>[optional scope]: <description>
```

- Types: `feat`, `fix`, `deps`, `refactor`, `test`, `docs`, `style`, `chore`.
- Scopes name the area touched, such as `api`, `ci`, `scripts`, `search`.
