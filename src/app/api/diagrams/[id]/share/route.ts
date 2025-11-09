import { db } from "@/db";
import { diagrams } from "@/db/schema";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const [existingDiagram] = await db
      .select()
      .from(diagrams)
      .where(eq(diagrams.id, id))
      .limit(1);

    if (!existingDiagram) {
      return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
    }

    if (existingDiagram.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const shareToken = uuidv4();

    const [updatedDiagram] = await db
      .update(diagrams)
      .set({
        shareToken,
        isPublic: true,
      })
      .where(eq(diagrams.id, id))
      .returning();

    return NextResponse.json({ shareToken: updatedDiagram.shareToken });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

