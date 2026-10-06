import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Generation and validation work without a configured database.
  // Commands that connect to PostgreSQL still require DATABASE_URL.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
