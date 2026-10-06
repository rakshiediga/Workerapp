import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

let client: PrismaClient | undefined;

// Lazily create one shared client/pool. The HTTP API can start without a DB URL.
export function getPrismaClient(): PrismaClient | null {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return null;

  if (!client) {
    const adapter = new PrismaPg({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 3000,
      query_timeout: 3000,
    });
    client = new PrismaClient({ adapter });
  }
  return client;
}
