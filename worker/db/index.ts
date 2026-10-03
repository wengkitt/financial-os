import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema.ts";

function createDatabase(client: Client) {
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabase>;
export type DatabaseExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

// Connections belong to one Worker request. Hyperdrive pools the origin connections.
export async function withDatabase<T>(
  env: { HYPERDRIVE: Pick<Env["HYPERDRIVE"], "connectionString"> },
  operation: (db: Database) => Promise<T>,
): Promise<T> {
  const client = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
  });

  try {
    await client.connect();
    return await operation(createDatabase(client));
  } finally {
    await client.end();
  }
}
