import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { diagramSnapshots, diagrams } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const [diagram] = await db
      .select({ id: diagrams.id, userId: diagrams.userId })
      .from(diagrams)
      .where(eq(diagrams.id, id))
      .limit(1);

    if (!diagram) {
      return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
    }

    if (diagram.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const items = await db
      .select()
      .from(diagramSnapshots)
      .where(eq(diagramSnapshots.diagramId, id))
      .orderBy(desc(diagramSnapshots.createdAt))
      .limit(50);

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
