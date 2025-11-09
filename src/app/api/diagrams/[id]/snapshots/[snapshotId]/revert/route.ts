import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { diagramSnapshots, diagrams } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, snapshotId } = await params;
    const [diagram] = await db
      .select()
      .from(diagrams)
      .where(eq(diagrams.id, id))
      .limit(1);

    if (!diagram) {
      return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
    }

    if (diagram.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [snapshot] = await db
      .select()
      .from(diagramSnapshots)
      .where(
        and(
          eq(diagramSnapshots.id, snapshotId),
          eq(diagramSnapshots.diagramId, id)
        )
      )
      .limit(1);

    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    const [updatedDiagram] = await db
      .update(diagrams)
      .set({
        title: snapshot.title,
        code: snapshot.code,
        description: snapshot.description,
        updatedAt: new Date(),
      })
      .where(eq(diagrams.id, id))
      .returning();

    await db.insert(diagramSnapshots).values({
      diagramId: id,
      title: updatedDiagram.title,
      code: updatedDiagram.code,
      description: updatedDiagram.description,
    });

    return NextResponse.json(updatedDiagram);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
