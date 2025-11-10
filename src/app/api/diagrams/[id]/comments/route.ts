import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { comments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { z } from "zod";

const createCommentSchema = z.object({
  content: z.string().min(1, "Comment content is required"),
  positionX: z.number(),
  positionY: z.number(),
  parentId: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: diagramId } = await params;

    const commentsData = await db
      .select({
        id: comments.id,
        content: comments.content,
        positionX: comments.positionX,
        positionY: comments.positionY,
        isResolved: comments.isResolved,
        parentId: comments.parentId,
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: diagramId } = await params;
    const body = await request.json();
    const validatedData = createCommentSchema.parse(body);

    const [newComment] = await db
      .insert(comments)
      .values({
        diagramId,
        userId: session.user.id,
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
