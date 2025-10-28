import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { withLock } from "../../../lib/fileLock";
import { getDb } from "../../../lib/mongodb";
import type { Collection } from "mongodb";

type CounterDoc = { _id: string; video: number; photo: number };

// Allow configuring a writable path via env (useful when deploying with a mounted volume)
const filePath =
  process.env.DATA_PATH ?? path.join(process.cwd(), "data", "counter.json");

// In-memory fallback when the filesystem is not writable (ephemeral, per-process)
let inMemoryCache: Record<string, number> | null = null;

function readData(): Record<string, number> {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
        string,
        number
      >;
    }
  } catch (err) {
    console.warn("readData: failed to read file, falling back to memory", err);
  }

  // fallback to cache or initialize
  if (!inMemoryCache) inMemoryCache = { video: 0, photo: 0 };
  return inMemoryCache;
}

function writeData(data: Record<string, number>): { persisted: boolean } {
  try {
    // ensure directory exists when writing to a file path under project
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    inMemoryCache = data;
    return { persisted: true };
  } catch (err) {
    // write failed (likely read-only filesystem in serverless). Keep in-memory copy.
    console.warn(
      "writeData: failed to write file, updates will be kept in memory only",
      err
    );
    inMemoryCache = data;
    return { persisted: false };
  }
}

export async function GET() {
  // If Mongo is configured, read from DB (works on Vercel when you set MONGODB_URI)
  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      const col: Collection<CounterDoc> = db.collection("counters");
      const doc = await col.findOne({ _id: "counters" });
      if (doc) {
        const { video = 0, photo = 0 } = doc;
        return NextResponse.json({ video, photo });
      }
      // initialize
      await col.insertOne({ _id: "counters", video: 0, photo: 0 });
      return NextResponse.json({ video: 0, photo: 0 });
    } catch (err) {
      console.warn("GET: Mongo read failed, falling back to file", err);
    }
  }

  const data = readData();
  return NextResponse.json(data);
}

/**
 * POST body: { key: 'video' | 'photo', delta: number }
 * This handler uses an in-process lock to serialize file writes so updates are synchronized
 * within the same server process. For multi-instance deployments use a shared store (DB).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const key = String(body?.key ?? "");
    const delta = Number(body?.delta ?? 0);

    if (!["video", "photo"].includes(key)) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    // If Mongo is configured, prefer DB (atomic increments)
    if (process.env.MONGODB_URI) {
      try {
        const db = await getDb();
        const col: Collection<CounterDoc> = db.collection("counters");
        await col.updateOne(
          { _id: "counters" },
          { $inc: { [key]: delta } },
          { upsert: true }
        );
        const doc = await col.findOne({ _id: "counters" });
        const video = Number(doc?.video ?? 0);
        const photo = Number(doc?.photo ?? 0);
        return NextResponse.json({ video, photo, _persisted: true });
      } catch (err) {
        console.warn("POST: Mongo update failed, falling back to file", err);
        // continue to file-based below
      }
    }

    const result = await withLock(filePath, async () => {
      const data = readData();
      data[key] = (data[key] ?? 0) + delta;
      const { persisted } = writeData(data);
      return { ...data, _persisted: persisted };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("API error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
