# Probitas

Probitas is a scenario-based testing framework. It provides intuitive APIs for
writing integration tests for APIs, databases, message queues, and other backend
services.

## Features

- **Scenario-based testing**: Define tests as readable scenarios with setup,
  steps, and cleanup
- **Multi-protocol support**: HTTP, gRPC, GraphQL, SQL, Redis, MongoDB, and
  message queues with unified APIs
- **Type-safe**: Full type inference through the builder chain
- **Fluent assertions**: Natural syntax like
  `expect(result).toBeOk().toHaveJsonMatching({...})`

## Installation

Probitas ships as a single `probitas` binary; no runtime needs to be installed
beforehand. Choose your preferred method:

```bash
# Shell installer (macOS/Linux)
curl -fsSL https://raw.githubusercontent.com/probitas-test/probitas/main/install.sh | sh

# Homebrew (macOS/Linux)
brew install probitas-test/tap/probitas

# Nix
nix run github:probitas-test/probitas
```

See [Installation Guide](/docs/installation/) for Windows, GitHub Actions, and
Nix flake integration for project-level dependency management.

Coming from Probitas 1.x (Deno)? See the [Migration Guide](/docs/migration/).

## Quick Start

### Initialize a Project

Create a new Probitas project with example files:

```bash
# Create probitas/ directory with example files
probitas init

# Create custom directory
probitas init -d scenarios

# Overwrite existing files
probitas init --force
```

This creates:

- `example.probitas.ts` - Example scenario file
- `probitas.jsonc` - Configuration file with defaults
- `package.json` - Pins `@probitas-test/probitas` to the CLI's version for
  editor support
- `tsconfig.json` - TypeScript settings matching how scenarios are run

### Your First Scenario

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("User API Test")
  .resource("http", () =>
    client.http.createHttpClient({
      url: "http://localhost:8080",
    }))
  .step("GET /users/1", async (ctx) => {
    const { http } = ctx.resources;
    const res = await http.get("/users/1");

    expect(res)
      .toBeOk()
      .toHaveStatus(200)
      .toHaveJsonMatching({ id: 1 });
  })
  .build();
```

Scenarios run against the copy of Probitas embedded in the `probitas` binary, so
`probitas run` works without installing anything.

### Editor Support

Install the `package.json` that `probitas init` wrote with your package manager:

```bash
cd probitas
npm install # or: bun install, pnpm install, ...
```

Any TypeScript-aware editor then provides completion, type checking, and hover
documentation for `@probitas-test/probitas`, and [`probitas check`](#check)
type-checks scenarios from the command line.

Scenarios that use Node.js APIs (`process.env`, `node:fs/promises`, `Buffer`,
...) also need the Node.js type definitions. Make sure `@types/node` is in
`package.json` and `"node"` is listed in `types` of `tsconfig.json`; otherwise
`probitas check` and your editor report `process` and friends as unknown:

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

Only the `@types` packages listed in `types` are loaded, so add `"node"` there
even when `@types/node` is installed. Depending on the Probitas version,
`probitas init` may already have added both.

### Third-Party Dependencies

Only Probitas itself is embedded in the binary. Install other packages next to
your scenarios and import them by their bare name:

```bash
npm install ms
```

```typescript
import ms from "ms";
import { scenario } from "@probitas-test/probitas";

export default scenario("Timeout Budget")
  .step("Compute budget", () => ms("2 minutes"))
  .build();
```

`npm:` and `jsr:` specifiers are not resolved for packages other than Probitas.
Install JSR-only packages with `npx jsr add <package>` and import them by name
as well.

### Runtime APIs

Scenarios run on [Bun](https://bun.sh/), which implements the Node.js APIs. Use
`process.env` for environment variables and `node:` modules (`node:fs/promises`,
`node:child_process`, `node:net`, ...) for system access. `Deno.*` APIs are not
available. To type-check such code, set up the Node.js type definitions as
described in [Editor Support](#editor-support).

## File Naming Convention

Scenario files should use the `.probitas.ts` extension and be placed in the
`probitas/` directory:

```
probitas/
  auth.probitas.ts
  user-crud.probitas.ts
  payment-flow.probitas.ts
```

## Running Scenarios

```bash
# Run all scenarios
probitas run

# Run scenarios with specific tag
probitas run -s tag:example

# Run with different reporter
probitas run --reporter json

# Re-run only failed scenarios from previous run
probitas run --failed
```

### Tag-Based Filtering

Organize scenarios with tags for easy filtering:

```bash
probitas run -s tag:auth              # Match tag
probitas run -s "tag:critical,tag:auth"  # AND logic
probitas run -s "!tag:slow"              # NOT logic
```

### Reporters

Choose output format based on your needs:

- `list` - Detailed human-readable output (default)
- `json` - Machine-readable JSON

## Code Quality Commands

Probitas provides commands to maintain code quality in your scenario files:

```bash
# Format scenario files
probitas fmt

# Lint scenario files
probitas lint

# Type-check scenario files
probitas check
```

The formatter, linter, and type checker are built into the binary, so nothing
else needs to be installed. These commands use the same file discovery mechanism
as `probitas run`, respecting your `includes` and `excludes` configuration.

### fmt

Formats scenario files exactly like `deno fmt` (dprint's TypeScript plugin with
its Deno preset), ignoring any formatter configuration in the project:

```bash
probitas fmt                    # Format all discovered scenarios
probitas fmt probitas/auth/     # Format specific directory
probitas fmt --check            # Fail if a scenario file is unformatted
```

### lint

Lints scenario files with [Biome](https://biomejs.dev/)'s recommended rules,
ignoring any linter configuration in the project:

```bash
probitas lint                   # Lint all discovered scenarios
probitas lint probitas/auth/    # Lint specific directory
```

Silence a finding with a `biome-ignore` comment:

```typescript
// biome-ignore lint/suspicious/noExplicitAny: response shape is unknown
const body = res.json as any;
```

### check

Type-checks scenario files with the TypeScript checker built into the binary:

```bash
probitas check                  # Type-check all discovered scenarios
probitas check probitas/auth/   # Type-check specific directory
```

When a `tsconfig.json` exists in the current directory, `check` type-checks the
project with it and ignores paths, `--include`, and `--exclude`. `check`
resolves `@probitas-test/probitas` from the project, so install the
`package.json` written by `probitas init` first (see
[Editor Support](#editor-support)).

### Common Options

All code quality commands support these options:

```bash
--include <pattern>   # Include pattern for file discovery (repeatable)
--exclude <pattern>   # Exclude pattern for file discovery (repeatable)
--config <path>       # Path to probitas config file
-v, --verbose         # Verbose output
-q, --quiet           # Suppress output
```

## Native Dependencies

The DuckDB native binding is not embedded in the binary. The first scenario that
creates a DuckDB client downloads it from the npm registry, verifies it against
the checksum recorded at build time, and caches it per version and platform.

Pre-fetch it with `probitas cache duckdb` when building CI images or before
working offline:

```bash
probitas cache duckdb
```

| Variable              | Description                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `PROBITAS_DUCKDB_DIR` | Directory holding an extracted DuckDB native binding (`duckdb.node` and its library); skips the cache |
| `XDG_CACHE_HOME`      | Cache root on Linux (default: `~/.cache`)                                                             |

## Available Clients

All clients are accessed via the [`client`](/api/client/) namespace:

| Client     | Factory Function                                                                               | Protocol              |
| ---------- | ---------------------------------------------------------------------------------------------- | --------------------- |
| HTTP       | [`client.http.createHttpClient()`](/api/client-http/#createHttpClient)                         | HTTP/HTTPS            |
| PostgreSQL | [`client.sql.postgres.createPostgresClient()`](/api/client-sql-postgres/#createPostgresClient) | PostgreSQL            |
| MySQL      | [`client.sql.mysql.createMySqlClient()`](/api/client-sql-mysql/#createMySqlClient)             | MySQL                 |
| SQLite     | [`client.sql.sqlite.createSqliteClient()`](/api/client-sql-sqlite/#createSqliteClient)         | SQLite                |
| DuckDB     | [`client.sql.duckdb.createDuckDbClient()`](/api/client-sql-duckdb/#createDuckDbClient)         | DuckDB                |
| gRPC       | [`client.grpc.createGrpcClient()`](/api/client-grpc/#createGrpcClient)                         | gRPC                  |
| ConnectRPC | [`client.connectrpc.createConnectRpcClient()`](/api/client-connectrpc/#createConnectRpcClient) | Connect/gRPC/gRPC-Web |
| GraphQL    | [`client.graphql.createGraphqlClient()`](/api/client-graphql/#createGraphqlClient)             | GraphQL               |
| Redis      | [`client.redis.createRedisClient()`](/api/client-redis/#createRedisClient)                     | Redis                 |
| MongoDB    | [`client.mongodb.createMongoClient()`](/api/client-mongodb/#createMongoClient)                 | MongoDB               |
| RabbitMQ   | [`client.rabbitmq.createRabbitMqClient()`](/api/client-rabbitmq/#createRabbitMqClient)         | AMQP                  |
| SQS        | [`client.sqs.createSqsClient()`](/api/client-sqs/#createSqsClient)                             | AWS SQS               |

## Core Concepts

### Scenario

A scenario is a complete test case composed of:

- **Name**: Descriptive identifier for the test
- **Resources**: Managed dependencies (clients, connections)
- **Setup hooks**: Initialization code with cleanup callbacks
- **Steps**: Sequential test operations with assertions

### Builder Pattern

```
scenario(name, options?)
  .resource(name, factoryFn, options?)    // Register resources (factory function)
  .setup(name?, fn, options?)             // Add setup/cleanup hooks (name optional)
  .step(name?, fn, options?)              // Define test steps (name optional)
  .build()                                // Create immutable definition
```

### Expect API

The [`expect()`](/api/expect/#expect) function auto-dispatches based on result
type:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const httpResponse = await http.get("/users/1");

// HTTP response
expect(httpResponse)
  .toBeOk()
  .toHaveStatus(200)
  .toHaveJsonMatching({ id: 1 });

await using pg = await client.sql.postgres.createPostgresClient({
  url: "postgres://user:pass@localhost/db",
});
const sqlResult = await pg.query("SELECT * FROM users WHERE id = $1", [1]);

// SQL result
expect(sqlResult)
  .toHaveRowCount(1)
  .toHaveRowsMatching({ name: "Alice" });

await using grpc = client.grpc.createGrpcClient({ url: "localhost:50051" });
const grpcResponse = await grpc.call("users.UserService", "GetUser", {
  id: "123",
});

// gRPC response
expect(grpcResponse)
  .toBeOk()
  .toHaveDataMatching({ id: "123" });
```

## Included Utilities

Probitas re-exports useful libraries for convenience:

```typescript
import {
  assertSpyCalls,
  // Test data generation
  faker,
  // Time control
  FakeTime,
  // Template literal dedent
  outdent,
  // Error handling
  raise,
  // Mocking
  spy,
  stub,
  tryOr,
} from "@probitas-test/probitas";
```

## Next Steps

- [Scenario Guide](/docs/scenario/) - Learn how to write scenarios in detail
- [Client Guide](/docs/client/) - Detailed reference for each client
- [Expect Guide](/docs/expect/) - Type-safe assertions for response validation
- [Configuration](/docs/configuration/) - Timeout, retry, and other options
- [Migration Guide](/docs/migration/) - Upgrade from Probitas 1.x (Deno)
