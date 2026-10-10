# Client

Learn how to use Probitas clients to interact with various services and
protocols. This guide covers available clients, common patterns, and best
practices for effective testing.

## Overview

Probitas provides unified client APIs for connecting to external services during
scenario testing. All clients share common patterns:

- **Unified namespace**: Access all clients via `client.*`
- **Automatic cleanup**: Clients implement `AsyncDisposable` for resource
  management
- **Consistent options**: Common settings like timeout, retry, and abort signal
- **Built-in assertions**: Use `expect()` for response validation

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("API Test")
  .resource("http", () =>
    client.http.createHttpClient({
      url: "http://localhost:8080",
    }))
  .step("Make request", async (ctx) => {
    const { http } = ctx.resources;
    const res = await http.get("/health");
    expect(res).toBeOk();
  })
  .build();
```

## Common Options

All clients accept common options like `timeout`, `signal`, and `retry`. See
[Configuration](/docs/configuration#retry-configuration) for detailed retry
settings.

### Resource Lifecycle

Register clients as resources for automatic lifecycle management. Resources are
disposed in reverse order after the scenario completes.

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

scenario("Example")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step(() => {})
  .build();
// Resource automatically disposed when scenario ends
```

For manual control outside scenarios, use `await using`:

```typescript
import { client } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
// Automatically closed when scope exits
```

## [HTTP Client](/api/client-http/#createHttpClient)

The HTTP client provides a fluent API for making HTTP requests with built-in
JSON handling and response assertions.

```typescript
import { client } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
  headers: { "Content-Type": "application/json" },
  throwOnError: true,
});
```

See [Configuration](/docs/configuration#http-client) for all options.

### Making Requests

The client supports all standard HTTP methods:

```typescript
import { client } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});

// GET with query parameters
const res1 = await http.get("/users", {
  query: { page: 1, limit: 10 },
});

// POST with JSON body
const res2 = await http.post("/users", {
  body: {
    name: "Alice",
    email: "alice@example.com",
  },
});

// PUT, PATCH, DELETE
await http.put("/users/1", { body: { name: "Alice Updated" } });
await http.patch("/users/1", {
  body: { email: "new@example.com" },
});
await http.delete("/users/1");
```

Override client settings per request:

```typescript
import { client } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});

// Custom headers for authenticated request
const res1 = await http.get("/protected", {
  headers: { Authorization: "Bearer token123" },
});

// Disable error throwing for expected failures
const res2 = await http.get("/maybe-404", {
  throwOnError: false,
});
if (!res2.ok) {
  console.log("Status:", res2.status);
}
```

### Assertions

Validate responses with chainable assertions:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

expect(res)
  .toBeOk() // Status 2xx
  .toHaveStatus(200) // Exact status code
  .toHaveHeadersPropertyContaining("content-type", "application/json") // Content-Type contains
  .toHaveJsonMatching({ name: "Alice" }) // Partial JSON match
  .toHaveDurationLessThan(1000); // Response time limit

// Additional assertions examples
const res2 = await http.get("/error", { throwOnError: false });
expect(res2).not.toBeOk(); // Status not 2xx
expect(res).toHaveHeadersProperty("X-Request-Id");
expect(res).toHaveTextContaining("success");
expect(res).toHaveJsonPresent(); // Check if response has JSON data
```

### OIDC Authentication

The HTTP client supports OIDC (OpenID Connect) authentication for testing
authenticated API endpoints. This module provides utilities for automated login
flows with token management.

**Important**: This is designed for testing only. Use proper OIDC libraries in
production.

```typescript
import { client } from "@probitas-test/probitas";

await using http = await client.http.oidc.createOidcHttpClient({
  url: "http://localhost:8080",
  oidc: {
    issuer: "http://localhost:8080", // Auto-discover from /.well-known/openid-configuration
    clientId: "test-client",
  },
});
```

#### Login Flow

Perform Authorization Code Grant login with automated form submission:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = await client.http.oidc.createOidcHttpClient({
  url: "http://localhost:8080",
  oidc: {
    issuer: "http://localhost:8080",
    clientId: "test-client",
  },
});

// Login with username/password
const result = await http.login({
  type: "authorization_code",
  username: "testuser",
  password: "testpass",
});

if (result.ok) {
  console.log("Access token:", result.token.accessToken);
  console.log("Token type:", result.token.tokenType);
  console.log("Expires in:", result.token.expiresIn);
} else {
  console.error("Login failed:", result.error.message);
}
```

#### Authenticated Requests

After successful login, the Authorization header is automatically injected into
all requests:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = await client.http.oidc.createOidcHttpClient({
  url: "http://localhost:8080",
  oidc: {
    issuer: "http://localhost:8080",
    clientId: "test-client",
  },
});

const result = await http.login({
  type: "authorization_code",
  username: "testuser",
  password: "testpass",
});

expect(result.ok).toBe(true);

// Authorization header automatically set
const res = await http.get("/api/profile");
expect(res).toBeOk().toHaveJsonMatching({ username: "testuser" });

// Works with all HTTP methods
await http.post("/api/data", { body: { value: 42 } });
await http.put("/api/data/1", { body: { value: 100 } });
```

#### OIDC Discovery

OIDC Discovery (RFC 8414) automatically fetches endpoints from
`/.well-known/openid-configuration`:

```typescript
import { client } from "@probitas-test/probitas";

await using http = await client.http.oidc.createOidcHttpClient({
  url: "http://localhost:8080",
  oidc: {
    issuer: "http://localhost:8080", // Discovers authorization_endpoint and token_endpoint
    clientId: "test-client",
    // Optional: customize redirect URI and scope
    // redirectUri: "http://localhost/callback",
    // scope: "openid profile email",
  },
});
```

#### Token Management

Access and manage tokens:

```typescript
import { client } from "@probitas-test/probitas";

await using http = await client.http.oidc.createOidcHttpClient({
  url: "http://localhost:8080",
  oidc: {
    issuer: "http://localhost:8080",
    clientId: "test-client",
  },
});

await http.login({
  type: "authorization_code",
  username: "testuser",
  password: "testpass",
});

// Get current token
const token = http.getToken();
if (token) {
  console.log("Access token:", token.accessToken);
  console.log("Refresh token:", token.refreshToken);
}

// Clear authentication
await http.logout();
```

## SQL Clients

Probitas supports multiple SQL databases with a consistent query interface.

| Database   | Client Factory                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------- |
| PostgreSQL | [`client.sql.postgres.createPostgresClient()`](/api/client-sql-postgres/#createPostgresClient) |
| MySQL      | [`client.sql.mysql.createMySqlClient()`](/api/client-sql-mysql/#createMySqlClient)             |
| SQLite     | [`client.sql.sqlite.createSqliteClient()`](/api/client-sql-sqlite/#createSqliteClient)         |
| DuckDB     | [`client.sql.duckdb.createDuckDbClient()`](/api/client-sql-duckdb/#createDuckDbClient)         |

The DuckDB native binding is downloaded the first time a scenario creates a
DuckDB client. See [Native Dependencies](/docs/overview/#native-dependencies) to
pre-fetch it for CI or offline use.

```typescript
import { client } from "@probitas-test/probitas";

await using pg = await client.sql.postgres.createPostgresClient({
  url: "postgres://testuser:testpass@localhost:5432/testdb",
});
```

See [Configuration](/docs/configuration#postgresql-client) for all options.

### Queries

Run queries with parameterized values:

```typescript
import { client } from "@probitas-test/probitas";

await using pg = await client.sql.postgres.createPostgresClient({
  url: "postgres://testuser:testpass@localhost:5432/testdb",
});

// Simple query
const result1 = await pg.query("SELECT * FROM users");

// Parameterized query (type-safe)
const userId = 1;
const result2 = await pg.query<{ id: number; name: string }>(
  "SELECT * FROM users WHERE id = $1",
  [userId],
);

// Access results
const allRows = result2.rows ?? []; // All rows
const first = result2.rows?.[0]; // First row
const rowCount = result2.rowCount; // Row count
```

### Transactions

Wrap multiple queries in a transaction:

```typescript
import { client } from "@probitas-test/probitas";

await using pg = await client.sql.postgres.createPostgresClient({
  url: "postgres://testuser:testpass@localhost:5432/testdb",
});

const result = await pg.transaction(async (tx) => {
  const insert = await tx.query<{ id: number }>(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id",
    ["Alice", "alice@example.com"],
  );

  await tx.query(
    "INSERT INTO profiles (user_id, bio) VALUES ($1, $2)",
    [insert.rows?.[0]!.id, "Hello!"],
  );

  return insert.rows?.[0];
});
```

### Assertions

Validate query results:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using pg = await client.sql.postgres.createPostgresClient({
  url: "postgres://testuser:testpass@localhost:5432/testdb",
});

const result = await pg.query("SELECT * FROM users WHERE name = $1", ["Alice"]);

expect(result)
  .toBeOk()
  .toHaveRowCount(1)
  .toHaveRowsMatching({ name: "Alice" });

// Match multiple rows
const allResult = await pg.query("SELECT * FROM users");
expect(allResult).toHaveRowsMatching([
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
]);

// Additional row assertions
expect(result).not.toHaveRowsEmpty(); // Check if query returned any rows
expect(result).toHaveRowCountGreaterThan(0); // More than 0 rows
expect(result).toHaveRowCountLessThanOrEqual(10); // At most 10 rows
```

## [gRPC Client](/api/client-grpc/#createGrpcClient)

The gRPC client supports unary calls, server streaming, client streaming, and
bidirectional streaming.

```typescript
import { client } from "@probitas-test/probitas";

await using grpc = client.grpc.createGrpcClient({
  url: "localhost:50051",
  metadata: { authorization: "Bearer token" },
});
```

See [Configuration](/docs/configuration#grpc-client) for all options.

### Unary Calls

Standard request-response pattern:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using grpc = client.grpc.createGrpcClient({ url: "localhost:50051" });

const res = await grpc.call("echo.EchoService", "Echo", {
  message: "Hello",
});

expect(res).toBeOk().toHaveDataMatching({ message: "Hello" });
// Note: For gRPC responses, use toHaveDataMatching (not toHaveJsonMatching)
const data = res.data;
```

### Server Streaming

Receive multiple responses from a single request:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using grpc = client.grpc.createGrpcClient({ url: "localhost:50051" });

const messages: unknown[] = [];
for await (
  const res of grpc.serverStream("echo.EchoService", "ServerStream", {
    count: 3,
  })
) {
  expect(res).toBeOk();
  messages.push(res.data);
}
```

### Client Streaming

Send multiple requests, receive a single response:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using grpc = client.grpc.createGrpcClient({ url: "localhost:50051" });

const res = await grpc.clientStream(
  "echo.EchoService",
  "ClientStream",
  (async function* () {
    yield { message: "First" };
    yield { message: "Second" };
    yield { message: "Third" };
  })(),
);
expect(res).toBeOk();
```

### Bidirectional Streaming

Stream in both directions simultaneously:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using grpc = client.grpc.createGrpcClient({ url: "localhost:50051" });

for await (
  const res of grpc.bidiStream(
    "echo.EchoService",
    "BidiStream",
    (async function* () {
      yield { message: "Ping 1" };
      yield { message: "Ping 2" };
    })(),
  )
) {
  expect(res).toBeOk();
  console.log("Received:", res.data);
}
```

## [ConnectRPC Client](/api/client-connectrpc/#createConnectRpcClient)

The ConnectRPC client supports Connect, gRPC, and gRPC-Web protocols with a
unified API.

```typescript
import { client } from "@probitas-test/probitas";

await using connect = client.connectrpc.createConnectRpcClient({
  url: "localhost:8080",
});
```

### Unary Calls

```typescript
import { client, expect } from "@probitas-test/probitas";

await using connect = client.connectrpc.createConnectRpcClient({
  url: "localhost:8080",
});

const res = await connect.call("echo.EchoService", "Echo", {
  message: "Hello",
});

expect(res).toBeOk().toHaveDataMatching({ message: "Hello" });
// Note: For gRPC responses, use toHaveDataMatching (not toHaveJsonMatching)
```

### Server Streaming

```typescript
import { client, expect } from "@probitas-test/probitas";

await using connect = client.connectrpc.createConnectRpcClient({
  url: "localhost:8080",
});

for await (
  const res of connect.serverStream("echo.EchoService", "ServerStream", {
    count: 3,
  })
) {
  expect(res).toBeOk();
  console.log("Received:", res.data);
}
```

## [GraphQL Client](/api/client-graphql/#createGraphqlClient)

The GraphQL client provides methods for queries, mutations, and subscriptions.

```typescript
import { client } from "@probitas-test/probitas";

await using graphql = client.graphql.createGraphqlClient({
  url: "http://localhost:4000/graphql",
  headers: { Authorization: "Bearer token" },
});
```

See [Configuration](/docs/configuration#graphql-client) for all options.

### Queries

Fetch data with GraphQL queries:

```typescript
import { client, expect, outdent } from "@probitas-test/probitas";

await using graphql = client.graphql.createGraphqlClient({
  url: "http://localhost:4000/graphql",
});

const res = await graphql.query(
  outdent`
    query GetUser($id: ID!) {
      user(id: $id) {
        id
        name
        email
      }
    }
  `,
  { id: "1" },
);

expect(res).toBeOk().toHaveDataMatching({
  user: { name: "Alice" },
});
const user =
  (res.data() as { user: { id: string; name: string; email: string } }).user;
```

### Mutations

Modify data with GraphQL mutations:

```typescript
import { client, expect, outdent } from "@probitas-test/probitas";

await using graphql = client.graphql.createGraphqlClient({
  url: "http://localhost:4000/graphql",
});

const res = await graphql.mutation(
  outdent`
    mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) {
        id
        name
      }
    }
  `,
  { input: { name: "Alice", email: "alice@example.com" } },
);

expect(res).toBeOk();
const newUser =
  (res.data() as { createUser: { id: string; name: string } }).createUser;
```

### Subscriptions

Listen for real-time updates:

```typescript
import { client, expect, outdent } from "@probitas-test/probitas";

await using graphql = client.graphql.createGraphqlClient({
  url: "http://localhost:4000/graphql",
});

const subscription = graphql.subscribe(outdent`
  subscription OnUserCreated {
    userCreated {
      id
      name
    }
  }
`);

for await (const res of subscription) {
  expect(res).toBeOk();
  console.log(
    "New user:",
    (res.data() as { userCreated: { id: string; name: string } }).userCreated,
  );
}
```

### Error and Extension Assertions

Check for GraphQL errors and extensions:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using graphql = client.graphql.createGraphqlClient({
  url: "http://localhost:4000/graphql",
});

const res = await graphql.query("query { user(id: 1) { name } }");

// Check for errors
expect(res).toHaveErrorPresent(); // Has GraphQL errors
expect(res).toHaveError({ message: "Not found" }); // Specific error

// Or check for no errors
expect(res).toHaveErrorNullish(); // No GraphQL errors

// Check for extensions
expect(res).toHaveExtensionsProperty("tracing"); // Has tracing extension
expect(res).toHaveExtensionsPropertyContaining("tracing", { version: 1 }); // Extension with value
```

## [Redis Client](/api/client-redis/#createRedisClient)

The Redis client provides operations for strings, hashes, lists, and sets.

```typescript
import { client } from "@probitas-test/probitas";

await using redis = await client.redis.createRedisClient({
  url: "redis://localhost:6379",
});
```

See [Configuration](/docs/configuration#redis-client) for all options.

### Operations

Common Redis operations:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using redis = await client.redis.createRedisClient({
  url: "redis://localhost:6379",
});

// Strings
await redis.set("key", "value");
await redis.set("key", "value", { ex: 3600 }); // With TTL
const result = await redis.get("key");
expect(result).toBeOk().toHaveValue("value");

// Hashes
await redis.hset("user:1", "name", "Alice");
await redis.hset("user:1", "age", "30");
const user = await redis.hgetall("user:1");

// Lists
await redis.lpush("queue", ["task1", "task2"]);
const task = await redis.rpop("queue");

// Sets
await redis.sadd("tags", ["typescript", "deno"]);
const tags = await redis.smembers("tags");

// Delete
await redis.del(["key"]);

// Value assertions
expect(result).toHaveValuePresent(); // Check if value exists
expect(result).toHaveValue("expected"); // Match exact value
expect(result).toHaveValueContaining("substring"); // Value contains substring
// expect(result).toHaveValueCount(5); // String length or collection size
```

## [MongoDB Client](/api/client-mongodb/#createMongoClient)

The MongoDB client provides document operations with a familiar API.

```typescript
import { client } from "@probitas-test/probitas";

await using mongo = await client.mongodb.createMongoClient({
  url: "mongodb://localhost:27017",
  database: "testdb",
});
```

See [Configuration](/docs/configuration#mongodb-client) for all options.

### Operations

Work with collections and documents:

```typescript
import { client, expect } from "@probitas-test/probitas";

interface User {
  name: string;
  email: string;
  age?: number;
}

await using mongo = await client.mongodb.createMongoClient({
  url: "mongodb://localhost:27017",
  database: "testdb",
});

const users = mongo.collection<User>("users");

// Insert
const result = await users.insertOne({
  name: "Alice",
  email: "alice@example.com",
});
expect(result).toBeOk();

// Find
const user = await users.findOne({ _id: result.insertedId });
expect(user).toBeOk().toHaveDocMatching({ name: "Alice" });

// Find many
const allUsersResult = await users.find({ age: { $gte: 18 } });
const allUsers = allUsersResult.docs;

// Update
await users.updateOne(
  { _id: result.insertedId },
  { $set: { name: "Bob" } },
);

// Delete
const deleteResult = await users.deleteOne({ _id: result.insertedId });

// Document assertions
expect(result).toHaveInsertedId(result.insertedId); // Check inserted ID
expect(allUsersResult).toHaveDocsCount(5); // Exactly 5 documents
expect(allUsersResult).toHaveDocsMatching([{ name: "Alice" }]); // Match multiple documents
expect(deleteResult).toHaveDeletedCount(1); // 1 document deleted
```

## [RabbitMQ Client](/api/client-rabbitmq/#createRabbitMqClient)

The RabbitMQ client provides AMQP messaging for publish/subscribe patterns.

```typescript
import { client } from "@probitas-test/probitas";

await using rabbitmq = await client.rabbitmq.createRabbitMqClient({
  url: "amqp://guest:guest@localhost:5672",
});
```

See [Configuration](/docs/configuration#rabbitmq-client) for all options.

### Operations

```typescript
import { client, expect } from "@probitas-test/probitas";

await using rabbitmq = await client.rabbitmq.createRabbitMqClient({
  url: "amqp://guest:guest@localhost:5672",
});

const channel = await rabbitmq.channel();

// Declare queue
await channel.assertQueue("my-queue", { durable: false });

// Send message
const content = new TextEncoder().encode(JSON.stringify({ message: "Hello" }));
await channel.sendToQueue("my-queue", content);

// Receive message
const result = await channel.get("my-queue");
expect(result).toBeOk();
if (result.message) {
  await channel.ack(result.message);
}

await channel.close();
```

## [SQS Client](/api/client-sqs/#createSqsClient)

The AWS SQS client provides cloud message queue operations.

```typescript
import { client } from "@probitas-test/probitas";

await using sqs = await client.sqs.createSqsClient({
  url: "http://localhost:4566", // LocalStack or AWS endpoint
  region: "us-east-1",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});
```

See [Configuration](/docs/configuration#sqs-client) for all options.

### Operations

```typescript
import { client, expect } from "@probitas-test/probitas";

await using sqs = await client.sqs.createSqsClient({
  url: "http://localhost:4566",
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

// Ensure queue exists
await sqs.ensureQueue("my-queue");

// Send message
const result = await sqs.send(JSON.stringify({ event: "user.created" }));
expect(result).toBeOk().toHaveMessageId(result.messageId);

// Receive and process
const receiveResult = await sqs.receive({ maxMessages: 10 });
for (const msg of receiveResult.messages ?? []) {
  console.log("Received:", msg.body);
  await sqs.delete(msg.receiptHandle);
}
```

## Available Clients

| Client     | Factory Function                                                                               | Use Case             |
| ---------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| HTTP       | [`client.http.createHttpClient()`](/api/client-http/#createHttpClient)                         | REST APIs, webhooks  |
| HTTP OIDC  | [`client.http.oidc.createOidcHttpClient()`](/api/client-http/#createOidcHttpClient)            | Authenticated APIs   |
| PostgreSQL | [`client.sql.postgres.createPostgresClient()`](/api/client-sql-postgres/#createPostgresClient) | PostgreSQL databases |
| MySQL      | [`client.sql.mysql.createMySqlClient()`](/api/client-sql-mysql/#createMySqlClient)             | MySQL databases      |
| SQLite     | [`client.sql.sqlite.createSqliteClient()`](/api/client-sql-sqlite/#createSqliteClient)         | Embedded databases   |
| DuckDB     | [`client.sql.duckdb.createDuckDbClient()`](/api/client-sql-duckdb/#createDuckDbClient)         | Analytics databases  |
| gRPC       | [`client.grpc.createGrpcClient()`](/api/client-grpc/#createGrpcClient)                         | gRPC services        |
| ConnectRPC | [`client.connectrpc.createConnectRpcClient()`](/api/client-connectrpc/#createConnectRpcClient) | Connect/gRPC-Web     |
| GraphQL    | [`client.graphql.createGraphqlClient()`](/api/client-graphql/#createGraphqlClient)             | GraphQL APIs         |
| Redis      | [`client.redis.createRedisClient()`](/api/client-redis/#createRedisClient)                     | Cache, pub/sub       |
| MongoDB    | [`client.mongodb.createMongoClient()`](/api/client-mongodb/#createMongoClient)                 | Document databases   |
| RabbitMQ   | [`client.rabbitmq.createRabbitMqClient()`](/api/client-rabbitmq/#createRabbitMqClient)         | AMQP message queues  |
| SQS        | [`client.sqs.createSqsClient()`](/api/client-sqs/#createSqsClient)                             | AWS message queues   |

## Best Practices

### Register Clients as Resources

Always register clients as resources for automatic cleanup:

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

// Good - automatic lifecycle management
scenario("Example")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step(() => {})
  .build();

// Avoid - manual cleanup required
scenario("Bad Example")
  .step("Make request", async () => {
    const http = client.http.createHttpClient({ url: "http://localhost:8080" });
    // Must manually dispose
  })
  .build();
```

### Use Environment-Driven Endpoints

Parameterize service URLs so scenarios run consistently across environments and
avoid hard-coded localhost values.

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

const apiUrl = process.env.API_URL ?? "http://localhost:8080";

scenario("API check")
  .resource("http", () => client.http.createHttpClient({ url: apiUrl }))
  .step("Ping service", async (ctx) => {
    const res = await ctx.resources.http.get("/health");
    expect(res).toBeOk();
  })
  .build();
```

### Use Type Parameters

Provide type parameters for type-safe responses:

```typescript
import { client } from "@probitas-test/probitas";

await using pg = await client.sql.postgres.createPostgresClient({
  url: "postgres://testuser:testpass@localhost:5432/testdb",
});

const userId = 1;

// Good - typed response
const result1 = await pg.query<{ id: number; name: string }>(
  "SELECT id, name FROM users WHERE id = $1",
  [userId],
);
const user = result1.rows?.[0]; // Type: { id: number; name: string } | undefined

// Avoid - untyped response
const result2 = await pg.query("SELECT * FROM users");
```

### Handle Errors Appropriately

Use assertions for expected successes, explicit checks for expected failures:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});

// Expected success - use assertions
const res1 = await http.get("/users/1");
expect(res1).toBeOk().toHaveStatus(200);

// Expected failure - disable throwing, check manually
const res2 = await http.get("/users/nonexistent", { throwOnError: false });
expect(res2).toHaveStatus(404);
```

### Configure Retries

Use retry configuration for network-dependent operations. See
[Configuration](/docs/configuration#retry-configuration) for all retry options.

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

scenario("Retry Example")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step(
    "External API call",
    async (ctx) => {
      const { http } = ctx.resources;
      const res = await http.get("/external-api", {
        retry: { maxAttempts: 3, backoff: "exponential" },
      });
      expect(res).toBeOk();
    },
    {
      timeout: 10000, // Allow time for retries
    },
  )
  .build();
```
