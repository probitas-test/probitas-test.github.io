# Expect

Learn how to use Probitas assertions to validate responses from various clients.
The [`expect()`](/api/expect/#expect) function provides a unified, type-safe API
for asserting on results from HTTP, SQL, Redis, MongoDB, and other clients.

## Overview

Probitas provides a fluent assertion API that automatically dispatches to
specialized expectations based on the input type:

- **Type-safe**: Compile-time checks ensure correct method usage
- **Auto-dispatch**: `expect()` detects the response type and provides
  appropriate assertions
- **Method chaining**: All assertions return `this` for fluent syntax
- **Consistent naming**: Methods follow `toBeXxx` or `toHaveXxx` patterns

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("Assertion Example")
  .resource("http", () =>
    client.http.createHttpClient({
      url: "http://localhost:8080",
    }))
  .step("Validate response", async (ctx) => {
    const { http } = ctx.resources;
    const res = await http.get("/users/1");

    // Chained assertions - each returns `this`
    expect(res)
      .toBeOk()
      .toHaveStatus(200)
      .toHaveJsonMatching({ id: 1, name: "Alice" });
  })
  .build();
```

## Negation with `.not`

All expectation types support the `.not` modifier to negate assertions. The
`.not` modifier only affects the immediately following assertion, then resets to
non-negated state:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

// .not only affects the next assertion
expect(res)
  .not.toHaveStatus(404) // Negated: status is NOT 404
  .not.toHaveStatus(500) // Negated: status is NOT 500
  .toHaveStatus(200); // Not negated: status IS 200

// Works with generic expectations too
expect(42)
  .not.toBe(43) // Negated
  .toBeGreaterThan(40); // Not negated

expect("hello world")
  .not.toBe("goodbye")
  .not.toBeNull()
  .toContain("world");
```

## Unified expect Function

The [`expect()`](/api/expect/#expect) function automatically dispatches to the
appropriate expectation based on the input type:

| Input Type           | Expectation Class                                                             | Source Client |
| -------------------- | ----------------------------------------------------------------------------- | ------------- |
| `HttpResponse`       | [`HttpResponseExpectation`](/api/expect/#HttpResponseExpectation)             | HTTP          |
| `GraphqlResponse`    | [`GraphqlResponseExpectation`](/api/expect/#GraphqlResponseExpectation)       | GraphQL       |
| `GrpcResponse`       | [`GrpcResponseExpectation`](/api/expect/#GrpcResponseExpectation)             | gRPC          |
| `ConnectRpcResponse` | [`ConnectRpcResponseExpectation`](/api/expect/#ConnectRpcResponseExpectation) | ConnectRPC    |
| `SqlQueryResult`     | [`SqlQueryResultExpectation`](/api/expect/#SqlQueryResultExpectation)         | SQL           |
| `RedisResult`        | [`RedisExpectation`](/api/expect/#RedisExpectation)                           | Redis         |
| `MongoResult`        | [`MongoExpectation`](/api/expect/#MongoExpectation)                           | MongoDB       |
| `RabbitMqResult`     | [`RabbitMqExpectation`](/api/expect/#RabbitMqExpectation)                     | RabbitMQ      |
| `SqsResult`          | [`SqsExpectation`](/api/expect/#SqsExpectation)                               | SQS           |
| Other values         | [`AnythingExpectation`](/api/expect/#AnythingExpectation)                     | Generic       |

## HTTP Response Assertions

Use [`HttpResponseExpectation`](/api/expect/#HttpResponseExpectation) for HTTP
client responses:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

// Status assertions
expect(res)
  .toBeOk() // ok === true
  .toHaveStatus(200) // status === 200
  .toHaveStatusText("OK"); // statusText === "OK"

// JSON assertions
expect(res)
  .toHaveJson({ id: 1, name: "Alice" }) // exact match
  .toHaveJsonMatching({ id: 1 }) // partial match
  .toHaveJsonProperty("email"); // property exists

// Header assertions
expect(res)
  .toHaveHeadersProperty("content-type")
  .toHaveHeadersPropertyContaining("content-type", "json");
```

### Common HTTP Assertion Methods

| Method                                  | Description                     |
| --------------------------------------- | ------------------------------- |
| `toBeOk()`                              | Response `ok` is `true`         |
| `toHaveStatus(n)`                       | Status equals `n`               |
| `toHaveStatusText(s)`                   | Status text equals `s`          |
| `toHaveJson(d)`                         | JSON deeply equals `d`          |
| `toHaveJsonMatching(d)`                 | JSON matches partial object `d` |
| `toHaveJsonProperty(k)`                 | JSON has property `k`           |
| `toHaveHeadersProperty(k)`              | Header `k` exists               |
| `toHaveHeadersPropertyContaining(k, v)` | Header `k` contains `v`         |

## SQL Query Assertions

Use [`SqlQueryResultExpectation`](/api/expect/#SqlQueryResultExpectation) for
SQL client results:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using pg = await client.sql.postgres.createPostgresClient({
  url: "postgres://user:pass@localhost/db",
});
const result = await pg.query("SELECT * FROM users WHERE active = $1", [true]);

// Row count assertions
expect(result)
  .toHaveRowCount(5) // exactly 5 rows
  .toHaveRowCountGreaterThan(0); // at least 1 row

// Row content assertions
expect(result)
  .toHaveRowsMatching({ active: true }) // all rows have active=true
  .toHaveRowsContaining({ name: "Alice" }); // at least one row has name=Alice
```

### Common SQL Assertion Methods

| Method                         | Description                       |
| ------------------------------ | --------------------------------- |
| `toHaveRowCount(n)`            | Result has exactly `n` rows       |
| `toHaveRowCountGreaterThan(n)` | Result has more than `n` rows     |
| `toHaveRowsMatching(o)`        | All rows match partial object `o` |
| `toHaveRowsContaining(o)`      | At least one row matches `o`      |
| `toHaveColumns(cols)`          | Result has specified columns      |

## GraphQL Response Assertions

Use [`GraphqlResponseExpectation`](/api/expect/#GraphqlResponseExpectation) for
GraphQL client responses:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using gql = client.graphql.createGraphqlClient({
  url: "http://localhost:4000/graphql",
});
const res = await gql.query(`query { user(id: 1) { name email } }`);

expect(res)
  .toBeOk()
  .toHaveErrorNullish() // no GraphQL errors
  .toHaveData({ user: { name: "Alice", email: "alice@example.com" } })
  .toHaveDataMatching({ user: { name: "Alice" } });
```

### Common GraphQL Assertion Methods

| Method                  | Description                     |
| ----------------------- | ------------------------------- |
| `toBeOk()`              | Response `ok` is `true`         |
| `toHaveErrorNullish()`  | No GraphQL errors in response   |
| `toHaveError(err)`      | Has specific GraphQL error      |
| `toHaveData(d)`         | Data deeply equals `d`          |
| `toHaveDataMatching(d)` | Data matches partial object `d` |

## gRPC / ConnectRPC Assertions

Use [`GrpcResponseExpectation`](/api/expect/#GrpcResponseExpectation) or
[`ConnectRpcResponseExpectation`](/api/expect/#ConnectRpcResponseExpectation):

```typescript
import { client, expect } from "@probitas-test/probitas";

await using grpc = client.grpc.createGrpcClient({ url: "localhost:50051" });
const res = await grpc.call("users.UserService", "GetUser", { id: "123" });

expect(res)
  .toBeOk()
  .toHaveData({ id: "123", name: "Alice" })
  .toHaveDataMatching({ id: "123" });
```

## Redis Assertions

Use [`RedisExpectation`](/api/expect/#RedisExpectation) for Redis client
results:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using redis = await client.redis.createRedisClient({
  url: "redis://localhost:6379",
});

// String operations
await redis.set("user:1:name", "Alice");
const name = await redis.get("user:1:name");
expect(name).toHaveValue("Alice");

// Counter operations
await redis.set("counter", "0");
const count = await redis.incr("counter");
expect(count).toHaveValue(1);

// Set operations
await redis.sadd("tags", ["a", "b", "c"]);
const members = await redis.smembers("tags");
expect(members).toHaveValueContaining("a");
```

### Common Redis Assertion Methods

| Method                     | Description                     |
| -------------------------- | ------------------------------- |
| `toHaveValue(v)`           | Result value equals `v`         |
| `toHaveValueContaining(v)` | Array result contains value `v` |
| `toHaveValueEmpty()`       | Result is empty                 |

## MongoDB Assertions

Use [`MongoExpectation`](/api/expect/#MongoExpectation) for MongoDB client
results:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using mongo = await client.mongodb.createMongoClient({
  url: "mongodb://localhost:27017",
  database: "testdb",
});

// Find operations
const users = await mongo.collection("users").find({ active: true });
expect(users)
  .toHaveDocsCount(5)
  .toHaveDocsContaining({ name: "Alice" });

// Insert operations
const insertResult = await mongo.collection("users").insertOne({
  name: "Bob",
  email: "bob@example.com",
});
expect(insertResult).toBeOk();
```

## Generic Assertions

For values not matching specific client types,
[`AnythingExpectation`](/api/expect/#AnythingExpectation) provides chainable
wrappers around `@std/expect` matchers:

```typescript
import { expect } from "@probitas-test/probitas";

// Numbers
expect(42).toBe(42).toBeGreaterThan(40);

// Strings
expect("hello world").toContain("world").toMatch(/^hello/);

// Objects
expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }).toHaveProperty("b");

// Arrays
expect([1, 2, 3]).toHaveLength(3).toContain(2);
```

### Common Generic Assertion Methods

| Method               | Description                       |
| -------------------- | --------------------------------- |
| `toBe(v)`            | Strictly equals (`===`) `v`       |
| `toEqual(v)`         | Deeply equals `v`                 |
| `toStrictEqual(v)`   | Strictly deeply equals `v`        |
| `toMatch(r)`         | String matches regex `r`          |
| `toContain(v)`       | Array/string contains `v`         |
| `toHaveLength(n)`    | Has length `n`                    |
| `toHaveProperty(k)`  | Object has property `k`           |
| `toMatchObject(o)`   | Object matches partial object `o` |
| `toBeGreaterThan(n)` | Number is greater than `n`        |
| `toBeLessThan(n)`    | Number is less than `n`           |
| `toBeTruthy()`       | Value is truthy                   |
| `toBeFalsy()`        | Value is falsy                    |
| `toBeNull()`         | Value is `null`                   |
| `toBeUndefined()`    | Value is `undefined`              |

## Error Handling

When an assertion fails, an [`ExpectationError`](/api/expect/#ExpectationError)
is thrown. In scenario steps, these errors are caught and reported
automatically:

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("Error Example")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step("Check status", async (ctx) => {
    const { http } = ctx.resources;
    const res = await http.get("/health");

    // If this fails, the scenario reports which assertion failed
    expect(res).toHaveStatus(200);
  })
  .build();
```

### Error Output Example

When an assertion fails, the List reporter displays detailed error information:

```
T┆ ✗ User API Test > Check user response (user.probitas.ts:15) [12.34ms]
 ┆ └ Expected status to be 200, but got 404

Failed Tests
T┆ ✗ User API Test > Check user response (user.probitas.ts:15) [12.34ms]
 ┆
 ┆   Expected status to be 200, but got 404
 ┆
 ┆   Diff (-Actual / +Expected):
 ┆
 ┆       - 404
 ┆       + 200
 ┆
 ┆   Subject
 ┆
 ┆     {
 ┆       ok: false,
 ┆       status: 404,
 ┆       statusText: "Not Found"
 ┆     }
 ┆
 ┆   Stack trace
 ┆
 ┆     at file:///path/to/user.probitas.ts:15:12
```

**Output components:**

| Component      | Description                                       |
| -------------- | ------------------------------------------------- |
| `T┆`           | Step type indicator (T=step, s=setup, r=resource) |
| `✗`            | Failure icon (red)                                |
| `(file.ts:15)` | Source location                                   |
| `[12.34ms]`    | Execution duration                                |
| `Diff`         | Shows difference between actual and expected      |
| `Subject`      | The object being tested                           |
| `Stack trace`  | Call stack for debugging                          |

## Best Practices

### Use Specific Assertions

Prefer specific assertions over generic ones for better error messages:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

// Good: Clear, descriptive error message on failure
// "Expected status to be 200, but got 404"
expect(res).toHaveStatus(200);

// Good: Shows diff of expected vs actual JSON
expect(res).toHaveJsonMatching({ id: 1 });

// Less ideal: Generic message "Expected 200 but received 404"
expect(res.status).toBe(200);
```

### Chain Related Assertions

Keep related checks in a single `expect()` chain so failures stay grouped and
the assertion state stays consistent:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

// Good: Single chain for related checks
expect(res)
  .toBeOk()
  .toHaveStatus(200)
  .toHaveJsonMatching({ id: 1, name: "Alice" });

// Avoid: Separate expect calls on the same subject
expect(res).toBeOk();
expect(res).toHaveStatus(200);
expect(res).toHaveJsonMatching({ id: 1, name: "Alice" });
```

### Use `.not` for Negative Assertions

Use `.not` to explicitly check for absence or negative conditions:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

// Check error responses are NOT returned
expect(res)
  .not.toHaveStatus(404)
  .not.toHaveStatus(500)
  .toBeOk();

// Verify JSON does NOT contain sensitive fields
expect(res).not.toHaveJsonProperty("password");
```

### Avoid Manual Checks

Use fluent assertions instead of `if/throw` logic or `JSON.stringify` checks.
Assertions provide clearer diffs and consistent failure output.

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

// Avoid - manual validation
if (res.status !== 200) {
  throw new Error(`Expected 200, got ${res.status}`);
}

// Good - fluent assertion chain
expect(res)
  .toBeOk()
  .toHaveStatus(200)
  .not.toHaveJsonProperty(["metadata", "x-internal-token"]);
```

### Validate Structure Before Values

Check structure exists before asserting on specific values:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

// Good: Validates structure progressively
expect(res)
  .toBeOk()
  .toHaveJsonProperty("user")
  .toHaveJsonMatching({
    user: { id: 1, email: "alice@example.com" },
  });
```

### Use `toHaveJsonMatching` for Partial Validation

When you only care about specific fields, use partial matching:

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

// Good: Only validates relevant fields
expect(res).toHaveJsonMatching({
  id: 1,
  status: "active",
});

// This ignores other fields like createdAt, updatedAt, etc.
```

### Use Array Paths for Nested Properties

For nested fields, prefer array paths over dot notation and keep positive and
negative checks in the same chain.

```typescript
import { client, expect } from "@probitas-test/probitas";

await using http = client.http.createHttpClient({
  url: "http://localhost:8080",
});
const res = await http.get("/users/1");

expect(res)
  .toBeOk()
  .toHaveJsonProperty("metadata")
  .not.toHaveJsonProperty(["metadata", "x-internal-token"]);
```
