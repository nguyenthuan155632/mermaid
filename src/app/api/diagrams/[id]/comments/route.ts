import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { comments, users, diagrams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const createCommentSchema = z.object({
  content: z.string().min(1, "Comment content is required"),
  positionX: z.number(),
  positionY: z.number(),
  parentId: z.string().optional(),
  isAnonymous: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: diagramId } = await params;

    const commentsData = await db
      .select({
        id: comments.id,
        content: comments.content,
        positionX: comments.positionX,
        positionY: comments.positionY,
        isResolved: comments.isResolved,
        parentId: comments.parentId,
        isAnonymous: comments.isAnonymous,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        user: {
          id: users.id,
          email: users.email,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.diagramId, diagramId))
      .orderBy(comments.createdAt);

    // Ensure dates are properly serialized as ISO strings
    const serializedComments = commentsData.map(comment => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      // For anonymous comments, provide a default user object
      user: comment.isAnonymous ? { id: 'anonymous', email: 'Anonymous' } : comment.user,
    }));

    return NextResponse.json({ items: serializedComments });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: diagramId } = await params;
    const body = await request.json();
    const validatedData = createCommentSchema.parse(body);

    // Check if diagram allows anonymous comments
    const [diagram] = await db
      .select({ anonymousMode: diagrams.anonymousMode })
      .from(diagrams)
      .where(eq(diagrams.id, diagramId))
      .limit(1);

    if (!diagram) {
      return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
    }

    const session = await auth();
    const isAnonymousRequest = validatedData.isAnonymous || !session?.user?.id;

    // Allow anonymous comments only if diagram is in anonymous mode
    if (isAnonymousRequest && !diagram.anonymousMode) {
      return NextResponse.json({ error: "Anonymous comments not allowed" }, { status: 401 });
    }

    // For authenticated users, require session unless diagram is in anonymous mode
    if (!isAnonymousRequest && !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [newComment] = await db
      .insert(comments)
      .values({
        diagramId,
        userId: isAnonymousRequest ? null : (session?.user?.id || null),
        isAnonymous: isAnonymousRequest,
        content: validatedData.content,
        positionX: validatedData.positionX,
        positionY: validatedData.positionY,
        parentId: validatedData.parentId,
      })
      .returning();

    // Fetch the complete comment with user info
    const [commentWithUser] = await db
      .select({
        id: comments.id,
        content: comments.content,
        positionX: comments.positionX,
        positionY: comments.positionY,
        isResolved: comments.isResolved,
        parentId: comments.parentId,
        isAnonymous: comments.isAnonymous,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        user: {
          id: users.id,
          email: users.email,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.id, newComment.id))
      .limit(1);

    // Ensure dates are properly serialized as ISO strings
    const serializedComment = {
      ...commentWithUser,
      createdAt: commentWithUser.createdAt.toISOString(),
      updatedAt: commentWithUser.updatedAt.toISOString(),
      // For anonymous comments, provide a default user object
      user: commentWithUser.isAnonymous ? { id: 'anonymous', email: 'Anonymous' } : commentWithUser.user,
    };

    return NextResponse.json(serializedComment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
