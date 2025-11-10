"use client";

import { useState, useRef } from "react";
import { Box } from "@mui/material";
import CommentIndicator from "./CommentIndicator";
import CommentForm from "./CommentForm";
import { CommentOverlayProps, ThreadedComment, CommentFormData } from "./types";

export default function CommentOverlay({
  threadedComments = [],
  selectedCommentId,
  zoom,
  pan,
  onCommentClick,
  onDiagramClick,
  isCommentMode,
  isPanning = false,
  isPinching = false,
  onCreateComment,
  onPopupClick,
  onUpdateCommentPosition,
  currentUserId,
  anonymousMode,
}: CommentOverlayProps & {
  currentUserId?: string;
  anonymousMode?: boolean;
}) {
  const [pendingCommentPosition, setPendingCommentPosition] = useState<{ x: number; y: number } | null>(null);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isCommentInThread = (thread: ThreadedComment, commentId?: string | null): boolean => {
    if (!commentId) return false;
    if (thread.id === commentId) return true;
    if (!thread.replies.length) return false;
    return thread.replies.some(reply => isCommentInThread(reply, commentId));
  };

  const handleDiagramClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isCommentMode || isAddingComment) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const containerCenterX = rect.width / 2;
    const containerCenterY = rect.height / 2;

    // Calculate position relative to the diagram's center, then account for zoom and pan
    const x = (event.clientX - rect.left - containerCenterX - pan.x) / zoom;
    const y = (event.clientY - rect.top - containerCenterY - pan.y) / zoom;

    setPendingCommentPosition({ x, y });
    setIsAddingComment(true);
  };

  const handleCommentSubmit = async (data: CommentFormData) => {
    if (pendingCommentPosition) {
      // Create the comment
      if (onCreateComment) {
        await onCreateComment({
          content: data.content,
          positionX: data.positionX,
          positionY: data.positionY,
          isAnonymous: anonymousMode || !currentUserId,
        });
      }

      // Call the editor's onDiagramClick with just the position
      if (onDiagramClick) {
        await onDiagramClick({
          x: data.positionX,
          y: data.positionY,
        });
      }
    }
    setPendingCommentPosition(null);
    setIsAddingComment(false);
  };

  const handleCommentCancel = () => {
    setPendingCommentPosition(null);
    setIsAddingComment(false);
  };

  // Handle sidebar click - only call the original handler
  const handleSidebarClick = (commentId: string) => {
    if (onCommentClick) {
      onCommentClick(commentId);
    }
  };

  // Handle popup click - trigger popup display
  const handlePopupClick = (commentId: string) => {
    // This should trigger the popup display in the parent component
    if (onPopupClick) {
      onPopupClick(commentId);
    }
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: isCommentMode ? "auto" : "none",
        zIndex: isCommentMode ? 50 : 0,
      }}
      onClick={handleDiagramClick}
    >
      {/* Comment Indicators */}
      {threadedComments.map((thread) => (
        <Box key={thread.id}>
          <CommentIndicator
            comment={thread}
            isSelected={isCommentInThread(thread, selectedCommentId)}
            onClick={() => onCommentClick?.(thread.id)}
            onSidebarClick={() => handleSidebarClick(thread.id)}
            onPopupClick={() => handlePopupClick(thread.id)}
            zoom={zoom}
            pan={pan}
            isPanning={isPanning}
            isPinching={isPinching}
            getContainerRect={() => containerRef.current?.getBoundingClientRect() ?? null}
            onDragEnd={async (position) => {
              if (onUpdateCommentPosition) {
                await onUpdateCommentPosition(thread.id, position);
              }
            }}
            anonymousMode={anonymousMode}
          />
        </Box>
      ))}

      {/* Pending Comment Form */}
      {isAddingComment && pendingCommentPosition && (
        <Box
          sx={{
            position: "absolute",
            left: `50%`,
            top: `50%`,
            transform: `translate(-50%, -50%) translate(${pendingCommentPosition.x * zoom + pan.x}px, ${pendingCommentPosition.y * zoom + pan.y}px)`,
            zIndex: 1000,
            pointerEvents: "auto",
            willChange: "transform",
            transition: (isPanning || isPinching) ? "none" : "transform 0.2s",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <CommentForm
            onSubmit={handleCommentSubmit}
            onCancel={handleCommentCancel}
            initialData={{
              positionX: pendingCommentPosition.x,
              positionY: pendingCommentPosition.y,
            }}
            isEditing={false}
            anonymousMode={anonymousMode}
          />
        </Box>
      )}

      {/* Comment Mode Indicator */}
      {isCommentMode && (
        <Box
          sx={{
            position: "absolute",
            top: 16,
            left: 16,
            bgcolor: "primary.main",
            color: "white",
            px: 2,
            py: 1,
            borderRadius: 1,
            fontSize: "0.875rem",
            fontWeight: 500,
            boxShadow: 2,
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          Click anywhere to add a comment
        </Box>
      )}
    </Box>
  );
}
