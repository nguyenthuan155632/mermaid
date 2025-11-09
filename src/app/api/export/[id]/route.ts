import { z } from "zod";
import { db } from "@/db";
import { diagrams } from "@/db/schema";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

const exportSchema = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  resolution: z.coerce.number().min(1).max(4).default(2),
  background: z.enum(["white", "transparent"]).default("white"),
  token: z.string().optional(),
});

// Helper to safely parse URL params
const safeParse = (value: string | null, defaultValue: any) => {
  if (value === null || value === undefined) return defaultValue;
  return value;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const { format, resolution, background, token } = exportSchema.parse({
      format: safeParse(searchParams.get("format"), "png"),
      resolution: safeParse(searchParams.get("resolution"), 2),
      background: safeParse(searchParams.get("background"), "white"),
      token: searchParams.get("token") || undefined,
    });

    const { id } = await params;

    // Find diagram
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

    // Check if diagram is public or has valid export token
    // For public diagrams, allow access without token
    // For private diagrams, require valid token
    if (!diagramData.isPublic && diagramData.exportToken !== token) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    // Generate export token if it doesn't exist
    if (!diagramData.exportToken && !diagramData.isPublic) {
      const newExportToken = uuidv4();
      await db
        .update(diagrams)
        .set({ exportToken: newExportToken })
        .where(eq(diagrams.id, id));

      // Update diagram data with new token
      diagramData.exportToken = newExportToken;
    }

    // Set content type based on format
    const contentType = format === "png" ? "image/png" : "image/svg+xml";

    // Use mermaid CLI for both SVG and PNG export
    if (format === "png") {
      try {
        // Create a temporary directory for files
        const tempDir = join(tmpdir(), `mermaid-export-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });

        // Write mermaid code to a file
        const mmdFile = join(tempDir, 'diagram.mmd');
        await writeFile(mmdFile, diagramData.code);

        // Configure background color
        const bgConfig = background === 'white' ? '--backgroundColor white' : '--backgroundColor transparent';

        // Configure resolution (scale factor)
        const scaleConfig = `--scale ${resolution}`;

        // Output file path
        const pngFile = join(tempDir, 'diagram.png');

        try {
          // Use mermaid CLI to render the diagram to PNG
          await execAsync(
            `npx mmdc --input ${mmdFile} --output ${pngFile} --outputFormat png ${bgConfig} ${scaleConfig}`,
            { cwd: process.cwd() }
          );

          // Read the PNG file
          const fs = require('fs');
          const pngBuffer = fs.readFileSync(pngFile);

          // Clean up temporary files
          await unlink(mmdFile);
          await unlink(pngFile);

          // Return PNG as response
          return new NextResponse(pngBuffer, {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=3600", // Cache for 1 hour
              "Content-Disposition": `inline; filename="${diagramData.title}.png"`,
            },
          });
        } catch (cliError) {
          console.error("Mermaid CLI PNG error:", cliError);

          // Clean up temporary files
          try {
            await unlink(mmdFile);
          } catch (e) {
            // Ignore cleanup errors
          }

          return NextResponse.json(
            {
              error: "PNG export failed. Please try SVG format or export from the editor directly.",
              svgUrl: `${request.url.split('?')[0]}?format=svg&token=${token}`
            },
            { status: 500 }
          );
        }
      } catch (error) {
        console.error("PNG export error:", error);
        return NextResponse.json(
          {
            error: "PNG export failed. Please try SVG format or export from the editor directly.",
            svgUrl: `${request.url.split('?')[0]}?format=svg&token=${token}`
          },
          { status: 500 }
        );
      }
    }

    // For SVG, we can modify the existing export function
    const svgContent = await exportToSVGString(
      diagramData.code,
      background
    );

    return new NextResponse(svgContent, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Content-Disposition": `inline; filename="${diagramData.title}.${format}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to export diagram" },
      { status: 500 }
    );
  }
}

// Helper function to export SVG as string instead of download
async function exportToSVGString(
  code: string,
  backgroundColor: 'white' | 'transparent' = 'transparent'
): Promise<string> {
  try {
    // Create a temporary directory for files
    const tempDir = join(tmpdir(), `mermaid-export-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Write mermaid code to a file
    const mmdFile = join(tempDir, 'diagram.mmd');
    await writeFile(mmdFile, code);

    // Configure background color
    const bgConfig = backgroundColor === 'white' ? '--backgroundColor white' : '--backgroundColor transparent';

    try {
      // Use mermaid CLI to render the diagram to SVG
      const { stdout } = await execAsync(
        `npx mmdc --input ${mmdFile} --output - --outputFormat svg ${bgConfig}`,
        { cwd: process.cwd() }
      );

      // Clean up temporary files
      await unlink(mmdFile);

      return stdout;
    } catch (cliError) {
      console.error("Mermaid CLI error:", cliError);

      // Clean up temporary files
      try {
        await unlink(mmdFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      // Fall back to a simple error SVG
      const bgColor = backgroundColor === 'white' ? '#ffffff' : 'transparent';
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="${bgColor}" />
  <text x="400" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="16">
    Failed to render diagram
  </text>
</svg>`;
    }
  } catch (error) {
    console.error("SVG export error:", error);

    // Return an error SVG
    const bgColor = backgroundColor === 'white' ? '#ffffff' : 'transparent';
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="${bgColor}" />
  <text x="400" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="16">
    Error rendering diagram
  </text>
</svg>`;
  }
}