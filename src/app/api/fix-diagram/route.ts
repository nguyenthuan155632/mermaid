import { z } from "zod";
import { NextResponse } from "next/server";
import { fixMermaidDiagram } from "@/lib/gemini";

const fixDiagramSchema = z.object({
  code: z.string(),
  error: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = fixDiagramSchema.parse(body);

    const result = await fixMermaidDiagram(
      validatedData.code,
      validatedData.error
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fix diagram" },
      { status: 500 }
    );
  }
}

