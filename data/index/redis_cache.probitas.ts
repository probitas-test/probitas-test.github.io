import { client, expect, faker, scenario } from "@probitas-test/probitas";

export default scenario("Redis Cache Test", {
  tags: ["integration", "redis"],
})
  .resource("redis", () =>
    client.redis.createRedisClient({
      url: "redis://localhost:6379",
    }))
  .resource("key", () => `cache:${faker.string.uuid()}`)
  .setup((ctx) => {
    const { redis, key } = ctx.resources;
    return async () => {
      await redis.del([key]);
    };
  })
  .step("SET and GET value", async (ctx) => {
    const { redis, key } = ctx.resources;
    await redis.set(key, "hello world");
    const res = await redis.get(key);

    expect(res).toBeOk().toHaveValue("hello world");
  })
  .step("INCR counter", async (ctx) => {
    const { redis } = ctx.resources;
    await redis.set("test:counter", "0");
    const res = await redis.incr("test:counter");

    expect(res).toBeOk().toHaveValue(1);

    // Cleanup
    await redis.del(["test:counter"]);
  })
  .build();
