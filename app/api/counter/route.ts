import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { withLock } from "../../../lib/fileLock";

const filePath = path.join(process.cwd(), "data", "counter.json");

function readData() {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
    string,
    number
  >;
}

function writeData(data: Record<string, number>) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export async function GET() {
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

    const result = await withLock(filePath, async () => {
      const data = readData();
      data[key] = (data[key] ?? 0) + delta;
      writeData(data);
      return data;
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
