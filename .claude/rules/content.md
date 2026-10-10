---
paths: "docs/**/*.md"
---

# Documentation Content Guidelines

## Writing Style

- **Concise** - Get to the point quickly
- **Practical** - Focus on real-world usage
- **Progressive** - Simple concepts before complex ones

## Code Examples

Every concept needs a runnable example:

```typescript
import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("Example")
  .resource(
    "http",
    () => client.http.createHttpClient({ url: "http://localhost:8080" }),
  )
  .step("make request", async (ctx) => {
    const res = await ctx.resources.http.get("/api/users");
    expect(res).toBeOk().toHaveStatus(200);
  })
  .build();
```

Scenarios run on Bun inside the `probitas` binary: use `process.env` and `node:`
modules, never `Deno.*` APIs or `npm:`/`jsr:` specifiers.

## Package Documentation

| Repository           | Packages                                               |
| -------------------- | ------------------------------------------------------ |
| `probitas/`          | User-facing package and CLI: `@probitas-test/probitas` |
| `probitas-packages/` | Framework and clients: builder, runner, client-*...    |
