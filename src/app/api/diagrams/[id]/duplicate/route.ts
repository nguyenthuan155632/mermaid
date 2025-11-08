import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { diagrams } from "@/db/schema";

const MAX_SUFFIX_ATTEMPTS = 20;

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

    const baseTitle = existingDiagram.title.trim() || "Untitled diagram";
    let newTitle = `Copy of ${baseTitle}`;

    if (existingDiagram.title.startsWith("Copy of ")) {
      newTitle = `${baseTitle} (copy)`;
    }

    // Attempt to find a unique title to avoid confusion in the gallery
    if (newTitle === baseTitle) {
      newTitle = `${baseTitle} (copy)`;
    }

    let attempts = 1;
    while (attempts <= MAX_SUFFIX_ATTEMPTS) {
      const duplicateExists = await db
        .select({ id: diagrams.id })
        .from(diagrams)
        .where(
          and(
            eq(diagrams.userId, session.user.id),
            eq(diagrams.title, newTitle)
          )
        )
        .limit(1);

      if (duplicateExists.length === 0) break;
      attempts += 1;
      newTitle = `${baseTitle} (copy ${attempts})`;
    }

    const [newDiagram] = await db
      .insert(diagrams)
      .values({
        userId: session.user.id,
        title: newTitle,
        code: existingDiagram.code,
        description: existingDiagram.description,
        isPublic: false,
        shareToken: null,
      })
      .returning();

    return NextResponse.json(newDiagram, { status: 201 });
  } catch (error) {
    console.error("Failed to duplicate diagram", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
