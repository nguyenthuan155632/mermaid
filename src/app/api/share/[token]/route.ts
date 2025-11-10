import { db } from "@/db";
import { diagrams } from "@/db/schema";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const [diagram] = await db
      .select({
        id: diagrams.id,
        title: diagrams.title,
        code: diagrams.code,
      })
      .from(diagrams)
      .where(eq(diagrams.shareToken, token))
      .limit(1);

    if (!diagram) {
      return NextResponse.json(
        { error: "Diagram not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(diagram);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

