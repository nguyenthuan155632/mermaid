import { z } from "zod";
import { db } from "@/db";
import { diagrams } from "@/db/schema";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

const createDiagramSchema = z.object({
  title: z.string().min(1, "Title is required"),
  code: z.string(),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    console.log("POST /api/diagrams - Starting");
    const session = await auth();
    console.log("Session:", session);
    
    if (!session?.user?.id) {
      console.log("Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log("Body:", body);
    
    const validatedData = createDiagramSchema.parse(body);
    console.log("Validated data:", validatedData);

    const [newDiagram] = await db
      .insert(diagrams)
      .values({
        userId: session.user.id,
        title: validatedData.title,
        code: validatedData.code,
        description: validatedData.description || null,
      })
      .returning();

    console.log("Created diagram:", newDiagram);
    return NextResponse.json(newDiagram, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/diagrams:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userDiagrams = await db
      .select()
      .from(diagrams)
      .where(eq(diagrams.userId, session.user.id))
      .orderBy(diagrams.updatedAt);

    return NextResponse.json(userDiagrams);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

