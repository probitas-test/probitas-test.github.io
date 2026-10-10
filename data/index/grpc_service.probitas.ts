import { client, expect, scenario } from "@probitas-test/probitas";

export default scenario("gRPC Service Test", {
  tags: ["integration", "grpc"],
})
  .resource("grpc", () =>
    client.grpc.createGrpcClient({
      url: "localhost:50051",
    }))
  .step("Echo - simple message", async (ctx) => {
    const { grpc } = ctx.resources;
    const res = await grpc.call("echo.v1.Echo", "Echo", {
      message: "Hello from probitas",
    });

    expect(res)
      .toBeOk()
      .toHaveDataMatching({ message: "Hello from probitas" });
  })
  .step("EchoWithDelay - delayed response", async (ctx) => {
    const { grpc } = ctx.resources;
    const res = await grpc.call("echo.v1.Echo", "EchoWithDelay", {
      message: "delayed",
      delayMs: 100,
    });

    expect(res)
      .toBeOk()
      .toHaveDataMatching({ message: "delayed" })
      .toHaveDurationLessThan(5000);
  })
  .build();
