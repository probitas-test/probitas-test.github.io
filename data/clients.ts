/**
 * Supported client list for the clients section
 */

export interface Client {
  name: string;
  url: string;
  factory: string;
  protocol: string;
}

export const clients: Client[] = [
  {
    name: "HTTP",
    url: "https://developer.mozilla.org/en-US/docs/Web/HTTP",
    factory: "client.http.createHttpClient()",
    protocol: "HTTP/HTTPS",
  },
  {
    name: "PostgreSQL",
    url: "https://www.postgresql.org/",
    factory: "client.sql.postgres.createPostgresClient()",
    protocol: "PostgreSQL",
  },
  {
    name: "MySQL",
    url: "https://www.mysql.com/",
    factory: "client.sql.mysql.createMySqlClient()",
    protocol: "MySQL",
  },
  {
    name: "SQLite",
    url: "https://www.sqlite.org/",
    factory: "client.sql.sqlite.createSqliteClient()",
    protocol: "SQLite",
  },
  {
    name: "DuckDB",
    url: "https://duckdb.org/",
    factory: "client.sql.duckdb.createDuckDbClient()",
    protocol: "DuckDB",
  },
  {
    name: "gRPC",
    url: "https://grpc.io/",
    factory: "client.grpc.createGrpcClient()",
    protocol: "gRPC",
  },
  {
    name: "ConnectRPC",
    url: "https://connectrpc.com/",
    factory: "client.connectrpc.createConnectRpcClient()",
    protocol: "Connect/gRPC/gRPC-Web",
  },
  {
    name: "GraphQL",
    url: "https://graphql.org/",
    factory: "client.graphql.createGraphqlClient()",
    protocol: "GraphQL",
  },
  {
    name: "Redis",
    url: "https://redis.io/",
    factory: "client.redis.createRedisClient()",
    protocol: "Redis",
  },
  {
    name: "MongoDB",
    url: "https://www.mongodb.com/",
    factory: "client.mongodb.createMongoClient()",
    protocol: "MongoDB",
  },
  {
    name: "RabbitMQ",
    url: "https://www.rabbitmq.com/",
    factory: "client.rabbitmq.createRabbitMqClient()",
    protocol: "AMQP",
  },
  {
    name: "SQS",
    url: "https://aws.amazon.com/sqs/",
    factory: "client.sqs.createSqsClient()",
    protocol: "AWS SQS",
  },
];
