import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";

export async function GET() {
  const db = await connectToDB();
  const counter = await db.collection("counter").findOne({ _id: "main" });
  return NextResponse.json({ count: counter?.count || 0 });
}

export async function POST() {
  const db = await connectToDB();
  const result = await db.collection("counter").findOneAndUpdate(
    { _id: "main" },
    { $inc: { count: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return NextResponse.json({ count: result.value.count });
}
