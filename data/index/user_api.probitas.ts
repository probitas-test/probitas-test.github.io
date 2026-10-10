import { client, expect, faker, scenario } from "@probitas-test/probitas";

export default scenario("User API Integration Test", {
  tags: ["integration", "http", "postgres"],
})
  .resource("user", () => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
  }))
  .resource("db", () =>
    client.sql.postgres.createPostgresClient({
      url: "postgres://testuser:testpassword@localhost:5432/app",
    }))
  .resource("http", () =>
    client.http.createHttpClient({
      url: "http://localhost:8000",
    }))
  .setup(async (ctx) => {
    const { db, user } = ctx.resources;
    await db.query(
      `INSERT INTO users (id, name, email) VALUES ($1, $2, $3)`,
      [user.id, user.name, user.email],
    );
    return async () => {
      await db.query(`DELETE FROM users WHERE id = $1`, [user.id]);
    };
  })
  .step("GET /users/:id - fetch user", async (ctx) => {
    const { http, user } = ctx.resources;
    const res = await http.get(`/users/${user.id}`);

    expect(res)
      .toBeOk()
      .toHaveStatus(200)
      .toHaveJsonMatching({ id: user.id, name: user.name });
  })
  .build();
