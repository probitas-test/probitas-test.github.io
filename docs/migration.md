# Migration Guide

Probitas 2 runs on Bun and ships as a single `probitas` binary. Deno is no
longer needed to run scenarios, and most scenarios run unchanged. This guide
lists what does change when upgrading from Probitas 1.x.

Probitas 1.x keeps working if you are not ready to move, but it no longer
receives updates. Pin it with:

- `PROBITAS_VERSION=1.0.0` for the shell installer
- `probitas-test/setup-probitas@v1` in GitHub Actions
- `github:probitas-test/probitas/v1.0.0` as the Nix flake input

## Installation

The binary is downloaded from the GitHub Release; nothing else is required.

```bash
curl -fsSL https://raw.githubusercontent.com/probitas-test/probitas/main/install.sh | sh
```

- The binary is installed to `~/.local/bin` by default (1.x used `~/.deno/bin`).
  `PROBITAS_INSTALL_DIR` still names the installation root, and the binary goes
  to `$PROBITAS_INSTALL_DIR/bin`.
- Supported platforms are macOS (arm64, x64), Linux with glibc (x64, arm64), and
  Windows (x64, download the `.zip` from the release). musl-based Linux such as
  Alpine is not supported yet.
- Homebrew (`brew install probitas-test/tap/probitas`) and
  `probitas-test/setup-probitas@v2` install the binary as well.
- The flake's `overlays.default` and `packages.default` keep providing
  `probitas`, now the release binary (1.x ran the sources with Deno). It follows
  the latest release rather than the flake's revision.

See [Installation](/docs/installation/) for every method.

## Scenarios

### Probitas Imports Keep Working

Scenarios run against the copy of Probitas embedded in the binary, so they need
no install step. The 1.x specifiers still resolve:

```typescript
import { client, expect, scenario } from "jsr:@probitas/probitas@^0"; // still works
```

The 2.x name is the npm package, which also gives you editor support (see
[Editor Support](#editor-support)):

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";
```

### Other Dependencies Need a package.json

Only Probitas itself is embedded. Third-party modules must be installed next to
your scenarios and imported by their bare name; `npm:` and `jsr:` specifiers for
other packages are not resolved.

| 1.x                                              | 2.x                                                             |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `import ms from "npm:ms@2"`                      | `npm install ms`, then `import ms from "ms"`                    |
| `import { assertEquals } from "jsr:@std/assert"` | `npx jsr add @std/assert`, then `import ... from "@std/assert"` |

### No `Deno` Global

Scenarios run on Bun, so `Deno.*` APIs are unavailable. Use the Node.js
equivalents, which Bun implements:

| 1.x                       | 2.x                                              |
| ------------------------- | ------------------------------------------------ |
| `Deno.env.get("API_URL")` | `process.env.API_URL`                            |
| `Deno.readTextFile(path)` | `readFile(path, "utf8")` from `node:fs/promises` |
| `Deno.connect({ port })`  | `createConnection({ port })` from `node:net`     |
| `Deno.cwd()`              | `process.cwd()`                                  |

To type-check code that uses these APIs, add the Node.js type definitions (see
[Editor Support](#editor-support)).

### Removed: Deno KV Client

`client.deno_kv` (and `@probitas/client-deno-kv`) is gone, along with its
expectations, since Deno KV only exists inside the Deno runtime.

## Editor Support

1.x relied on the Deno language server. In 2.x, run `probitas init` (or copy
what it generates into an existing project): it writes a `package.json` that
pins `@probitas-test/probitas` to the binary's version and a `tsconfig.json`.
Install with your package manager (`npm install`, `bun install`, ...) and any
TypeScript-aware editor provides completion, type checking, and hover
documentation.

```bash
probitas init
cd probitas
npm install
```

Scenarios that use Node.js APIs (`process.env`, `node:fs/promises`, `Buffer`,
...) also need `@types/node` in `package.json` and `"types": ["node"]` in
`tsconfig.json`; without them, `probitas check` and your editor report `process`
and friends as unknown. Only the `@types` packages listed in `types` are loaded.
Depending on the Probitas version, `probitas init` may already have added both;
otherwise add them yourself:

```bash
npm install --save-dev @types/node
```

```json
{
  "compilerOptions": {
    "types": ["node"]
  }
}
```

## Commands

| 1.x                         | 2.x                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| `probitas fmt`              | Unchanged output (the `deno fmt` formatter is built in); adds `--check` |
| `probitas lint`             | Lints with Biome's recommended rules instead of `deno lint`'s           |
| `probitas check`            | Type-checks with the checker built into the binary (`bun check`)        |
| `probitas cache`            | Now `probitas cache duckdb`: pre-fetches the DuckDB native binding      |
| `--deno-*`, `-r`/`--reload` | Removed                                                                 |

`run`, `list`, and `init` keep their options, and configuration files
(`probitas.json`, `probitas.jsonc`) are unchanged.

`lint` reports different rules than `deno lint`; silence a finding with
`// biome-ignore lint/<group>/<rule>: <reason>`. `check` resolves
`@probitas-test/probitas` from the project, so install the `package.json` that
`probitas init` writes first. Scenarios still importing `jsr:@probitas/probitas`
run, but do not type-check until they import `@probitas-test/probitas`.

See [Code Quality Commands](/docs/overview/#code-quality-commands) for details.

## DuckDB

The DuckDB native binding is not embedded (it would add about 110MB). The first
scenario that creates a DuckDB client downloads it from the npm registry,
verifies it, and caches it per version and platform. For CI images or offline
machines, run `probitas cache duckdb` ahead of time, or point
`PROBITAS_DUCKDB_DIR` at an extracted binding.

See [Native Dependencies](/docs/overview/#native-dependencies) for details.
