import { z } from "zod";
import { db } from "@/db";
import { diagrams } from "@/db/schema";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
} from "drizzle-orm";

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

type SortKey = "title" | "createdAt" | "updatedAt";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const sortByParam = (url.searchParams.get("sortBy") ||
      "updatedAt") as SortKey;
    const sortDirParam = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(parseInt(url.searchParams.get("pageSize") || "12", 10) || 12, 1),
      50
    );
    const visibility = url.searchParams.get("visibility") ?? "all";
    const dateFrom = url.searchParams.get("from");
    const dateTo = url.searchParams.get("to");

    const filters = [eq(diagrams.userId, session.user.id)];

    if (search) {
      filters.push(ilike(diagrams.title, `%${search}%`));
    }

    if (dateFrom) {
      const parsed = new Date(dateFrom);
      if (!Number.isNaN(parsed.getTime())) {
        filters.push(gte(diagrams.createdAt, parsed));
      }
    }

    if (dateTo) {
      const parsed = new Date(dateTo);
      if (!Number.isNaN(parsed.getTime())) {
        filters.push(lte(diagrams.createdAt, parsed));
      }
    }

    if (visibility === "public") {
      filters.push(eq(diagrams.isPublic, true));
    } else if (visibility === "private") {
      filters.push(eq(diagrams.isPublic, false));
    }

    const whereClause = filters.length > 1 ? and(...filters) : filters[0];

    const sortColumn =
      sortByParam === "title"
        ? diagrams.title
        : sortByParam === "createdAt"
          ? diagrams.createdAt
          : diagrams.updatedAt;
    const orderByClause =
      sortDirParam === "asc" ? asc(sortColumn) : desc(sortColumn);

    const offset = (page - 1) * pageSize;

    const [items, totalResult] = await Promise.all([
      db
        .select()
        .from(diagrams)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: count() })
        .from(diagrams)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    return NextResponse.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
