import { z } from "zod";
import { db } from "@/db";
import { diagrams } from "@/db/schema";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";
import { decodeExportLink, encodeExportLink } from "@/lib/exportLinkEncoding";

const execAsync = promisify(exec);
const puppeteerConfigFile = join(
  process.cwd(),
  "scripts",
  "puppeteer.config.json"
);
const puppeteerConfigFlag = `--puppeteerConfigFile "${puppeteerConfigFile}"`;
const toArrayBuffer = (data: Buffer | Uint8Array): ArrayBuffer => {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
};

const exportSchema = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  resolution: z.coerce.number().min(1).max(4).default(2),
  background: z.enum(["white", "transparent"]).default("white"),
  token: z.string().optional(),
});

// Helper to safely parse URL params
const safeParse = <T extends string | number>(
  value: string | null,
  defaultValue: T
): string | T => {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return value;
};

type RouteParams =
  | { slug?: string[] }
  | { id?: string }; // backward compatibility with Next's typing inference

type PathMode = "query" | "compact" | "encoded";

const buildSvgFallbackUrl = ({
  requestUrl,
  diagramId,
  background,
  resolution,
  token,
  mode,
}: {
  requestUrl: URL;
  diagramId: string;
  background: "white" | "transparent";
  resolution: number;
  token?: string | null;
  mode: PathMode;
}): string => {
  const origin = `${requestUrl.protocol}//${requestUrl.host}`;
  if (mode === "compact") {
    const segments = [
      "api",
      "export",
      diagramId,
      "svg",
      resolution.toString(),
      background,
    ];
    if (token) {
      segments.push(token);
    }
    return `${origin}/${segments.join("/")}`;
  }
  if (mode === "encoded") {
    const encoded = encodeExportLink({
      diagramId,
      format: "svg",
      resolution,
      background,
      token,
    });
    return `${origin}/ex/_/${encoded}`;
  }
  const search = new URLSearchParams({
    format: "svg",
    resolution: resolution.toString(),
    background,
  });
  if (token) {
    search.set("token", token);
  }
  return `${origin}/api/export/${diagramId}?${search.toString()}`;
};

export async function GET(request: Request, { params }: { params: Promise<RouteParams> }) {
  try {
    const requestUrl = new URL(request.url);
    const searchParams = requestUrl.searchParams;
    const resolvedParams = await params;
    const slug = "slug" in resolvedParams && Array.isArray(resolvedParams.slug)
      ? resolvedParams.slug
      : "id" in resolvedParams && resolvedParams.id
        ? [resolvedParams.id]
        : [];

    if (!slug.length) {
      return NextResponse.json(
        { error: "Diagram id is required" },
        { status: 400 }
      );
    }

    let diagramId: string;
    let pathMode: PathMode = "query";
    let encodedConfig: {
      format: string;
      resolution: number;
      background: "white" | "transparent";
      token?: string | null;
    } | null = null;

    if (slug[0] === "_") {
      if (slug.length < 2) {
        return NextResponse.json(
          { error: "Missing encoded export value" },
          { status: 400 }
        );
      }
      if (slug.length > 2) {
        return NextResponse.json(
          { error: "Encoded export path is invalid" },
          { status: 400 }
        );
      }
      try {
        const decoded = decodeExportLink(slug[1]);
        diagramId = decoded.diagramId;
        encodedConfig = {
          format: decoded.format,
          resolution: decoded.resolution,
          background: decoded.background,
          token: decoded.token,
        };
        pathMode = "encoded";
      } catch (decodeError) {
        console.error("Encoded export decode error:", decodeError);
        return NextResponse.json(
          { error: "Invalid encoded export link" },
          { status: 400 }
        );
      }
    } else {
      const [slugDiagramId, ...rest] = slug;
      diagramId = slugDiagramId;

      if (!diagramId) {
        return NextResponse.json(
          { error: "Diagram id is required" },
          { status: 400 }
        );
      }

      if (rest.length > 0 && rest.length < 3) {
        return NextResponse.json(
          { error: "Invalid export path" },
          { status: 400 }
        );
      }
      if (rest.length > 4) {
        return NextResponse.json(
          { error: "Export path has too many segments" },
          { status: 400 }
        );
      }

      if (rest.length >= 3) {
        pathMode = "compact";
        encodedConfig = {
          format: rest[0],
          resolution: Number(rest[1]),
          background: rest[2] as "white" | "transparent",
          token: rest[3],
        };
      }
    }

    const { format, resolution, background, token } = exportSchema.parse({
      format: encodedConfig?.format ?? safeParse(searchParams.get("format"), "png"),
      resolution: encodedConfig?.resolution ?? safeParse(searchParams.get("resolution"), 2),
      background: encodedConfig?.background ?? safeParse(searchParams.get("background"), "white"),
      token: encodedConfig?.token ?? searchParams.get("token") ?? undefined,
    });

    // Find diagram
    const diagram = await db
      .select()
      .from(diagrams)
      .where(eq(diagrams.id, diagramId))
      .limit(1);

    if (!diagram.length) {
      return NextResponse.json(
        { error: "Diagram not found" },
        { status: 404 }
      );
    }

    const diagramData = diagram[0];
    const currentCodeHash = createHash("sha256")
      .update(diagramData.code)
      .digest("hex");
    const isCacheStale = diagramData.exportCodeHash !== currentCodeHash;

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
        .where(eq(diagrams.id, diagramId));

      // Update diagram data with new token
      diagramData.exportToken = newExportToken;
    }

    // Set content type based on format
    const contentType = format === "png" ? "image/png" : "image/svg+xml";

    // Use mermaid CLI for both SVG and PNG export
    if (format === "png") {
      const hasCachedPng =
        !isCacheStale &&
        diagramData.pngBlob &&
        diagramData.pngBackground === background &&
        diagramData.pngScale === resolution;

      if (hasCachedPng && diagramData.pngBlob) {
        return new NextResponse(toArrayBuffer(diagramData.pngBlob), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600",
            "Content-Disposition": `inline; filename="${diagramData.title}.png"`,
          },
        });
      }

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
            `npx mmdc --input "${mmdFile}" --output "${pngFile}" --outputFormat png ${bgConfig} ${scaleConfig} ${puppeteerConfigFlag}`,
            { cwd: process.cwd() }
          );

          // Read the PNG file
          const pngBuffer = await readFile(pngFile);

          // Clean up temporary files
          await unlink(mmdFile);
          await unlink(pngFile);

          await db
            .update(diagrams)
            .set({
              pngBlob: pngBuffer,
              pngBackground: background,
              pngScale: resolution,
              pngGeneratedAt: new Date(),
              exportCodeHash: currentCodeHash,
              ...(isCacheStale
                ? { svgBlob: null, svgBackground: null, svgGeneratedAt: null }
                : {}),
            })
            .where(eq(diagrams.id, diagramId));

          // Return PNG as response
          return new NextResponse(toArrayBuffer(pngBuffer), {
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
          } catch {
            // Ignore cleanup errors
          }

          return NextResponse.json(
            {
              error: "PNG export failed. Please try SVG format or export from the editor directly.",
              svgUrl: buildSvgFallbackUrl({
                requestUrl,
                diagramId,
                background,
                resolution,
                token,
                mode: pathMode,
              }),
            },
            { status: 500 }
          );
        }
      } catch (error) {
        console.error("PNG export error:", error);
        return NextResponse.json(
          {
            error: "PNG export failed. Please try SVG format or export from the editor directly.",
            svgUrl: buildSvgFallbackUrl({
              requestUrl,
              diagramId,
              background,
              resolution,
              token,
              mode: pathMode,
            }),
          },
          { status: 500 }
        );
      }
    }

    if (
      !isCacheStale &&
      diagramData.svgBlob &&
      diagramData.svgBackground === background
    ) {
      const cachedSvg = Buffer.from(diagramData.svgBlob).toString("utf-8");
      return new NextResponse(cachedSvg, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
          "Content-Disposition": `inline; filename="${diagramData.title}.${format}"`,
        },
      });
    }

    // For SVG, we can modify the existing export function
    const svgContent = await exportToSVGString(diagramData.code, background);

    await db
      .update(diagrams)
      .set({
        svgBlob: Buffer.from(svgContent, "utf-8"),
        svgBackground: background,
        svgGeneratedAt: new Date(),
        exportCodeHash: currentCodeHash,
        ...(isCacheStale
          ? { pngBlob: null, pngBackground: null, pngScale: null, pngGeneratedAt: null }
          : {}),
      })
      .where(eq(diagrams.id, diagramId));

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
        `npx mmdc --input "${mmdFile}" --output - --outputFormat svg ${bgConfig} ${puppeteerConfigFlag}`,
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
      } catch {
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
