# Configuration

Learn how to configure Probitas scenarios, steps, and clients. This guide covers
all available options and common configuration patterns.

## Project Configuration

Configure Probitas CLI defaults in a configuration file in your project root.

### Configuration File Names

Probitas looks for configuration files in this priority order:

1. `probitas.json` - Standard JSON format
2. `probitas.jsonc` - JSON with comments (recommended)
3. `.probitas.json` - Hidden JSON format
4. `.probitas.jsonc` - Hidden JSON with comments

The first file found is used. JSONC files support `//` and `/* */` comments.

### Configuration Options

```json
{
  // Glob patterns for scenario file discovery
  "includes": ["probitas/**/*.probitas.ts"],
  // Glob patterns to exclude from discovery
  "excludes": ["**/*.skip.probitas.ts"],
  // Output reporter (list, json)
  "reporter": "list",
  // Maximum parallel scenario execution (0 = unlimited)
  "maxConcurrency": 4,
  // Maximum failures before stopping (0 = unlimited)
  "maxFailures": 0,
  // Default timeout for scenarios
  "timeout": "30s",
  // Default step options for all scenarios
  "stepOptions": {
    "timeout": 30000,
    "retry": {
      "maxAttempts": 1,
      "backoff": "linear"
    }
  },
  // Default selectors for filtering scenarios
  "selectors": ["!tag:wip"]
}
```

| Option           | Description                               | Default                               |
| ---------------- | ----------------------------------------- | ------------------------------------- |
| `includes`       | Glob patterns for scenario file discovery | `["probitas/**/*.probitas.ts"]`       |
| `excludes`       | Glob patterns to exclude from discovery   | Common build/dependency directories\* |
| `reporter`       | Output reporter: `list`, `json`           | `"list"`                              |
| `maxConcurrency` | Maximum parallel scenario execution       | unlimited (`0`)                       |
| `maxFailures`    | Maximum failures before stopping          | unlimited (`0`)                       |
| `timeout`        | Default timeout for scenarios             | `"30s"`                               |
| `stepOptions`    | Default step options (timeout, retry)     | See [stepOptions](#stepOptions)       |
| `selectors`      | Default selectors for filtering scenarios | `[]`                                  |

\*Default exclude patterns:

- `**/node_modules/**`, `**/target/**`, `**/.venv/**`, `**/venv/**`,
  `**/__pycache__/**`, `**/vendor/**`, `**/build/**`, `**/bin/**`, `**/obj/**`,
  `**/.git/**`, `**/dist/**`, `**/coverage/**`

### maxFailures

Controls when the test runner stops execution:

- `0` (default): Run all scenarios regardless of failures
- `1`: Fail-fast mode - stop immediately on first failure
- `n`: Stop after n failures

```json
{
  // Fail-fast: stop on first failure
  "maxFailures": 1
}
```

### stepOptions

Set default timeout and retry behavior for all steps across all scenarios. These
defaults can be overridden at the scenario level or individual step level.

```json
{
  "stepOptions": {
    // Default timeout for each step in milliseconds
    "timeout": 30000,
    // Default retry configuration for transient failures
    "retry": {
      // Maximum retry attempts (1 = no retry)
      "maxAttempts": 3,
      // Backoff strategy: "linear" or "exponential"
      "backoff": "exponential"
    }
  }
}
```

| Option              | Description                                     | Default    |
| ------------------- | ----------------------------------------------- | ---------- |
| `timeout`           | Step timeout in milliseconds                    | `30000`    |
| `retry.maxAttempts` | Maximum retry attempts (1 = no retry)           | `1`        |
| `retry.backoff`     | Backoff strategy: `"linear"` or `"exponential"` | `"linear"` |

These project-level defaults apply to all scenarios unless overridden. Override
precedence (highest to lowest):

1. Individual step options (highest priority)
2. Scenario-level `stepOptions`
3. Project-level `stepOptions` (this setting)
4. Framework defaults (lowest priority)

See [Scenario Options](#scenario-options) and [Step Options](#step-options) for
how to override these defaults.

### Selectors

Selectors filter which scenarios to run. The format is `[!][type:]value`:

| Type   | Description                      | Example                 |
| ------ | -------------------------------- | ----------------------- |
| `tag`  | Match by scenario tag            | `tag:api`               |
| `name` | Match by scenario name (default) | `Login` or `name:Login` |
| `!`    | Negation prefix                  | `!tag:slow`             |

Multiple selectors use OR logic. Comma-separated values within a selector use
AND logic:

```json
{
  "selectors": ["tag:api,!tag:slow"]
}
```

This runs scenarios with `api` tag AND without `slow` tag.

### CLI Override

Command-line options override configuration file settings:

```bash
# Override reporter
probitas run --reporter json

# Override concurrency
probitas run --max-concurrency 1

# Fail-fast mode
probitas run --max-failures 1

# Add selectors (combined with config selectors)
probitas run -s tag:smoke
```

## Re-running Failed Scenarios

Use the `--failed` (`-F`) flag to re-run only scenarios that failed in the
previous run. This is useful for iterating on failing tests without waiting for
all scenarios to complete.

```bash
# Run all scenarios
probitas run

# Re-run only scenarios that failed
probitas run --failed

# Short form
probitas run -F
```

### How It Works

1. After each `probitas run`, the CLI saves the list of failed scenarios to
   `.probitas/last-run.json`
2. When `--failed` is specified, only scenarios matching the saved list are
   executed
3. The filter is applied after selectors (AND logic)

```bash
# Run failed scenarios that also have @api tag
probitas run -F -s tag:api

# Run failed scenarios excluding @slow tag
probitas run -F -s "!tag:slow"
```

### State File

The `.probitas/` directory contains machine-specific state and should be added
to `.gitignore`:

```gitignore
# Probitas state directory
.probitas/
```

The state file (`last-run.json`) contains:

- Schema version for forward compatibility
- Timestamp of when the run completed
- List of failed scenarios (name, file path, and error message)

## Unknown Argument Detection

Probitas CLI provides helpful error messages when you use unknown options. This
helps catch typos and guides you toward the correct syntax.

### Common Mistakes

The CLI recognizes common mistakes and provides contextual hints:

```bash
# Mistake: --tag instead of -s "tag:value"
$ probitas run --tag api
Unknown option: --tag
Did you mean '-s "tag:api"'? Use the selector option to filter by tag.

# Mistake: --name instead of -s "name:value"
$ probitas run --name Login
Unknown option: --name
Did you mean '-s "name:Login"'? Use the selector option to filter by name.

# Mistake: --filter instead of -s
$ probitas run --filter smoke
Unknown option: --filter
Did you mean '-s "smoke"'? Use the selector option to filter scenarios.
```

### Typo Detection

For other unknown options, the CLI suggests similar known options using
Levenshtein distance:

```bash
# Typo: --verbos instead of --verbose
$ probitas run --verbos
Unknown option: --verbos
Did you mean '--verbose'?

# Typo: --time-out instead of --timeout
$ probitas run --time-out 10s
Unknown option: --time-out
Did you mean '--timeout'?
```

### Fallback Help

When no similar option is found, you'll be directed to the help command:

```bash
$ probitas run --unknown-flag
Unknown option: --unknown-flag
Run 'probitas run --help' for available options.
```

## Scenario Options

Configure scenarios using the options parameter of
[`scenario()`](/api/probitas/#scenario).

```typescript
import { scenario } from "@probitas-test/probitas";

scenario("My Test", {
  tags: ["api", "integration"],
  stepOptions: {
    timeout: 60000,
    retry: { maxAttempts: 3, backoff: "exponential" },
  },
})
  .step(() => {})
  .build();
```

| Option                          | Description                                     | Default    |
| ------------------------------- | ----------------------------------------------- | ---------- |
| `tags`                          | Tags for filtering scenarios during runs        | `[]`       |
| `stepOptions.timeout`           | Default timeout for all steps (ms)              | `30000`    |
| `stepOptions.retry.maxAttempts` | Default max retry attempts for steps            | `1`        |
| `stepOptions.retry.backoff`     | Backoff strategy: `"linear"` or `"exponential"` | `"linear"` |

### Tags

Use tags to categorize and filter scenarios:

```typescript
import { scenario } from "@probitas-test/probitas";

scenario("API Integration", {
  tags: ["api", "integration", "slow"],
})
  .step(() => {})
  .build();
```

Run scenarios by tag using selectors:

```bash
# Run only "api" tagged scenarios
probitas run -s tag:api

# Exclude "slow" scenarios
probitas run -s "!tag:slow"

# Combine filters (AND logic)
probitas run -s "tag:api,!tag:slow"
```

## Step Options

Override scenario defaults for individual steps:

```typescript
import { scenario } from "@probitas-test/probitas";

scenario("Mixed Timeouts")
  .step(
    "Quick check",
    async (_ctx) => {
      // Must complete in 1 second
    },
    { timeout: 1000 },
  )
  .step(
    "Slow operation",
    async (_ctx) => {
      // Can take up to 60 seconds
    },
    { timeout: 60000 },
  )
  .step(
    "Flaky external call",
    async (_ctx) => {
      // Retry up to 5 times with exponential backoff
    },
    {
      retry: { maxAttempts: 5, backoff: "exponential" },
    },
  )
  .build();
```

| Option              | Description                          |
| ------------------- | ------------------------------------ |
| `timeout`           | Step timeout in milliseconds         |
| `retry.maxAttempts` | Maximum retry attempts for this step |
| `retry.backoff`     | Backoff strategy for this step       |

### Timeout Behavior

When a step times out:

1. The step's `ctx.signal` is aborted
2. The step fails with `TimeoutError`
3. Retry logic applies if configured
4. Cleanup hooks still execute

```typescript
import { scenario } from "@probitas-test/probitas";

const url = "https://api.example.com/data";

scenario("Timeout Example")
  .step(
    "Cancellable operation",
    async (ctx) => {
      // Pass signal to cancellable operations
      const response = await fetch(url, { signal: ctx.signal });
      return response.json();
    },
    { timeout: 5000 },
  )
  .build();
```

## Retry Configuration

Configure automatic retries for flaky operations.

| Option         | Description                          | Default |
| -------------- | ------------------------------------ | ------- |
| `maxAttempts`  | Maximum number of attempts           | `1`     |
| `backoff`      | `"linear"` or `"exponential"`        | —       |
| `initialDelay` | First retry delay (ms)               | `1000`  |
| `maxDelay`     | Maximum delay between retries (ms)   | `30000` |
| `retryOn`      | Custom predicate for retry decisions | —       |

### Backoff Strategies

| Strategy        | Delay Pattern     |
| --------------- | ----------------- |
| `"linear"`      | 1s, 2s, 3s, 4s... |
| `"exponential"` | 1s, 2s, 4s, 8s... |

### Custom Retry Logic

```typescript
import { client, scenario } from "@probitas-test/probitas";

scenario("Retry Example")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step(async (ctx) => {
    const { http } = ctx.resources;
    const res = await http.get("/endpoint", {
      retry: {
        maxAttempts: 3,
        backoff: "exponential",
        initialDelay: 500,
        maxDelay: 10000,
        retryOn: (error: Error) => {
          // Only retry on specific errors
          return error.message.includes("network") ||
            error.message.includes("timeout");
        },
      },
    });
    return res.json;
  })
  .build();
```

## Client Configurations

### [HTTP Client](/api/client-http/#createHttpClient)

```typescript
import { client } from "@probitas-test/probitas";

client.http.createHttpClient({
  url: "http://localhost:8080",
  headers: { "Content-Type": "application/json" },
  throwOnError: true,
  timeout: 10000,
});
```

| Option         | Description                          | Default    |
| -------------- | ------------------------------------ | ---------- |
| `url`          | Base URL for all requests (required) | —          |
| `headers`      | Default headers for all requests     | `{}`       |
| `throwOnError` | Throw on 4xx/5xx responses           | `true`     |
| `timeout`      | Request timeout (ms)                 | —          |
| `redirect`     | `"follow"`, `"manual"`, or `"error"` | `"follow"` |

### [PostgreSQL Client](/api/client-sql-postgres/#createPostgresClient)

```typescript
import { client } from "@probitas-test/probitas";

client.sql.postgres.createPostgresClient({
  url: {
    host: "localhost",
    port: 5432,
    database: "testdb",
    username: "testuser",
    password: "testpass",
  },
  pool: { max: 10 },
});
```

| Option             | Description                        | Default |
| ------------------ | ---------------------------------- | ------- |
| `url`              | Connection string or config object | —       |
| `pool.min`         | Minimum pool connections           | `0`     |
| `pool.max`         | Maximum pool connections           | `10`    |
| `pool.idleTimeout` | Idle connection timeout (ms)       | `30000` |

Connection can also be a URL string:

```typescript
import { client } from "@probitas-test/probitas";

client.sql.postgres.createPostgresClient({
  url: "postgres://user:pass@localhost:5432/mydb",
});
```

### [gRPC Client](/api/client-grpc/#createGrpcClient)

```typescript
import { client } from "@probitas-test/probitas";

client.grpc.createGrpcClient({
  url: "localhost:50051",
  metadata: { authorization: "Bearer token" },
  tls: { insecure: false },
});
```

| Option     | Description                    | Default        |
| ---------- | ------------------------------ | -------------- |
| `url`      | Server address (host:port)     | —              |
| `metadata` | Default metadata for all calls | `{}`           |
| `tls`      | TLS configuration              | —              |
| `schema`   | Proto schema source            | `"reflection"` |

### [GraphQL Client](/api/client-graphql/#createGraphqlClient)

```typescript
import { client } from "@probitas-test/probitas";

client.graphql.createGraphqlClient({
  url: "http://localhost:4000/graphql",
  headers: { Authorization: "Bearer token" },
});
```

| Option         | Description                          | Default |
| -------------- | ------------------------------------ | ------- |
| `url`          | GraphQL HTTP endpoint (required)     | —       |
| `headers`      | Default headers                      | `{}`    |
| `wsUrl`        | WebSocket endpoint for subscriptions | —       |
| `throwOnError` | Throw on GraphQL errors              | `true`  |

### [Redis Client](/api/client-redis/#createRedisClient)

```typescript
import { client } from "@probitas-test/probitas";

client.redis.createRedisClient({
  url: "redis://localhost:6379",
});
```

| Option | Description                              | Default                    |
| ------ | ---------------------------------------- | -------------------------- |
| `url`  | Redis connection URL (redis://host:port) | `"redis://localhost:6379"` |

### [MongoDB Client](/api/client-mongodb/#createMongoClient)

```typescript
import { client } from "@probitas-test/probitas";

client.mongodb.createMongoClient({
  url: "mongodb://localhost:27017",
  database: "testdb",
});
```

| Option     | Description            | Default |
| ---------- | ---------------------- | ------- |
| `uri`      | MongoDB connection URI | —       |
| `database` | Default database name  | —       |

### [RabbitMQ Client](/api/client-rabbitmq/#createRabbitMqClient)

```typescript
import { client } from "@probitas-test/probitas";

client.rabbitmq.createRabbitMqClient({
  url: "amqp://guest:guest@localhost:5672",
});
```

| Option | Description         | Default              |
| ------ | ------------------- | -------------------- |
| `url`  | AMQP connection URL | `"amqp://localhost"` |

### [SQS Client](/api/client-sqs/#createSqsClient)

```typescript
import { client } from "@probitas-test/probitas";

client.sqs.createSqsClient({
  url: "http://localhost:4566",
  region: "us-east-1",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});
```

| Option        | Description               | Default |
| ------------- | ------------------------- | ------- |
| `url`         | SQS endpoint URL          | —       |
| `region`      | AWS region                | —       |
| `credentials` | AWS access key and secret | —       |

## Environment Variables

Probitas respects these environment variables:

| Variable              | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `NO_COLOR`            | Disable colored output                                                    |
| `PROBITAS_DUCKDB_DIR` | Use an extracted DuckDB native binding instead of downloading and caching |
| `XDG_CACHE_HOME`      | Cache root for the DuckDB native binding on Linux (default: `~/.cache`)   |

`probitas run` and `probitas list` load a `.env` file before running scenarios.
Use `--env <file>` to load a different file, or `--no-env` to skip it.

### Using Environment Variables

Scenarios read environment variables through `process.env`. To type-check it,
set up the Node.js type definitions (`@types/node` and `"types": ["node"]`) as
described in [Editor Support](/docs/overview/#editor-support).

```typescript
import { client, scenario } from "@probitas-test/probitas";

scenario("Production Test")
  .resource("http", () =>
    client.http.createHttpClient({
      url: process.env.API_URL ?? "http://localhost:8080",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
      },
    }))
  .resource("pg", () =>
    client.sql.postgres.createPostgresClient({
      url: process.env.DATABASE_URL ??
        "postgres://user:pass@localhost/testdb",
    }))
  .step(() => {})
  .build();
```

## Configuration Patterns

### Environment-Aware Configuration

```typescript
import { client, scenario } from "@probitas-test/probitas";

const isProduction = process.env.ENV === "production";

scenario("API Test")
  .resource("http", () =>
    client.http.createHttpClient({
      url: isProduction ? "https://api.example.com" : "http://localhost:8080",
      timeout: isProduction ? 30000 : 5000,
      retry: isProduction
        ? { maxAttempts: 3, backoff: "exponential" }
        : undefined,
    }))
  .step(() => {})
  .build();
```

### Shared Configuration

```typescript
import { client, scenario } from "@probitas-test/probitas";

const httpDefaults = {
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
};

const dbDefaults = {
  pool: { min: 1, max: 5 },
};

scenario("Test")
  .resource("http", () =>
    client.http.createHttpClient({
      url: "http://localhost:8080",
      ...httpDefaults,
    }))
  .resource("pg", () =>
    client.sql.postgres.createPostgresClient({
      url: "postgres://user:pass@localhost:5432/mydb",
      ...dbDefaults,
    }))
  .step(() => {})
  .build();
```

### Resource Factory Pattern

```typescript
import { client, scenario } from "@probitas-test/probitas";

function createApiClient() {
  return client.http.createHttpClient({
    url: process.env.API_URL ?? "http://localhost:8080",
    timeout: 10000,
    retry: { maxAttempts: 2 },
  });
}

function createTestDatabase() {
  return client.sql.postgres.createPostgresClient({
    url: {
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 5432),
      database: "testdb",
      username: "testuser",
      password: "testpass",
    },
  });
}

scenario("Test")
  .resource("http", createApiClient)
  .resource("pg", createTestDatabase)
  .step(() => {})
  .build();
```

### Conditional Resources

```typescript
import { client, scenario, Skip } from "@probitas-test/probitas";

scenario("Conditional Features")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .resource("redis", () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Skip("Redis not configured");
    }
    return client.redis.createRedisClient({
      url: redisUrl,
    });
  })
  .step(() => {})
  .build();
```
