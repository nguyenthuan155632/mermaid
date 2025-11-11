"use client";

/**
 * CommentPopup Component - Nested Comment Thread Display (Max 3 Levels)
 * 
 * ARCHITECTURE:
 * This component supports up to 3 levels of nesting with a thread-line UI pattern.
 * Key design principles:
 * 
 * 1. LIMITED DEPTH: Comments are limited to 3 levels (depth 0, 1, 2, 3):
 *    - Depth 0: Root comment
 *    - Depth 1-2: Nested replies with Reply button
 *    - Depth 3: Maximum depth, Reply button is hidden
 *    - Depth 4+: Comments are filtered out and not displayed
 * 
 * 2. VISUAL HIERARCHY: Each nesting level adds 20px left margin indentation,
 *    combined with vertical lines and dots to show parent/child relationships.
 * 
 * 3. VISUAL CONNECTIONS: Vertical lines and dots connect parent/child comments,
 *    creating a clear visual thread structure similar to Slack or Linear.
 * 
 * 4. THREAD TRACKING: Each comment tracks:
 *    - depth: How deep in the tree (0 = root, max 3)
 *    - hasNextSibling: Whether this comment has siblings below it
 *    - ancestorHasNextSibling: Array tracking which ancestor levels need connecting lines
 * 
 * 5. RECURSIVE RENDERING: ThreadRenderer recursively renders comments and their replies,
 *    passing down the thread path information to maintain proper line connections.
 * 
 * 6. SPACE EFFICIENCY: The fixed timeline column (32px) plus 20px indentation per level
 *    ensures the popup stays within 480px width for all 3 nesting levels.
 */

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Avatar,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  Button,
} from "@mui/material";
import {
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Reply as ReplyIcon,
  TaskAlt as TaskAltIcon,
} from "@mui/icons-material";
import { CommentWithUser, ThreadedComment, CommentFormData } from "./types";
import { formatRelativeTime } from "@/lib/utils";
import CommentForm from "./CommentForm";
import { useComments } from "./useComments";

const notionPalette = {
  surface: "#FFFCF4",
  border: "#E6E0D4",
  cardBorder: "#EAE5DB",
  timeline: "#DCD4C3",
  textPrimary: "#2F3437",
  textSecondary: "#858B93",
  accent: "#F4F1E6",
};

const avatarSize = 32;
const dotSize = 10;
const timelineColumnWidth = 32;
const connectorWidth = 2;

// Maximum nesting depth (0 = root, 1 = first reply, 2 = second reply, 3 = third reply)
// Comments at depth 3 cannot have replies, and depth 4+ are hidden
const MAX_COMMENT_DEPTH = 3;

/**
 * ThreadPath tracks which ancestor levels need vertical connecting lines.
 * Example: [true, false, true] means:
 * - Level 0 ancestor has siblings below, draw line
 * - Level 1 ancestor has no siblings below, no line
 * - Level 2 ancestor has siblings below, draw line
 * 
 * This allows the component to properly render thread connections at unlimited depth
 * without using indentation.
 */
type ThreadPath = boolean[];

interface CommentPopupProps {
  comment: CommentWithUser;
  threadedComment?: ThreadedComment;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: (commentId: string) => void;
  onToggleResolved: (commentId: string) => void;
  currentUserId?: string;
  // New props for form handling
  onCreateComment?: (data: CommentFormData) => Promise<void>;
  onUpdateComment?: (commentId: string, data: { content: string }) => Promise<void>;
  diagramId?: string;
  onDrag?: (position: { x: number; y: number }) => void;
  onDragEnd?: (position: { x: number; y: number }) => void;
  anonymousMode?: boolean;
}

/**
 * ThreadCommentRenderer - Renders a single comment with thread-line UI
 * 
 * This component receives thread path information (depth, hasNextSibling, ancestorHasNextSibling)
 * which enables unlimited nesting support. Currently, the simple vertical line logic only needs
 * hasNextSibling, but depth and ancestorHasNextSibling are passed for potential future enhancements:
 * 
 * - depth: Could be used for visual variations at different levels (colors, sizes, etc.)
 * - ancestorHasNextSibling: Could be used to draw multiple parallel vertical lines for
 *   deeply nested structures (like VS Code's file tree or GitHub's thread view)
 * 
 * The current implementation uses a single vertical line that extends based on hasNextSibling,
 * which works well for the constrained popup width while maintaining clear visual hierarchy.
 */
const ThreadCommentRenderer: React.FC<{
  comment: CommentWithUser;
  threadRoot: ThreadedComment;
  depth: number;
  isMainComment?: boolean;
  hasNextSibling?: boolean;
  ancestorHasNextSibling?: ThreadPath;
  onDelete: (commentId: string) => void;
  onToggleResolved: (commentId: string) => void;
  currentUserId?: string;
  // New props for inline editing
  editingCommentId?: string | null;
  replyingToCommentId?: string | null;
  onUpdateComment?: (commentId: string, data: { content: string }) => Promise<void>;
  onCreateComment?: (data: CommentFormData) => Promise<void>;
  onSetEditingCommentId?: (id: string | null) => void;
  onSetReplyingToCommentId?: (id: string | null) => void;
  diagramId?: string;
  loading?: boolean;
  refreshComments?: () => Promise<void>;
  isThreadResolved?: boolean; // New prop to track if the entire thread is resolved
  canResolveThread?: boolean;
  anonymousMode?: boolean;
}> = ({
  comment,
  threadRoot,
  depth, // Reserved for future visual enhancements at different nesting levels
  isMainComment = false,
  hasNextSibling = false,
  ancestorHasNextSibling = [], // Reserved for future multi-line thread visualization
  onDelete,
  onToggleResolved,
  currentUserId,
  editingCommentId,
  replyingToCommentId,
  onUpdateComment,
  onCreateComment,
  onSetEditingCommentId,
  onSetReplyingToCommentId,
  loading,
  refreshComments,
  isThreadResolved = false,
  canResolveThread = false,
  anonymousMode = false,
}) => {
    // Silence linter warnings for reserved props
    void depth;
    void ancestorHasNextSibling;
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isAuthor = currentUserId === comment.user?.id;
    const timestampLabel = `${formatRelativeTime(comment.createdAt)}${comment.updatedAt !== comment.createdAt ? " · edited" : ""
      }`;

    // Show email or Anonymous based on anonymousMode
    // When anonymousMode is ON: hide email and show "Anonymous"
    // When anonymousMode is OFF: show actual email or "Unknown" if no email
    const displayName = anonymousMode ? "Anonymous" : (comment.user?.email || "Unknown");

    const isDeleteEnabled = false;
    const canReply = Boolean(currentUserId && depth < MAX_COMMENT_DEPTH && !isThreadResolved);
    const canEdit = Boolean(isAuthor && !isThreadResolved);
    const canResolveMenu = Boolean(canResolveThread && isMainComment);
    const hasMenuActions = canReply || canEdit || canResolveMenu || isDeleteEnabled;

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
      setAnchorEl(null);
    };

    const handleEdit = () => {
      if (isThreadResolved) {
        return;
      }
      handleMenuClose();
      if (onSetEditingCommentId) {
        onSetEditingCommentId(comment.id);
      }
    };

    const handleDelete = () => {
      handleMenuClose();
      onDelete(comment.id);
    };

    const handleToggleResolved = async () => {
      handleMenuClose();
      try {
        await Promise.resolve(onToggleResolved(comment.id));
        if (refreshComments) {
          await refreshComments();
        }
      } catch (error) {
        console.error("Failed to toggle resolved state:", error);
      }
    };


    return (
      <>
        <Box
          sx={{
            position: "relative",
            display: "flex",
            gap: 1.25,
            mt: isMainComment ? 0 : 0.5,
            mb: isMainComment ? 1.75 : 0.5,
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              position: "relative",
              width: timelineColumnWidth,
              display: "flex",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {/* Main vertical connector line for this comment */}
            {/* Only draw line upward for non-main comments, and downward if has siblings or replies */}
            {!isMainComment && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  bottom: dotSize / 2,
                  width: connectorWidth,
                  borderRadius: "999px",
                  backgroundColor: notionPalette.timeline,
                  zIndex: 1,
                }}
              />
            )}

            {/* Line extending downward if this comment has siblings below or has replies */}
            {hasNextSibling && (
              <Box
                sx={{
                  position: "absolute",
                  top: dotSize / 2,
                  bottom: 0,
                  width: connectorWidth,
                  borderRadius: "999px",
                  backgroundColor: notionPalette.timeline,
                  zIndex: 1,
                }}
              />
            )}

            {/* The dot/node indicator - placed at the start of the line */}
            <Box
              sx={{
                width: dotSize,
                height: dotSize,
                borderRadius: "50%",
                border: "2px solid #fff",
                backgroundColor: notionPalette.timeline,
                boxShadow: "0 4px 8px rgba(47, 52, 55, 0.2)",
                marginTop: 0,
                zIndex: 2,
                position: "relative",
              }}
            />
          </Box>

          <Avatar
            sx={{
              width: avatarSize,
              height: avatarSize,
              fontSize: "13px",
              fontWeight: 600,
              bgcolor: notionPalette.accent,
              color: notionPalette.textPrimary,
              border: `1px solid ${notionPalette.border}`,
              boxShadow: "0 6px 14px rgba(47, 52, 55, 0.18)",
              flexShrink: 0,
              marginLeft: "-12px",
            }}
          >
            ?
          </Avatar>

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              opacity: comment.isResolved ? 0.75 : 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    color: notionPalette.textPrimary,
                    fontSize: "14px",
                    lineHeight: "18px",
                  }}
                >
                  {displayName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: notionPalette.textSecondary,
                    fontSize: "12px",
                    lineHeight: "16px",
                  }}
                >
                  {timestampLabel}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {comment.isResolved && (
                  <Chip
                    icon={<CheckCircleIcon fontSize="small" />}
                    label="Resolved"
                    size="small"
                    sx={{
                      bgcolor: "#E9F6EC",
                      color: "#0F8A3E",
                      fontSize: "11px",
                      fontWeight: 600,
                      height: "22px",
                      "& .MuiChip-icon": {
                        fontSize: "16px",
                      },
                    }}
                  />
                )}

                {hasMenuActions && (
                  <IconButton
                    size="small"
                    onClick={handleMenuOpen}
                    sx={{
                      p: 0.5,
                      color: notionPalette.textSecondary,
                      "&:hover": { bgcolor: notionPalette.accent },
                    }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>

            {editingCommentId === comment.id && !isThreadResolved ? (
              <Box sx={{ mt: 0.75 }}>
                <CommentForm
                  onSubmit={async (data) => {
                    if (onUpdateComment && onSetEditingCommentId) {
                      try {
                        await onUpdateComment(comment.id, { content: data.content });
                        onSetEditingCommentId(null);
                      } catch (error) {
                        console.error('Failed to update comment:', error);
                      }
                    }
                  }}
                  onCancel={() => {
                    if (onSetEditingCommentId) {
                      onSetEditingCommentId(null);
                    }
                  }}
                  initialData={{ content: comment.content }}
                  isEditing={true}
                  loading={loading}
                  placeholder="Edit your comment..."
                />
              </Box>
            ) : (
              <Typography
                variant="body2"
                component="div"
                sx={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: notionPalette.textPrimary,
                  fontSize: "13px",
                  lineHeight: "18px",
                  mt: 0.75,
                  "& b, & strong": {
                    fontWeight: 700,
                  },
                  "& i, & em": {
                    fontStyle: "italic",
                  },
                  "& strike, & s": {
                    textDecoration: "line-through",
                  },
                  "& a": {
                    color: "#1a73e8",
                    textDecoration: "underline",
                    "&:hover": {
                      color: "#1765cc",
                    },
                  },
                }}
                dangerouslySetInnerHTML={{ __html: comment.content }}
              />
            )}

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1 }}>
              {/* Only show Reply button if depth is less than MAX_COMMENT_DEPTH and thread is not resolved */}
              {currentUserId && depth < MAX_COMMENT_DEPTH && !isThreadResolved && (
                <Button
                  size="small"
                  onClick={() => {
                    if (isThreadResolved) return;
                    if (onSetReplyingToCommentId) {
                      onSetReplyingToCommentId(comment.id);
                    }
                  }}
                  sx={{
                    textTransform: "none",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: notionPalette.textSecondary,
                    px: 0,
                    py: 0,
                    minWidth: 0,
                    "&:hover": {
                      color: notionPalette.textPrimary,
                      backgroundColor: "transparent",
                    },
                  }}
                >
                  Reply
                </Button>
              )}

              {canResolveThread && isMainComment && (
                <Button
                  size="small"
                  onClick={handleToggleResolved}
                  sx={{
                    textTransform: "none",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: comment.isResolved ? "#9A5C10" : "#0F6BFF",
                    bgcolor: "transparent",
                    borderRadius: "999px",
                    px: 0,
                    py: 0,
                    minWidth: 0,
                    "&:hover": {
                      backgroundColor: "transparent",
                    },
                  }}
                >
                  {comment.isResolved ? "Reopen" : "Resolve"}
                </Button>
              )}
            </Box>

            {/* Reply Form */}
            {!isThreadResolved && replyingToCommentId === comment.id && (
              <Box sx={{ mt: 1.5, ml: -0.5 }}>
                <CommentForm
                  onSubmit={async (data) => {
                    if (onCreateComment && onSetReplyingToCommentId) {
                      const targetPosition = threadRoot || comment;
                      try {
                        await onCreateComment({
                          content: data.content,
                          positionX: targetPosition.positionX,
                          positionY: targetPosition.positionY,
                          parentId: comment.id,
                        });
                        onSetReplyingToCommentId(null);
                      } catch (error) {
                        console.error('Failed to create reply:', error);
                      }
                    }
                  }}
                  onCancel={() => {
                    if (onSetReplyingToCommentId) {
                      onSetReplyingToCommentId(null);
                    }
                  }}
                  placeholder={`Replying to ${displayName}...`}
                  loading={loading}
                />
              </Box>
            )}
          </Box>
        </Box>

        {hasMenuActions && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            onClick={(e) => e.stopPropagation()}
            PaperProps={{
              sx: {
                borderRadius: "14px",
                border: `1px solid ${notionPalette.cardBorder}`,
                boxShadow: "0 25px 60px rgba(47, 52, 55, 0.18)",
                minWidth: "180px",
                overflow: "hidden",
              },
            }}
          >
            {/* Only show Reply menu item if depth is less than MAX_COMMENT_DEPTH */}
            {canReply && (
              <MenuItem
                onClick={() => {
                  if (isThreadResolved) return;
                  if (onSetReplyingToCommentId) {
                    onSetReplyingToCommentId(comment.id);
                  }
                }}
                sx={{
                  fontSize: "13px",
                  color: notionPalette.textPrimary,
                  py: 0.75,
                  "&:hover": { bgcolor: notionPalette.accent },
                }}
              >
                <ListItemIcon sx={{ minWidth: "28px" }}>
                  <ReplyIcon fontSize="small" sx={{ color: notionPalette.textSecondary }} />
                </ListItemIcon>
                Reply
              </MenuItem>
            )}

            {canEdit && (
              <MenuItem
                onClick={handleEdit}
                sx={{
                  fontSize: "13px",
                  color: notionPalette.textPrimary,
                  py: 0.75,
                  "&:hover": { bgcolor: notionPalette.accent },
                }}
              >
                <ListItemIcon sx={{ minWidth: "28px" }}>
                  <EditIcon fontSize="small" sx={{ color: notionPalette.textSecondary }} />
                </ListItemIcon>
                Edit
              </MenuItem>
            )}

            {canResolveMenu && (
              <MenuItem
                onClick={handleToggleResolved}
                sx={{
                  fontSize: "13px",
                  color: notionPalette.textPrimary,
                  py: 0.75,
                  "&:hover": { bgcolor: notionPalette.accent },
                }}
              >
                <ListItemIcon sx={{ minWidth: "28px" }}>
                  {comment.isResolved ? (
                    <UncheckedIcon fontSize="small" sx={{ color: notionPalette.textSecondary }} />
                  ) : (
                    <CheckCircleIcon fontSize="small" sx={{ color: notionPalette.textSecondary }} />
                  )}
                </ListItemIcon>
                {comment.isResolved ? "Mark as unresolved" : "Mark as resolved"}
              </MenuItem>
            )}

            {isAuthor && isDeleteEnabled && (
              <MenuItem
                onClick={handleDelete}
                sx={{
                  fontSize: "13px",
                  color: "#C62828",
                  py: 0.75,
                  "&:hover": { bgcolor: "#FDECEC" },
                }}
              >
                <ListItemIcon sx={{ minWidth: "28px" }}>
                  <DeleteIcon fontSize="small" sx={{ color: "#C62828" }} />
                </ListItemIcon>
                Delete
              </MenuItem>
            )}
          </Menu>
        )}
      </>
    );
  };

// Recursive component to render threaded comments
const ThreadRenderer: React.FC<{
  threadedComment: ThreadedComment;
  threadRoot: ThreadedComment;
  hasNextSibling?: boolean;
  ancestorHasNextSibling?: ThreadPath;
  onDelete: (commentId: string) => void;
  onToggleResolved: (commentId: string) => void;
  currentUserId?: string;
  // New props for inline editing
  editingCommentId?: string | null;
  replyingToCommentId?: string | null;
  onUpdateComment?: (commentId: string, data: { content: string }) => Promise<void>;
  onCreateComment?: (data: CommentFormData) => Promise<void>;
  onSetEditingCommentId?: (id: string | null) => void;
  onSetReplyingToCommentId?: (id: string | null) => void;
  diagramId?: string;
  loading?: boolean;
  refreshComments?: () => Promise<void>;
  isThreadResolved?: boolean; // New prop to track if entire thread is resolved
  canResolveThread?: boolean;
  anonymousMode?: boolean;
}> = ({
  threadedComment,
  threadRoot,
  hasNextSibling = false,
  ancestorHasNextSibling = [],
  onDelete,
  onToggleResolved,
  currentUserId,
  editingCommentId,
  replyingToCommentId,
  onUpdateComment,
  onCreateComment,
  onSetEditingCommentId,
  onSetReplyingToCommentId,
  diagramId,
  loading,
  refreshComments,
  isThreadResolved = false,
  canResolveThread = false,
  anonymousMode = false,
}) => {
    const hasReplies = threadedComment.replies && threadedComment.replies.length > 0;

    return (
      <Box>
        <ThreadCommentRenderer
          comment={threadedComment}
          threadRoot={threadRoot}
          depth={threadedComment.depth}
          isMainComment={threadedComment.depth === 0}
          hasNextSibling={hasNextSibling || hasReplies}
          ancestorHasNextSibling={ancestorHasNextSibling}
          onDelete={onDelete}
          onToggleResolved={onToggleResolved}
          currentUserId={currentUserId}
          editingCommentId={editingCommentId}
          replyingToCommentId={replyingToCommentId}
          onUpdateComment={onUpdateComment}
          onCreateComment={onCreateComment}
          onSetEditingCommentId={onSetEditingCommentId}
          onSetReplyingToCommentId={onSetReplyingToCommentId}
          diagramId={diagramId}
          loading={loading}
          refreshComments={refreshComments}
          isThreadResolved={isThreadResolved}
          canResolveThread={canResolveThread}
          anonymousMode={anonymousMode}
        />

        {/* Render replies with indentation for visual hierarchy */}
        {/* Filter out comments deeper than MAX_COMMENT_DEPTH */}
        {hasReplies && threadedComment.replies
          .filter(reply => reply.depth <= MAX_COMMENT_DEPTH)
          .map((reply, index, filteredReplies) => {
            const isLastReply = index === filteredReplies.length - 1;
            // Update the ancestor path: current level determines if line continues
            const newAncestorPath = [...ancestorHasNextSibling, hasNextSibling];
            // Add left margin for nested replies (20px per level for clear hierarchy)
            const indentAmount = 20;

            return (
              <Box key={reply.id} sx={{ ml: `${indentAmount}px` }}>
                <ThreadRenderer
                  threadedComment={reply}
                  threadRoot={threadRoot}
                  hasNextSibling={!isLastReply}
                  ancestorHasNextSibling={newAncestorPath}
                  onDelete={onDelete}
                  onToggleResolved={onToggleResolved}
                  currentUserId={currentUserId}
                  editingCommentId={editingCommentId}
                  replyingToCommentId={replyingToCommentId}
                  onUpdateComment={onUpdateComment}
                  onCreateComment={onCreateComment}
                  onSetEditingCommentId={onSetEditingCommentId}
                  onSetReplyingToCommentId={onSetReplyingToCommentId}
                  diagramId={diagramId}
                  loading={loading}
                  refreshComments={refreshComments}
                  isThreadResolved={isThreadResolved}
                  canResolveThread={canResolveThread}
                  anonymousMode={anonymousMode}
                />
              </Box>
            );
          })}
      </Box>
    );
  };

export default function CommentPopup({
  comment,
  threadedComment,
  position,
  onClose,
  onDelete,
  onToggleResolved,
  currentUserId,
  onCreateComment,
  onUpdateComment,
  diagramId,
  onDrag,
  onDragEnd,
  anonymousMode = false,
}: CommentPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [dragPosition, setDragPosition] = useState(position);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOriginRef = useRef(position);
  const dragPositionRef = useRef(position);
  const [isDragging, setIsDragging] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    dragPositionRef.current = dragPosition;
  }, [dragPosition]);

  useEffect(() => {
    if (!isDragging) {
      setDragPosition(position);
      dragOriginRef.current = position;
    }
  }, [position.x, position.y, isDragging, position]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }
      const deltaX = event.clientX - dragStartRef.current.x;
      const deltaY = event.clientY - dragStartRef.current.y;
      const nextPosition = {
        x: dragOriginRef.current.x + deltaX,
        y: dragOriginRef.current.y + deltaY,
      };
      setDragPosition(nextPosition);
      onDrag?.(nextPosition);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }
      setIsDragging(false);
      activePointerIdRef.current = null;
      popupRef.current?.releasePointerCapture?.(event.pointerId);
      dragOriginRef.current = dragPositionRef.current;
      onDragEnd?.(dragPositionRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [isDragging, onDrag, onDragEnd]);

  // Use the comments hook to get refresh functionality
  const { refreshComments } = useComments({ diagramId: diagramId || "" });

  // Use the comment and threadedComment props directly
  // The parent component (MermaidRenderer) will handle live data updates
  const currentComment = comment;
  const currentThreadedComment = threadedComment;
  const baseThreadRoot: ThreadedComment = currentThreadedComment ?? {
    ...currentComment,
    replies: [],
    depth: 0,
  };

  // State for managing edit/reply modes
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The thread always resolves based on the root comment, even if a reply opened the popup
  const rootCommentId = currentThreadedComment?.id ?? currentComment.id;
  const isThreadResolved = currentThreadedComment?.isResolved ?? currentComment.isResolved;
  const rootCommentAuthorId = currentThreadedComment?.user?.id ?? currentComment.user?.id;
  const isThreadOwner = !!currentUserId && currentUserId === rootCommentAuthorId;


  // Handle Escape key to close popup when unfocused
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Calculate popup position to stay within viewport
  const calculatePopupPosition = () => {
    const popupWidth = 480; // Increased from 380 to 480 for better readability
    const popupHeight = Math.min(500, window.innerHeight * 0.8); // Responsive height
    const margin = 20; // Increased margin for better visibility

    // Position popup in the right bottom corner but higher up
    let left = window.innerWidth - popupWidth - margin;
    let top = window.innerHeight - popupHeight - margin - 200; // Move 200px higher to show footer

    // Ensure popup doesn't go off the left or top edges (for very small screens)
    left = Math.max(margin, left);
    top = Math.max(margin, top);

    return { left, top };
  };

  const popupPosition = calculatePopupPosition();
  const handleDragPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("[data-no-drag='true']")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragOriginRef.current = dragPositionRef.current;
    activePointerIdRef.current = event.pointerId;
    popupRef.current?.setPointerCapture?.(event.pointerId);
    setIsDragging(true);
  };
  const handleThreadResolvedToggle = async () => {
    try {
      await Promise.resolve(onToggleResolved(rootCommentId));
      await refreshComments();
    } catch (error) {
      console.error("Failed to toggle thread resolved state:", error);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'transparent',
          zIndex: 1000,
        }}
        onClick={onClose}
      />

      {/* Popup */}
      <Paper
        ref={popupRef}
        sx={{
          position: 'fixed',
          left: popupPosition.left,
          top: popupPosition.top,
          width: 480, // Increased from 380 to 480 for better readability
          maxWidth: '92vw',
          maxHeight: '75vh',
          borderRadius: '15px',
          backgroundColor: notionPalette.surface,
          border: `1px solid ${notionPalette.border}`,
          boxShadow: '0 35px 80px rgba(47, 52, 55, 0.22)',
          zIndex: 1001,
          p: 2.5,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
          onPointerDown={handleDragPointerDown}
        >
          <Typography variant="h6" sx={{
            fontWeight: 600,
            color: notionPalette.textPrimary,
            fontSize: '18px',
            lineHeight: '22px',
            letterSpacing: '-0.01em'
          }}>
            Comment Thread
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Thread Resolved Button */}
            {isThreadOwner && (
              <Button
                data-no-drag="true"
                size="small"
                onClick={handleThreadResolvedToggle}
                startIcon={isThreadResolved ? <UncheckedIcon fontSize="small" /> : <TaskAltIcon fontSize="small" />}
                sx={{
                  textTransform: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isThreadResolved ? '#9A5C10' : '#0F6BFF',
                  bgcolor: isThreadResolved ? '#FEF3E0' : '#E6F4FF',
                  border: `1px solid ${isThreadResolved ? '#F4C430' : '#B3D9FF'}`,
                  borderRadius: '999px',
                  px: 1.5,
                  py: 0.5,
                  minWidth: 'auto',
                  height: '28px',
                  '&:hover': {
                    bgcolor: isThreadResolved ? '#FDE8B8' : '#D1E9FF',
                    borderColor: isThreadResolved ? '#E6B800' : '#66B3FF',
                  },
                  '& .MuiButton-startIcon': {
                    margin: 0,
                    fontSize: '14px',
                  },
                }}
              >
                {isThreadResolved ? 'Reopen' : 'Resolved'}
              </Button>
            )}
            <IconButton
              data-no-drag="true"
              size="small"
              onClick={onClose}
              sx={{
                p: 0.75,
                bgcolor: '#fff',
                borderRadius: '50%',
                border: `1px solid ${notionPalette.border}`,
                color: notionPalette.textSecondary,
                boxShadow: '0 6px 14px rgba(47, 52, 55, 0.12)',
                '&:hover': { bgcolor: notionPalette.accent },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Thread Content - Includes input form for scrolling */}
        <Box
          sx={{
            flex: 1,
            maxHeight: '65vh', // Further increased height for better scrolling
            overflowY: 'auto',
            pr: 0.75,
            pl: 0,
            '&::-webkit-scrollbar': {
              width: '8px', // Wider scrollbar for better visibility
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: notionPalette.border,
              borderRadius: '999px',
              '&:hover': {
                backgroundColor: notionPalette.textSecondary,
              },
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },
            scrollbarWidth: 'thin',
            scrollbarColor: `${notionPalette.border} transparent`,
          }}
        >
          {currentThreadedComment ? (
            <ThreadRenderer
              threadedComment={currentThreadedComment}
              threadRoot={baseThreadRoot}
              onDelete={onDelete}
              onToggleResolved={onToggleResolved}
              currentUserId={currentUserId}
              editingCommentId={editingCommentId}
              replyingToCommentId={replyingToCommentId}
              onUpdateComment={onUpdateComment}
              onCreateComment={onCreateComment}
              onSetEditingCommentId={setEditingCommentId}
              onSetReplyingToCommentId={setReplyingToCommentId}
              diagramId={diagramId}
              loading={loading}
              refreshComments={refreshComments}
              isThreadResolved={isThreadResolved}
              canResolveThread={isThreadOwner}
              anonymousMode={anonymousMode}
            />
          ) : (
            <ThreadCommentRenderer
              comment={currentComment}
              threadRoot={baseThreadRoot}
              depth={0}
              isMainComment={true}
              hasNextSibling={false}
              ancestorHasNextSibling={[]}
              onDelete={onDelete}
              onToggleResolved={onToggleResolved}
              currentUserId={currentUserId}
              editingCommentId={editingCommentId}
              replyingToCommentId={replyingToCommentId}
              onUpdateComment={onUpdateComment}
              onCreateComment={onCreateComment}
              onSetEditingCommentId={setEditingCommentId}
              onSetReplyingToCommentId={setReplyingToCommentId}
              diagramId={diagramId}
              loading={loading}
              refreshComments={refreshComments}
              isThreadResolved={isThreadResolved}
              canResolveThread={isThreadOwner}
              anonymousMode={anonymousMode}
            />
          )}

          {/* New Comment Form - Inside scrollable area */}
          {!editingCommentId && !replyingToCommentId && !isThreadResolved && (
            <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${notionPalette.border}` }}>
              {!currentUserId && (
                <Typography
                  variant="caption"
                  sx={{
                    color: notionPalette.textSecondary,
                    fontSize: "11px",
                    mb: 1,
                    display: "block",
                    fontStyle: "italic",
                  }}
                >
                  💡 Login required for actual functionality.
                </Typography>
              )}
              <CommentForm
                onSubmit={async (data) => {
                  if (onCreateComment && diagramId) {
                    try {
                      setLoading(true);
                      // Get the root comment ID from the current thread
                      await onCreateComment({
                        content: data.content,
                        positionX: baseThreadRoot.positionX,
                        positionY: baseThreadRoot.positionY,
                        parentId: rootCommentId, // Reply to the root comment of the current thread
                      });
                      // Refresh comments to show the new comment
                      await refreshComments();
                    } catch (error) {
                      console.error('Failed to create comment:', error);
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                onCancel={() => {
                  // No-op for main comment form since cancel button is hidden
                }}
                placeholder="Add a comment..."
                loading={loading}
                showCancelButton={false}
              />
            </Box>
          )}

          {/* Thread Resolved Message */}
          {isThreadResolved && (
            <Box sx={{
              mt: 2,
              pt: 2,
              borderTop: `1px solid ${notionPalette.border}`,
              textAlign: 'center',
              py: 1.5
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                <CheckCircleIcon sx={{ color: '#0F8A3E', fontSize: '20px' }} />
                <Typography
                  variant="body2"
                  sx={{
                    color: notionPalette.textPrimary,
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  This thread has been resolved
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: notionPalette.textSecondary,
                  fontSize: '11px',
                  fontStyle: 'italic',
                }}
              >
                No further comments or replies can be added
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </>
  );
}
