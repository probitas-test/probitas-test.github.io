# Scenario

Learn how to write effective Probitas scenarios with this comprehensive guide
covering the builder API, step context, resources, and best practices.

## Basic Structure

A Probitas scenario follows this structure:

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("User API CRUD", {
  tags: ["integration", "api"],
})
  .resource("http", () =>
    client.http.createHttpClient({
      url: "http://localhost:8080",
    }))
  .setup(async (ctx) => {
    // Create test user before steps
    const { http } = ctx.resources;
    await http.post("/users", { body: { name: "test-user" } });

    return async () => {
      // Cleanup: delete test user after steps
      await http.delete("/users/test-user");
    };
  })
  .step("Get user", async (ctx) => {
    const { http } = ctx.resources;
    const res = await http.get("/users/test-user");
    expect(res).toHaveStatus(200);
    return res.json;
  })
  .build();
```

### Export Pattern

Scenarios must be exported as the default export:

```typescript
import { scenario } from "@probitas-test/probitas";

// Single scenario
export default scenario("Name")
  .step(() => {})
  .build();
```

You can also export multiple scenarios as an array:

```typescript
import { scenario } from "@probitas-test/probitas";

// Multiple scenarios
export default [
  scenario("First").step(() => {}).build(),
  scenario("Second").step(() => {}).build(),
];
```

## Scenario Builder API

### [`scenario(name, options?)`](/api/probitas/#scenario)

Creates a new scenario builder.

| Parameter  | Type     | Description                             |
| ---------- | -------- | --------------------------------------- |
| `name`     | `string` | Human-readable identifier for your test |
| `options?` | `object` | Optional configuration (see below)      |

See [Configuration](/docs/configuration) for detailed options including tags,
timeout, and retry settings.

### `.step(name?, fn, options?)`

Adds a step to the scenario. Steps run sequentially, and each receives the
result of the previous step.

| Parameter  | Type         | Description                                                                        |
| ---------- | ------------ | ---------------------------------------------------------------------------------- |
| `name?`    | `string`     | Optional step name (auto-generated as "Step 1", "Step 2" if omitted)               |
| `fn`       | `(ctx) => T` | Async function that receives a context object and returns a result                 |
| `options?` | `object`     | Per-step timeout and retry (see [Configuration](/docs/configuration#step-options)) |

```typescript
import { scenario } from "@probitas-test/probitas";

// Named step
scenario("Example")
  .step("Step name", async (_ctx) => {
    return "result";
  })
  .build();

// Unnamed step (auto-named as "Step 1", "Step 2", etc.)
scenario("Example")
  .step(async (_ctx) => {
    return "result";
  })
  .build();

// With options
scenario("Example")
  .step(
    "Step name",
    async (_ctx) => {
      return "result";
    },
    {
      timeout: 5000,
      retry: { maxAttempts: 3, backoff: "exponential" },
    },
  )
  .build();
```

### `.resource(name, factory, options?)`

Registers a resource with lifecycle management. Resources are created before
steps run and automatically disposed after the scenario completes.

| Parameter  | Type         | Description                                                                            |
| ---------- | ------------ | -------------------------------------------------------------------------------------- |
| `name`     | `string`     | Name to access this resource via `ctx.resources.name`                                  |
| `factory`  | `(ctx) => T` | Function that creates and returns the resource                                         |
| `options?` | `object`     | Per-resource timeout and retry (see [Configuration](/docs/configuration#step-options)) |

```typescript
import { client, scenario } from "@probitas-test/probitas";

scenario("Example")
  .resource("http", () =>
    client.http.createHttpClient({
      url: "http://localhost:8080",
    }))
  .step(() => {})
  .build();

// With options
scenario("Example")
  .resource(
    "db",
    () =>
      client.sql.postgres.createPostgresClient({
        url: "postgresql://localhost:5432/testdb",
      }),
    { timeout: 10000 },
  )
  .step(() => {})
  .build();
```

#### Resource Behavior

- Resources are initialized in declaration order
- Resources implementing `Disposable` or `AsyncDisposable` are auto-disposed
- Resources are available to subsequent steps, setups, and other resources
- Disposal happens in reverse order after scenario completion

### `.setup(name?, fn, options?)`

Registers a setup hook that runs before steps. Can return a cleanup function
that runs after all steps complete (even on failure).

| Parameter  | Type                | Description                                                                         |
| ---------- | ------------------- | ----------------------------------------------------------------------------------- |
| `name?`    | `string`            | Optional setup name (auto-generated as "Setup step 1", etc. if omitted)             |
| `fn`       | `(ctx) => Cleanup?` | Setup function that optionally returns a cleanup function or Disposable             |
| `options?` | `object`            | Per-setup timeout and retry (see [Configuration](/docs/configuration#step-options)) |

```typescript
import { client, scenario } from "@probitas-test/probitas";

// Named setup with cleanup function
scenario("Example")
  .resource("db", () =>
    client.sql.postgres.createPostgresClient({
      url: "postgresql://localhost:5432/testdb",
    }))
  .setup("Seed test data", async (ctx) => {
    const { db } = ctx.resources;
    await db.query("INSERT INTO test_data VALUES (1)");

    return async () => {
      await db.query("DELETE FROM test_data WHERE id = 1");
    };
  })
  .step(() => {})
  .build();

// Unnamed setup (auto-named as "Setup step 1", etc.)
scenario("Example")
  .resource("db", () =>
    client.sql.postgres.createPostgresClient({
      url: "postgresql://localhost:5432/testdb",
    }))
  .setup(async (ctx) => {
    const { db } = ctx.resources;
    await db.query("INSERT INTO test_data VALUES (1)");
  })
  .step(() => {})
  .build();

// Setup with Disposable
scenario("Example")
  .setup((_ctx) => {
    const handle = { close() {} };
    return {
      [Symbol.dispose]() {
        handle.close();
      },
    };
  })
  .step(() => {})
  .build();

// Setup with options
scenario("Example")
  .setup(
    "Long setup",
    async (_ctx) => {
      await Promise.resolve();
    },
    { timeout: 60000 },
  )
  .step(() => {})
  .build();
```

### `.build()`

Finalizes the scenario and returns an immutable definition. Always call this at
the end of the builder chain.

## Step Context

Every step, resource factory, and setup function receives a context object
(`ctx`) with these properties:

| Property    | Type          | Description                                                  |
| ----------- | ------------- | ------------------------------------------------------------ |
| `previous`  | `T`           | Return value from the immediately preceding step             |
| `results`   | `tuple`       | Tuple containing ALL previous step results in order          |
| `resources` | `object`      | Object containing all registered resources by name           |
| `store`     | `Map`         | Shared Map that persists across all steps                    |
| `signal`    | `AbortSignal` | Fires when the step times out; pass to cancelable operations |
| `index`     | `number`      | Zero-based index of the current step                         |

### `ctx.previous`

Use this to chain data between steps:

```typescript
import { scenario } from "@probitas-test/probitas";

scenario("Example")
  .step("Create user", async (_ctx) => {
    return { id: 1, name: "Alice" };
  })
  .step("Update user", async (ctx) => {
    const user = ctx.previous; // { id: 1, name: "Alice" }
    return { ...user, updated: true };
  })
  .build();
```

### `ctx.results`

Useful when you need data from steps other than the immediately previous one:

```typescript
import { scenario } from "@probitas-test/probitas";

scenario("Example")
  .step("Step 1", () => "first")
  .step("Step 2", () => 42)
  .step("Step 3", (ctx) => {
    const [step1, step2] = ctx.results;
    // step1: "first"
    // step2: 42
    return { step1, step2 };
  })
  .build();
```

### `ctx.resources`

Access registered resources:

```typescript
import { client, scenario } from "@probitas-test/probitas";

scenario("Example")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .resource("db", () =>
    client.sql.postgres.createPostgresClient({
      url: "postgresql://localhost:5432/testdb",
    }))
  .step("Use resources", async (ctx) => {
    const { http, db } = ctx.resources;
    // Both clients are available
    void http;
    void db;
  })
  .build();
```

### `ctx.store`

Pass data that doesn't fit the step return value pattern:

```typescript
import { scenario } from "@probitas-test/probitas";

scenario("Example")
  .step("Save to store", (ctx) => {
    ctx.store.set("key", "value");
  })
  .step("Read from store", (ctx) => {
    const value = ctx.store.get("key"); // "value"
    return value;
  })
  .build();
```

### `ctx.signal`

Pass to fetch calls or other cancelable operations:

```typescript
import { scenario } from "@probitas-test/probitas";

const url = "https://api.example.com/data";

scenario("Example")
  .step("Long operation", async (ctx) => {
    const response = await fetch(url, { signal: ctx.signal });
    return response.json();
  })
  .build();
```

## Resources

Resources are dependencies like database connections or HTTP clients that need
proper setup and teardown.

### Basic Pattern

Register a resource with a factory function. The resource becomes available to
all subsequent steps via `ctx.resources`.

```typescript
import { client, scenario } from "@probitas-test/probitas";

scenario("Example")
  .resource("http", (_ctx) => {
    // Create and return resource
    return client.http.createHttpClient({ url: "http://localhost:8080" });
  })
  .step(() => {})
  .build();
```

### Resource Dependencies

Resources can depend on earlier resources. They're created in declaration order.

```typescript
import { client, scenario } from "@probitas-test/probitas";

scenario("Example")
  .resource("config", () => ({
    url: process.env.API_URL ?? "http://localhost:8080",
  }))
  .resource("http", (ctx) => {
    const { config } = ctx.resources;
    return client.http.createHttpClient({ url: config.url });
  })
  .step(() => {})
  .build();
```

### Auto-Disposal

All Probitas clients implement `AsyncDisposable`, so they're automatically
cleaned up when the scenario ends.

```typescript
import { client, scenario } from "@probitas-test/probitas";

// All Probitas clients implement AsyncDisposable
scenario("Example")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  // Automatically disposed after scenario completes
  .step(() => {})
  .build();
```

## Setup and Cleanup

Setup hooks prepare the test environment before steps run. Cleanup functions
restore the environment afterward.

### Multiple Setups

You can chain multiple setup hooks. Each can return a cleanup function.

```typescript
import { client, scenario } from "@probitas-test/probitas";

scenario("Multi-setup")
  .resource("db", () =>
    client.sql.postgres.createPostgresClient({
      url: "postgresql://localhost:5432/testdb",
    }))
  .setup(async (ctx) => {
    // First setup: create schema
    await ctx.resources.db.query("CREATE TABLE IF NOT EXISTS test (id INT)");
  })
  .setup(async (ctx) => {
    // Second setup: seed data
    await ctx.resources.db.query("INSERT INTO test VALUES (1)");
    return async () => {
      // Cleanup: remove seeded data
      await ctx.resources.db.query("DELETE FROM test WHERE id = 1");
    };
  })
  .step("Test with data", async (_ctx) => {
    // Schema and data are ready
  })
  .build();
```

### Cleanup Order

Cleanup functions run in **reverse order** (last setup's cleanup runs first).
This ensures proper teardown of dependent resources.

```typescript
import { scenario } from "@probitas-test/probitas";

scenario("Cleanup Order Example")
  .setup(() => {
    console.log("Setup 1");
    return () => console.log("Cleanup 1"); // Runs last
  })
  .setup(() => {
    console.log("Setup 2");
    return () => console.log("Cleanup 2"); // Runs first
  })
  .step(() => {})
  .build();

// Output:
// Setup 1
// Setup 2
// (steps run)
// Cleanup 2
// Cleanup 1
```

## Skip and Error Handling

### Skipping Scenarios

Throw [`Skip`](/api/probitas/#Skip) to conditionally skip the remaining steps.
This is useful for environment-specific tests.

```typescript
import { scenario, Skip } from "@probitas-test/probitas";

scenario("Integration Test")
  .step("Check precondition", () => {
    if (!process.env.INTEGRATION_ENABLED) {
      throw new Skip("Integration tests disabled");
    }
  })
  .step("Integration test", async (_ctx) => {
    // This step is skipped if Skip was thrown
  })
  .build();
```

You can also skip from resources or setup hooks:

```typescript
import { client, scenario, Skip } from "@probitas-test/probitas";

function checkExternalService(): boolean {
  return process.env.EXTERNAL_SERVICE_URL !== undefined;
}

scenario("External Service Test")
  .resource("external", () => {
    if (!checkExternalService()) {
      throw new Skip("External service unavailable");
    }
    return client.http.createHttpClient({
      url: process.env.EXTERNAL_SERVICE_URL!,
    });
  })
  .step(() => {})
  .build();
```

### Error Handling

When a step throws an error, the scenario fails but **cleanup still runs**. This
ensures resources are properly disposed.

```typescript
import { scenario } from "@probitas-test/probitas";

scenario("Error Handling Example")
  .setup(() => {
    return () => console.log("Cleanup runs even on error");
  })
  .step("Failing step", () => {
    throw new Error("Step failed");
  })
  // Cleanup still executes
  .build();
```

### Retry on Failure

For flaky operations, configure automatic retries. See
[Configuration](/docs/configuration#retry-configuration) for detailed retry
options.

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

scenario("Retry Example")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step(
    "Flaky operation",
    async (ctx) => {
      const { http } = ctx.resources;
      const res = await http.get("/sometimes-fails");
      expect(res).toBeOk();
      return res.json;
    },
    {
      retry: { maxAttempts: 3, backoff: "exponential" },
    },
  )
  .build();
```

## Complete Examples

### HTTP API Testing

A typical CRUD test that creates, reads, updates, and deletes a resource.

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("User CRUD API", { tags: ["api", "integration"] })
  .resource("http", () =>
    client.http.createHttpClient({
      url: "http://localhost:8080",
    }))
  .step("Create user", async (ctx) => {
    const { http } = ctx.resources;
    const res = await http.post("/users", {
      body: {
        name: "Alice",
        email: "alice@example.com",
      },
    });
    expect(res).toBeOk().toHaveStatus(201).toHaveJsonMatching({
      name: "Alice",
    });
    return res.json() as { id: number };
  })
  .step("Get user", async (ctx) => {
    const { http } = ctx.resources;
    const { id } = ctx.previous;
    const res = await http.get(`/users/${id}`);
    expect(res).toBeOk().toHaveStatus(200).toHaveJsonMatching({
      id,
      name: "Alice",
    });
    return res.json() as { id: number };
  })
  .step("Update user", async (ctx) => {
    const { http } = ctx.resources;
    const { id } = ctx.previous;
    const res = await http.patch(`/users/${id}`, {
      body: { name: "Bob" },
    });
    expect(res).toBeOk().toHaveStatus(200).toHaveJsonMatching({
      name: "Bob",
    });
    return { id };
  })
  .step("Delete user", async (ctx) => {
    const { http } = ctx.resources;
    const { id } = ctx.previous;
    const res = await http.delete(`/users/${id}`);
    expect(res).toBeOk().toHaveStatus(204);
  })
  .build();
```

### Database Integration

Testing database operations with setup/cleanup for table management.

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("Database Transaction", { tags: ["db", "postgres"] })
  .resource("pg", () =>
    client.sql.postgres.createPostgresClient({
      url: {
        host: "localhost",
        port: 5432,
        database: "testdb",
        username: "testuser",
        password: "testpass",
      },
    }))
  .setup(async (ctx) => {
    const { pg } = ctx.resources;
    await pg.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      )
    `);
    return async () => {
      await pg.query("DROP TABLE IF EXISTS users");
    };
  })
  .step("Insert user with transaction", async (ctx) => {
    const { pg } = ctx.resources;
    const result = await pg.transaction(async (tx) => {
      const insert = await tx.query<{ id: number }>(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id",
        ["Alice", "alice@example.com"],
      );
      return insert.rows![0]!;
    });
    return result;
  })
  .step("Verify user exists", async (ctx) => {
    const { pg } = ctx.resources;
    const { id } = ctx.previous;
    const result = await pg.query<{ name: string }>(
      "SELECT name FROM users WHERE id = $1",
      [id],
    );
    expect(result).toBeOk().toHaveRowCount(1).toHaveRowsMatching({
      name: "Alice",
    });
  })
  .build();
```

### gRPC Service Testing

Testing gRPC services including unary calls and streaming.

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("gRPC Echo Service", { tags: ["grpc"] })
  .resource("grpc", () =>
    client.grpc.createGrpcClient({
      url: "localhost:50051",
    }))
  .step("Unary call", async (ctx) => {
    const { grpc } = ctx.resources;
    const res = await grpc.call("echo.EchoService", "Echo", {
      message: "Hello",
    });
    expect(res).toBeOk().toHaveDataMatching({ message: "Hello" });
    return res.data!;
  })
  .step("Server streaming", async (ctx) => {
    const { grpc } = ctx.resources;
    const messages: unknown[] = [];
    for await (
      const res of grpc.serverStream("echo.EchoService", "ServerStream", {
        count: 3,
      })
    ) {
      expect(res).toBeOk();
      messages.push(res.data);
    }
    return messages;
  })
  .build();
```

### Multi-Client Scenario

Combining multiple clients (HTTP, database, Redis) in a single end-to-end test.

```typescript
import { client, expect, scenario, Skip } from "@probitas-test/probitas";

export default scenario("Full Stack Test", {
  tags: ["integration", "e2e"],
})
  .resource("http", () =>
    client.http.createHttpClient({
      url: "http://localhost:8080",
    }))
  .resource("pg", () =>
    client.sql.postgres.createPostgresClient({
      url: {
        host: "localhost",
        port: 5432,
        database: "testdb",
        username: "testuser",
        password: "testpass",
      },
    }))
  .resource("redis", () =>
    client.redis.createRedisClient({
      url: "redis://localhost:6379",
    }))
  .setup(async (ctx) => {
    const { redis } = ctx.resources;
    await redis.set("api:enabled", "true");
    return async () => {
      await redis.del(["api:enabled"]);
    };
  })
  .step("Check API enabled", async (ctx) => {
    const { redis } = ctx.resources;
    const result = await redis.get("api:enabled");
    if (result.value !== "true") {
      throw new Skip("API is disabled");
    }
  })
  .step("Create via API", async (ctx) => {
    const { http } = ctx.resources;
    const res = await http.post("/items", {
      body: { name: "Test Item" },
    });
    expect(res).toBeOk().toHaveStatus(201);
    return res.json() as { id: number };
  })
  .step("Verify in database", async (ctx) => {
    const { pg } = ctx.resources;
    const { id } = ctx.previous;
    const result = await pg.query(
      "SELECT * FROM items WHERE id = $1",
      [id],
    );
    expect(result).toBeOk().toHaveRowCount(1).toHaveRowsMatching({
      name: "Test Item",
    });
  })
  .build();
```

## Best Practices

### Make Step Dependencies Explicit

Keep steps in the same scenario only when they need data from `ctx.previous`. If
a step does not read the previous result, extract it into its own scenario and
share a resource factory instead.

```typescript
import { client, scenario } from "@probitas-test/probitas";

function http() {
  return client.http.createHttpClient({
    url: process.env.API_URL ?? "http://localhost:8080",
  });
}

// Avoid - unrelated steps bundled together
scenario("User checks")
  .resource("http", http)
  .step("Create user", async (ctx) => {
    await ctx.resources.http.post("/users", { body: { name: "Alice" } });
  })
  .step("List users", async (ctx) => {
    await ctx.resources.http.get("/users");
  })
  .build();

// Good - separate scenarios that can run independently
export default [
  scenario("Create user").resource("http", http).step(() => {}).build(),
  scenario("List users").resource("http", http).step(() => {}).build(),
];
```

### Finish Builders and Exports

Every scenario must end with `.build()` and be exported as `export default`,
either as a single scenario or an array of scenarios.

```typescript
import { scenario } from "@probitas-test/probitas";

// Correct - single scenario
export default scenario("Example").step(() => {}).build();
```

```typescript
import { scenario } from "@probitas-test/probitas";

// Correct - multiple scenarios
export default [
  scenario("First").step(() => {}).build(),
  scenario("Second").step(() => {}).build(),
];
```

### Use Environment-Driven URLs

Parameterize endpoints so tests run consistently across environments and avoid
hard-coding localhost URLs.

```typescript
import { client, scenario } from "@probitas-test/probitas";

const apiUrl = process.env.API_URL ?? "http://localhost:8080";

export default scenario("API test")
  .resource("http", () => client.http.createHttpClient({ url: apiUrl }))
  .step(() => {})
  .build();
```

### Prefer Fluent Assertions

Use `expect()` chains instead of manual `if/throw` checks, and keep related
assertions in a single chain for clearer failures.

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

// Avoid - manual checks
if (res.status !== 200) {
  throw new Error(`Expected 200, got ${res.status}`);
}

// Good - fluent assertions
expect(res)
  .toBeOk()
  .toHaveStatus(200)
  .not.toHaveJsonProperty(["metadata", "x-internal-token"]);
```

### Use Descriptive Step Names

Good names make test output readable and debugging easier.

```typescript
import { scenario } from "@probitas-test/probitas";

// Good
scenario("Email Test")
  .step("Create user with valid email", () => {})
  .step("Verify email confirmation sent", () => {})
  .build();

// Avoid
scenario("Email Test")
  .step("Step 1", () => {})
  .step("Test", () => {})
  .build();
```

### Return Meaningful Values

Return data that subsequent steps need. This enables type-safe data flow through
`ctx.previous`.

Good - returns data needed by next step:

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

scenario("User creation and retrieval")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step("Create user", async (ctx) => {
    const res = await ctx.resources.http.post("/users", {
      body: {
        name: "Alice",
        email: "alice@example.com",
      },
    });
    return res.json() as { id: number };
  })
  .step("Get created user", async (ctx) => {
    // ctx.previous is typed as { id: number }
    const res = await ctx.resources.http.get(`/users/${ctx.previous.id}`);
    expect(res).toHaveStatus(200).toHaveJsonMatching({ name: "Alice" });
  })
  .build();
```

Avoid - loses useful data:

```ts
import { client, expect, scenario } from "@probitas-test/probitas";

scenario("User creation and retrieval")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step("Create user", async (ctx) => {
    await ctx.resources.http.post("/users", {
      body: {
        name: "Alice",
        email: "alice@example.com",
      },
    });
    // No return value - next step can't access created user's ID!
  })
  .step("Get created user", async (ctx) => {
    // ctx.previous is undefined - we lost the user ID!
    const res = await ctx.resources.http.get("/users/???");
    expect(res).toHaveStatus(200);
  })
  .build();
```

### Use Tags for Filtering

Tags let you run subsets of tests (e.g., only fast tests, or only tests that
don't need Docker).

```typescript
import { scenario } from "@probitas-test/probitas";

scenario("Slow Integration Test", {
  tags: ["integration", "slow", "requires-docker"],
})
  .step(() => {})
  .build();
```

### Keep Steps Focused

Each step should do one thing. This makes failures easier to diagnose and tests
easier to maintain.

```typescript
import { scenario } from "@probitas-test/probitas";

// Good - single responsibility
scenario("Order Flow - Good")
  .step("Create order", () => {})
  .step("Process payment", () => {})
  .step("Send confirmation", () => {})
  .build();

// Avoid - too many concerns
scenario("Order Flow - Avoid")
  .step("Create order, process payment, and send confirmation", () => {})
  .build();
```

### Use Setup for Test Data

Setup hooks with cleanup are better than steps for managing test fixtures. They
guarantee cleanup even on failure.

```typescript
import { client, scenario } from "@probitas-test/probitas";

async function seedTestData(
  _db: Awaited<
    ReturnType<typeof client.sql.postgres.createPostgresClient>
  >,
): Promise<void> {}
async function cleanupTestData(
  _db: Awaited<
    ReturnType<typeof client.sql.postgres.createPostgresClient>
  >,
): Promise<void> {}

// Good - setup manages test data lifecycle
scenario("Good Setup Example")
  .resource("db", () =>
    client.sql.postgres.createPostgresClient({
      url: "postgresql://localhost:5432/testdb",
    }))
  .setup(async (ctx) => {
    await seedTestData(ctx.resources.db);
    return () => cleanupTestData(ctx.resources.db);
  })
  .step(() => {})
  .build();

// Avoid - pollutes step logic
scenario("Avoid Setup Example")
  .resource("db", () =>
    client.sql.postgres.createPostgresClient({
      url: "postgresql://localhost:5432/testdb",
    }))
  .step("Setup test data", async (ctx) => {
    await seedTestData(ctx.resources.db);
  })
  .build();
```

### Split Scenarios for Better Organization

Export multiple focused scenarios from a single file rather than one large
scenario. This provides several benefits:

- **Parallel execution**: Separate scenarios can run concurrently, improving
  overall test speed
- **Tag filtering**: Each scenario can have its own tags for fine-grained test
  selection
- **Clear failure identification**: When a test fails, you immediately know
  which specific scenario failed

Good - multiple focused scenarios:

```typescript
// user-validation.probitas.ts
import { client, expect, scenario } from "@probitas-test/probitas";

export default [
  scenario("User validation - rejects empty name", {
    tags: ["api", "validation"],
  })
    .resource(
      "http",
      () => client.http.createHttpClient({ url: "http://localhost:8080" }),
    )
    .step("Create user with empty name", async (ctx) => {
      const res = await ctx.resources.http.post("/users", {
        body: { name: "" },
      });
      expect(res).toHaveStatus(400);
    })
    .build(),

  scenario("User validation - rejects duplicate email", {
    tags: ["api", "validation"],
  })
    .resource(
      "http",
      () => client.http.createHttpClient({ url: "http://localhost:8080" }),
    )
    .setup(async (ctx) => {
      const res = await ctx.resources.http.post("/users", {
        body: {
          name: "Alice",
          email: "alice@example.com",
        },
      });
      const user = res.json() as { id: number };
      return async () => {
        await ctx.resources.http.delete(`/users/${user.id}`);
      };
    })
    .step("Create user with duplicate email", async (ctx) => {
      const res = await ctx.resources.http.post("/users", {
        body: {
          name: "Bob",
          email: "alice@example.com",
        },
      });
      expect(res).toHaveStatus(409);
    })
    .build(),

  scenario("User validation - rejects invalid email format", {
    tags: ["api", "validation"],
  })
    .resource(
      "http",
      () => client.http.createHttpClient({ url: "http://localhost:8080" }),
    )
    .step("Create user with invalid email", async (ctx) => {
      const res = await ctx.resources.http.post("/users", {
        body: {
          name: "Alice",
          email: "not-an-email",
        },
      });
      expect(res).toHaveStatus(400);
    })
    .build(),
];
```

Avoid - one monolithic scenario:

```ts
// user-validation.probitas.ts
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("User validation", { tags: ["api", "validation"] })
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step("Reject empty name", async (ctx) => {
    const res = await ctx.resources.http.post("/users", {
      body: { name: "" },
    });
    expect(res).toHaveStatus(400);
  })
  .step("Reject duplicate email", async (ctx) => {
    // Create first user
    await ctx.resources.http.post("/users", {
      body: {
        name: "Alice",
        email: "alice@example.com",
      },
    });
    // Try to create another user with same email
    const res = await ctx.resources.http.post("/users", {
      body: {
        name: "Bob",
        email: "alice@example.com",
      },
    });
    expect(res).toHaveStatus(409);
  })
  .step("Reject invalid email format", async (ctx) => {
    const res = await ctx.resources.http.post("/users", {
      body: {
        name: "Alice",
        email: "not-an-email",
      },
    });
    expect(res).toHaveStatus(400);
  })
  .build();
```

However, when steps are part of a sequential workflow where each step depends on
the previous one, keep them in a single scenario. Use `ctx.previous` to pass
data between steps:

Good - sequential CRUD operations as a single scenario:

```ts
// user-crud.probitas.ts
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("User CRUD workflow", { tags: ["api", "crud"] })
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step("Create user", async (ctx) => {
    const res = await ctx.resources.http.post("/users", {
      body: {
        name: "Alice",
        email: "alice@example.com",
      },
    });
    expect(res).toHaveStatus(201);
    return res.json() as { id: number };
  })
  .step("Get user", async (ctx) => {
    const res = await ctx.resources.http.get(`/users/${ctx.previous.id}`);
    expect(res).toHaveStatus(200).toHaveJsonMatching({ name: "Alice" });
    return ctx.previous;
  })
  .step("Update user", async (ctx) => {
    const res = await ctx.resources.http.patch(`/users/${ctx.previous.id}`, {
      body: { name: "Alice Smith" },
    });
    expect(res).toHaveStatus(200);
    return ctx.previous;
  })
  .step("Delete user", async (ctx) => {
    const res = await ctx.resources.http.delete(`/users/${ctx.previous.id}`);
    expect(res).toHaveStatus(204);
  })
  .build();
```

Avoid - splitting sequential workflow into separate scenarios:

```ts
// user-crud.probitas.ts - DON'T do this!
import { client, expect, scenario } from "@probitas-test/probitas";

// These scenarios cannot run in parallel - they share state!
export default [
  scenario("User CRUD - create", { tags: ["api", "crud"] })
    .resource(
      "http",
      () => client.http.createHttpClient({ url: "http://localhost:8080" }),
    )
    .step("Create user", async (ctx) => {
      const res = await ctx.resources.http.post("/users", {
        body: {
          name: "Alice",
          email: "alice@example.com",
        },
      });
      expect(res).toHaveStatus(201);
      // Problem: How do we pass the user ID to the next scenario?
    })
    .build(),

  scenario("User CRUD - get", { tags: ["api", "crud"] })
    .resource(
      "http",
      () => client.http.createHttpClient({ url: "http://localhost:8080" }),
    )
    .step("Get user", async (ctx) => {
      // Problem: We don't know the user ID from the previous scenario!
      const res = await ctx.resources.http.get("/users/???");
      expect(res).toHaveStatus(200);
    })
    .build(),
];
```

## Common Mistakes

- Forgetting `export default` or `.build()` when returning the scenario builder
- Bundling independent tests in one scenario instead of splitting them when they
  do not use `ctx.previous`
- Hard-coding endpoints instead of using environment-driven URLs
- Using manual `if/throw` checks instead of fluent `expect()` chains
- Omitting cleanup functions from `.setup()` when creating external fixtures
