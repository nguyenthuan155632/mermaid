"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CommentWithUser,
  ThreadedComment,
  CommentFormData,
  UseCommentsOptions,
  UseCommentsReturn
} from "./types";

export function useComments({
  diagramId,
  onCommentCreated,
  onCommentUpdated,
  onCommentDeleted,
  onCommentResolved,
}: UseCommentsOptions): UseCommentsReturn {
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [threadedComments, setThreadedComments] = useState<ThreadedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Callbacks are now directly used in the dependency arrays of useCallback
  // This ensures they're always current and properly wired through the WebSocket integration

  const fetchComments = useCallback(async () => {
    if (!diagramId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/diagrams/${diagramId}/comments`);
      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }

      const data = await response.json();
      setComments(data.items || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [diagramId]);

  const createComment = useCallback(async (data: CommentFormData) => {
    if (!diagramId) {
      return;
    }

    try {
      const response = await fetch(`/api/diagrams/${diagramId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = "Failed to create comment";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, try to get text or use status text
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch {
            errorMessage = response.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const newComment = await response.json();
      setComments(prev => [...prev, newComment]);

      // Broadcast comment creation via WebSocket callback
      if (onCommentCreated) {
        onCommentCreated(newComment);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      throw err;
    }
  }, [diagramId, onCommentCreated]);

  const updateComment = useCallback(async (
    commentId: string,
    data: Partial<CommentFormData> & { isResolved?: boolean }
  ) => {
    if (!diagramId) return;

    try {
      const response = await fetch(`/api/diagrams/${diagramId}/comments/${commentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = `Failed to update comment (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, try to get text or use status text
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch {
            errorMessage = response.statusText || errorMessage;
          }
        }
        console.error("Update comment API error:", {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          requestData: data
        });
        throw new Error(errorMessage);
      }

      const updatedComment = await response.json();
      setComments(prev =>
        prev.map(comment =>
          comment.id === commentId ? updatedComment : comment
        )
      );

      // Broadcast comment update via WebSocket
      if (onCommentUpdated) {
        onCommentUpdated(updatedComment);
      }

      // If this was a resolve/unresolve action, also broadcast that specifically
      if (data.isResolved !== undefined && onCommentResolved) {
        onCommentResolved(commentId, data.isResolved);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      throw err;
    }
  }, [diagramId, onCommentUpdated, onCommentResolved]); // Include callbacks in dependencies

  const deleteComment = useCallback(async (commentId: string) => {
    if (!diagramId) return;

    try {
      const response = await fetch(`/api/diagrams/${diagramId}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let errorMessage = "Failed to delete comment";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, try to get text or use status text
          try {
            const text = await response.text();
            errorMessage = text || response.statusText || errorMessage;
          } catch {
            errorMessage = response.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      // Get the deleted comment IDs from response
      const responseData = await response.json();
      const deletedCommentIds = responseData.deletedCommentIds || [commentId];

      // Remove all deleted comments from state
      setComments(prev => prev.filter(comment => !deletedCommentIds.includes(comment.id)));

      // Broadcast deletion for each deleted comment
      if (onCommentDeleted) {
        deletedCommentIds.forEach((id: string) => onCommentDeleted(id));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      throw err;
    }
  }, [diagramId, onCommentDeleted]); // Include callback in dependencies

  const toggleResolved = useCallback(async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    await updateComment(commentId, {
      content: comment.content,
      isResolved: !comment.isResolved
    });
  }, [comments, updateComment]);

  const refreshComments = useCallback(async () => {
    await fetchComments();
  }, [fetchComments]);

  // Build threaded comments from flat list
  const buildThreadedComments = useCallback((flatComments: CommentWithUser[]): ThreadedComment[] => {
    const commentMap = new Map<string, ThreadedComment>();
    const rootComments: ThreadedComment[] = [];

    // First pass: create ThreadedComment objects for all comments
    flatComments.forEach(comment => {
      commentMap.set(comment.id, {
        ...comment,
        replies: [],
        depth: 0,
      });
    });

    // Second pass: build the tree structure
    flatComments.forEach(comment => {
      const threadedComment = commentMap.get(comment.id)!;

      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          threadedComment.depth = parent.depth + 1;
          parent.replies.push(threadedComment);
        } else {
          // Parent not found, treat as root comment
          rootComments.push(threadedComment);
        }
      } else {
        // Root comment
        rootComments.push(threadedComment);
      }
    });

    // Sort root comments by creation date (newest first)
    rootComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Sort replies within each comment by creation date (oldest first for conversation flow)
    const sortReplies = (comments: ThreadedComment[]) => {
      comments.forEach(comment => {
        comment.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        sortReplies(comment.replies);
      });
    };

    sortReplies(rootComments);

    return rootComments;
  }, []);

  // Update threaded comments whenever flat comments change
  useEffect(() => {
    const threaded = buildThreadedComments(comments);
    setThreadedComments(threaded);
  }, [comments, buildThreadedComments]);

  // Fetch comments when diagramId changes
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  return {
    comments,
    threadedComments,
    loading,
    error,
    createComment,
    updateComment,
    deleteComment,
    toggleResolved,
    refreshComments,
  };
}
