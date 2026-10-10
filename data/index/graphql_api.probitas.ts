import { client, expect, outdent, scenario } from "@probitas-test/probitas";

export default scenario("GraphQL API Test", {
  tags: ["integration", "graphql"],
})
  .resource("gql", () =>
    client.graphql.createGraphqlClient({
      url: "http://localhost:4000/graphql",
    }))
  .step("echo - simple query", async (ctx) => {
    const { gql } = ctx.resources;
    const res = await gql.query(outdent`
      query {
        echo(message: "Hello GraphQL")
      }
    `);

    expect(res)
      .toBeOk()
      .toHaveDataMatching({ echo: "Hello GraphQL" });
  })
  .step("echo - with variables", async (ctx) => {
    const { gql } = ctx.resources;
    const res = await gql.query(
      outdent`
        query Echo($msg: String!) {
          echo(message: $msg)
        }
      `,
      { msg: "variable message" },
    );

    expect(res)
      .toBeOk()
      .toHaveDataMatching({ echo: "variable message" });
  })
  .step("createMessage - mutation", async (ctx) => {
    const { gql } = ctx.resources;
    const res = await gql.mutation(outdent`
      mutation {
        createMessage(text: "Hello from probitas") {
          id
          text
        }
      }
    `);

    expect(res).toBeOk();
  })
  .build();
