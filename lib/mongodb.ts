import { MongoClient, Db } from "mongodb";

let cached: { client: MongoClient; db: Db } | null = null;

export async function getDb(): Promise<Db> {
  if (cached) return cached.db;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  const client = new MongoClient(uri);
  await client.connect();
  const dbName = process.env.MONGODB_DB ?? undefined;
  const db = dbName ? client.db(dbName) : client.db();
  cached = { client, db };
  return db;
}

export default getDb;
