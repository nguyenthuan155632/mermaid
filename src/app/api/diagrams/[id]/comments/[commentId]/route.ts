import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { comments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { z } from "zod";

const updateCommentSchema = z.object({
  content: z.string().min(1, "Comment content is required"),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  isResolved: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commentId } = await params;
    const body = await request.json();

    const validatedData = updateCommentSchema.parse(body);

    // First check if the comment exists and belongs to the user
    const [existingComment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existingComment.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update the comment
    const [updatedComment] = await db
      .update(comments)
      .set({
        content: validatedData.content,
        ...(validatedData.positionX !== undefined && { positionX: validatedData.positionX }),
        ...(validatedData.positionY !== undefined && { positionY: validatedData.positionY }),
        ...(validatedData.isResolved !== undefined && { isResolved: validatedData.isResolved }),
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId))
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
      .where(eq(comments.id, updatedComment.id))
      .limit(1);

    // Ensure dates are properly serialized as ISO strings
    const serializedComment = {
      ...commentWithUser,
      createdAt: commentWithUser.createdAt.toISOString(),
      updatedAt: commentWithUser.updatedAt.toISOString(),
    };

    return NextResponse.json(serializedComment);
  } catch (error) {
    console.error("Update comment error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commentId } = await params;

    // First check if the comment exists and belongs to the user
    const [existingComment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existingComment.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete the comment
    await db.delete(comments).where(eq(comments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
