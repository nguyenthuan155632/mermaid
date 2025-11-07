import { db } from "@/db";
import { sampleDiagrams } from "@/db/schema";
import { sampleDiagramsData } from "@/data/samples";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Check if samples exist, if not seed them
    const existingSamples = await db.select().from(sampleDiagrams).limit(1);
    
    if (existingSamples.length === 0) {
      await db.insert(sampleDiagrams).values(sampleDiagramsData);
    }

    const samples = await db
      .select()
      .from(sampleDiagrams)
      .orderBy(sampleDiagrams.order);

    return NextResponse.json(samples);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch samples" },
      { status: 500 }
    );
  }
}
