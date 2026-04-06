import { Pool } from "pg";

declare global {
  var __nandemoPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });
}

export const db = global.__nandemoPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global.__nandemoPool = db;
}
