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

const createCommentSchema = z.object({
  content: z.string().min(1, "Comment content is required"),
  positionX: z.number(),
  positionY: z.number(),
  parentId: z.string().uuid().optional().nullable(),
  isAnonymous: z.boolean().optional(),
  anonymousSessionId: z.string().uuid().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
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
      .where(eq(comments.diagramId, diagramId))
      .orderBy(comments.createdAt);

    // Ensure dates are properly serialized as ISO strings
    const serializedComments = commentsData.map(comment => {
      const baseComment = {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      };

      // For anonymous comments with session ID, compute display name and avatar
      if (comment.isAnonymous && comment.anonymousSessionId) {
        return {
          ...baseComment,
          anonymousSessionId: comment.anonymousSessionId,
          anonymousDisplayName: getAnonymousDisplayName(comment.anonymousSessionId),
          anonymousAvatarColor: getAnonymousAvatarColor(comment.anonymousSessionId),
          anonymousAvatarInitials: getAnonymousAvatarInitials(comment.anonymousSessionId),
          user: { id: 'anonymous', email: 'Anonymous' },
        };
      }

      // For anonymous comments without session ID (legacy), generate deterministic session ID
      if (comment.isAnonymous) {
        // Generate a deterministic session ID based on comment ID
        // This ensures the same comment always gets the same animal/color
        const deterministicSessionId = generateDeterministicSessionId(comment.id);
        return {
          ...baseComment,
          anonymousSessionId: deterministicSessionId,
          anonymousDisplayName: getAnonymousDisplayName(deterministicSessionId),
          anonymousAvatarColor: getAnonymousAvatarColor(deterministicSessionId),
          anonymousAvatarInitials: getAnonymousAvatarInitials(deterministicSessionId),
          user: { id: 'anonymous', email: 'Anonymous' },
        };
      }

      // For authenticated users
      return {
        ...baseComment,
        user: comment.user,
      };
    });

    return NextResponse.json({ items: serializedComments });
  } catch {
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

    // Remove undefined values before validation
    const cleanedBody = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined)
    );

    const validatedData = createCommentSchema.parse(cleanedBody);

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

    // Ensure anonymousSessionId is set for anonymous comments
    // For new comments, client MUST provide anonymousSessionId
    // We only generate deterministic session ID for legacy comments (old comments without session ID)
    if (isAnonymousRequest && !validatedData.anonymousSessionId) {
      // If it's an anonymous request but no session ID provided, this is an error
      // The client should always provide the session ID from localStorage
      return NextResponse.json(
        { error: "Anonymous session ID is required for anonymous comments" },
        { status: 400 }
      );
    }

    const [newComment] = await db
      .insert(comments)
      .values({
        diagramId,
        userId: isAnonymousRequest ? null : (session?.user?.id || null),
        isAnonymous: isAnonymousRequest,
        anonymousSessionId: isAnonymousRequest ? validatedData.anonymousSessionId : null,
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
      .where(eq(comments.id, newComment.id))
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
    console.error("Error creating comment:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: error.errors,
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Failed to create comment";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
