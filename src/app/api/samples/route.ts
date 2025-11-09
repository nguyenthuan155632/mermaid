import { db } from "@/db";
import { sampleDiagrams } from "@/db/schema";
import { sampleDiagramsData } from "@/data/samples";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const existingSamples = await db.select().from(sampleDiagrams);
    const existingMap = new Map(existingSamples.map((sample) => [sample.title, sample]));
    const samplesToInsert = [];

    for (const sample of sampleDiagramsData) {
      const existing = existingMap.get(sample.title);

      if (!existing) {
        samplesToInsert.push(sample);
        continue;
      }

      const needsUpdate =
        existing.code !== sample.code ||
        existing.description !== sample.description ||
        existing.category !== sample.category ||
        existing.order !== sample.order;

      if (needsUpdate) {
        await db
          .update(sampleDiagrams)
          .set({
            code: sample.code,
            description: sample.description,
            category: sample.category,
            order: sample.order,
          })
          .where(eq(sampleDiagrams.id, existing.id));
      }
    }

    if (samplesToInsert.length > 0) {
      await db.insert(sampleDiagrams).values(samplesToInsert);
    }

    const samples = await db
      .select()
      .from(sampleDiagrams)
      .orderBy(sampleDiagrams.order);

    return NextResponse.json(samples);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch samples" },
      { status: 500 }
    );
  }
}
