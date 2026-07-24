import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = await getDB();
  const patients = await db.listPatients();
  return NextResponse.json({ patients });
}
