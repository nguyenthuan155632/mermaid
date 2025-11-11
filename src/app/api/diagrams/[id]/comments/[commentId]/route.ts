import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { comments, users, diagrams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { z } from "zod";
import {
  getAnonymousDisplayName,
  getAnonymousAvatarColor,
  getAnonymousAvatarInitials,
  generateDeterministicSessionId,
} from "@/lib/anonymousSession";

const updateCommentSchema = z.object({
  content: z.string().min(1, "Comment content is required").optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  isResolved: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: diagramId, commentId } = await params;
    const body = await request.json();
    const validatedData = updateCommentSchema.parse(body);

    // Check if this is a position-only update (allowed for all users for collaboration)
    const isPositionOnlyUpdate =
      validatedData.positionX !== undefined &&
      validatedData.positionY !== undefined &&
      validatedData.content === undefined &&
      validatedData.isResolved === undefined;

    // First check if the comment exists
    const [existingComment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // For position-only updates, check if diagram allows anonymous mode
    if (isPositionOnlyUpdate) {
      const [diagram] = await db
        .select({ anonymousMode: diagrams.anonymousMode })
        .from(diagrams)
        .where(eq(diagrams.id, diagramId))
        .limit(1);

      // If diagram is in anonymous mode, allow position updates without authentication
      if (diagram?.anonymousMode) {
        // Allow position update without authentication
      } else {
        // For non-anonymous diagrams, still require authentication for position updates
        const session = await auth();
        if (!session?.user?.id) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }
    } else {
      // For content or resolved status updates, always require authentication
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Only check ownership if updating content or resolved status
      if (existingComment.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Update the comment
    const [updatedComment] = await db
      .update(comments)
      .set({
        ...(validatedData.content !== undefined && { content: validatedData.content }),
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
        isAnonymous: comments.isAnonymous,
        anonymousSessionId: comments.anonymousSessionId,
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
    const baseComment = {
      ...commentWithUser,
      createdAt: commentWithUser.createdAt.toISOString(),
      updatedAt: commentWithUser.updatedAt.toISOString(),
    };

    // For anonymous comments with session ID, compute display name and avatar
    if (commentWithUser.isAnonymous && commentWithUser.anonymousSessionId) {
      const serializedComment = {
        ...baseComment,
        anonymousSessionId: commentWithUser.anonymousSessionId,
        anonymousDisplayName: getAnonymousDisplayName(commentWithUser.anonymousSessionId),
        anonymousAvatarColor: getAnonymousAvatarColor(commentWithUser.anonymousSessionId),
        anonymousAvatarInitials: getAnonymousAvatarInitials(commentWithUser.anonymousSessionId),
        user: { id: 'anonymous', email: 'Anonymous' },
      };
      return NextResponse.json(serializedComment);
    }

    // For anonymous comments without session ID (legacy), generate deterministic session ID
    if (commentWithUser.isAnonymous) {
      const deterministicSessionId = generateDeterministicSessionId(commentWithUser.id);
      const serializedComment = {
        ...baseComment,
        anonymousSessionId: deterministicSessionId,
        anonymousDisplayName: getAnonymousDisplayName(deterministicSessionId),
        anonymousAvatarColor: getAnonymousAvatarColor(deterministicSessionId),
        anonymousAvatarInitials: getAnonymousAvatarInitials(deterministicSessionId),
        user: { id: 'anonymous', email: 'Anonymous' },
      };
      return NextResponse.json(serializedComment);
    }

    // For authenticated users
    const serializedComment = {
      ...baseComment,
      user: commentWithUser.user,
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

// Helper function to recursively find all child comment IDs
async function getAllChildCommentIds(parentId: string): Promise<string[]> {
  const childComments = await db
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.parentId, parentId));

  const childIds: string[] = [];

  for (const child of childComments) {
    childIds.push(child.id);
    // Recursively get children of children
    const grandChildIds = await getAllChildCommentIds(child.id);
    childIds.push(...grandChildIds);
  }

  return childIds;
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

    // Get all child comment IDs recursively
    const childCommentIds = await getAllChildCommentIds(commentId);

    // Delete all child comments first (in reverse order to handle nested replies)
    const allCommentIdsToDelete = [...childCommentIds, commentId];

    // Delete comments in batches or individually
    for (const id of allCommentIdsToDelete) {
      await db.delete(comments).where(eq(comments.id, id));
    }

    return NextResponse.json({
      success: true,
      deletedCount: allCommentIdsToDelete.length,
      deletedCommentIds: allCommentIdsToDelete
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
