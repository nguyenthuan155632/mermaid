import { NextResponse } from "next/server";
import { db } from "@/db";
import { diagrams } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the diagram and verify ownership
    const diagram = await db
      .select()
      .from(diagrams)
      .where(eq(diagrams.id, id))
      .limit(1);

    if (!diagram.length) {
      return NextResponse.json(
        { error: "Diagram not found" },
        { status: 404 }
      );
    }

    const diagramData = diagram[0];

    // Check if user owns the diagram
    if (diagramData.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate or retrieve existing export token
    let exportToken = diagramData.exportToken;
    if (!exportToken) {
      exportToken = uuidv4();
      await db
        .update(diagrams)
        .set({ exportToken })
        .where(eq(diagrams.id, id));
    }

    return NextResponse.json({ exportToken });
  } catch (error) {
    console.error("Error generating export token:", error);
    return NextResponse.json(
      { error: "Failed to generate export token" },
      { status: 500 }
    );
  }
}