"use client";

/**
 * CommentPanel Component - Reusing CommentPopup UI for Sidebar Display
 * 
 * This component reuses the exact same UI and logic as CommentPopup.tsx,
 * but adapted for a sidebar/panel format instead of a popup. The only
 * differences are:
 * 
 * 1. SIZE: Panel is wider (840px vs 480px popup) and full height
 * 2. CONTAINER: Uses Drawer instead of Paper with fixed positioning
 * 3. LAYOUT: Optimized for vertical scrolling in a sidebar format
 * 
 * All other UI elements, styling, logic, and components are identical
 * to CommentPopup.tsx for complete consistency.
 */

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Drawer,
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
  Comment as CommentIcon,
} from "@mui/icons-material";
import { CommentPanelProps, ThreadedComment, CommentFormData, CommentWithUser } from "./types";
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

type ThreadPath = boolean[];

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
  diagramId,
  loading,
  refreshComments,
  isThreadResolved = false,
  canResolveThread = false,
}) => {
    // Silence linter warnings for reserved props
    void depth;
    void ancestorHasNextSibling;
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isAuthor = currentUserId === comment.user.id;
    const timestampLabel = `${formatRelativeTime(comment.createdAt)}${comment.updatedAt !== comment.createdAt ? " · edited" : ""
      }`;

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
            {comment.user.email.charAt(0).toUpperCase()}
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
                  {comment.user.email}
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
                sx={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: notionPalette.textPrimary,
                  fontSize: "13px",
                  lineHeight: "18px",
                  mt: 0.75,
                }}
              >
                {comment.content}
              </Typography>
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
                    if (onCreateComment && onSetReplyingToCommentId && diagramId) {
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
                  placeholder={`Replying to ${comment.user.email}...`}
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
                />
              </Box>
            );
          })}
      </Box>
    );
  };

export default function CommentPanel({
  comments,
  threadedComments,
  selectedCommentId,
  isOpen,
  onClose,
  onSelectComment,
  onEditComment,
  onDeleteComment,
  onToggleResolved,
  onCreateComment,
  currentUserId,
  diagramId,
}: CommentPanelProps) {
  const commentsListRef = useRef<HTMLDivElement>(null);

  // Use the comments hook to get refresh functionality
  const { refreshComments } = useComments({ diagramId: diagramId || "" });

  // State for managing edit/reply modes
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const findThreadRoot = (commentId: string | null): ThreadedComment | null => {
    if (!commentId) return null;

    for (const root of threadedComments) {
      if (root.id === commentId) {
        return root;
      }

      const stack = [...root.replies];
      while (stack.length) {
        const current = stack.pop();
        if (!current) continue;
        if (current.id === commentId) {
          return root;
        }
        if (current.replies?.length) {
          stack.push(...current.replies);
        }
      }
    }

    return null;
  };

  // Auto-scroll to selected comment when panel opens or selection changes
  useEffect(() => {
    if (isOpen && selectedCommentId && commentsListRef.current) {
      // Small delay to ensure the DOM is updated
      const timeoutId = setTimeout(() => {
        const selectedElement = commentsListRef.current?.querySelector(`[data-comment-id="${selectedCommentId}"]`);
        if (selectedElement) {
          selectedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, selectedCommentId]);

  // Handle Escape key to close panel
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

  // Wrapper functions to match the expected signatures
  const handleUpdateComment = async (commentId: string, data: { content: string }) => {
    if (onEditComment) {
      await onEditComment(commentId, { content: data.content, positionX: 0, positionY: 0 });
    }
  };

  const handleCreateComment = async (data: CommentFormData) => {
    if (onCreateComment) {
      await onCreateComment(data);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 840, // Panel width (double the original 420px for better visibility)
          maxWidth: "90vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          bgcolor: notionPalette.surface,
          borderLeft: `1px solid ${notionPalette.border}`,
          boxShadow: "none",
        },
      }}
    >
      {/* Header - Same as CommentPopup but adapted for panel */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2.5, borderBottom: `1px solid ${notionPalette.border}` }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
          <CommentIcon sx={{ color: notionPalette.textPrimary, fontSize: 20 }} />
          <Typography variant="h6" sx={{
            fontWeight: 600,
            color: notionPalette.textPrimary,
            fontSize: '18px',
            lineHeight: '22px',
            letterSpacing: '-0.01em'
          }}>
            Comments
          </Typography>
          {comments.length > 0 && (
            <Chip
              label={comments.length}
              size="small"
              sx={{
                bgcolor: notionPalette.accent,
                color: notionPalette.textSecondary,
                fontSize: "12px",
                height: "20px",
                fontWeight: 500,
              }}
            />
          )}
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
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

      {/* Content - Same as CommentPopup but adapted for panel */}
      <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {comments.length === 0 ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              p: 4,
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                bgcolor: notionPalette.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 3,
              }}
            >
              <CommentIcon sx={{ fontSize: 32, color: notionPalette.textSecondary }} />
            </Box>
            <Typography variant="h6" sx={{
              color: notionPalette.textPrimary,
              fontWeight: 600,
              fontSize: "18px",
              mb: 1
            }}>
              No comments yet
            </Typography>
            <Typography variant="body2" sx={{
              color: notionPalette.textSecondary,
              fontSize: "14px",
              lineHeight: "20px",
              maxWidth: "280px"
            }}>
              Click anywhere on the diagram to add your first comment and start the conversation
            </Typography>
          </Box>
        ) : (
          <Box
            ref={commentsListRef}
            sx={{
              flex: 1,
              maxHeight: 'calc(100vh - 100px)', // Adjust for header height
              overflowY: 'auto',
              p: 2.5,
              '&::-webkit-scrollbar': {
                width: '8px',
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
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {threadedComments.map((threadedComment) => {
                const isThreadResolved = threadedComment.isResolved;
                const rootCommentAuthorId = threadedComment.user.id;
                const isThreadOwner = !!currentUserId && currentUserId === rootCommentAuthorId;

                return (
                  <Box key={threadedComment.id} sx={{ mb: 3 }}>
                    <ThreadRenderer
                      threadedComment={threadedComment}
                      threadRoot={threadedComment}
                      onDelete={onDeleteComment}
                      onToggleResolved={onToggleResolved}
                      currentUserId={currentUserId}
                      editingCommentId={editingCommentId}
                      replyingToCommentId={replyingToCommentId}
                      onUpdateComment={handleUpdateComment}
                      onCreateComment={handleCreateComment}
                      onSetEditingCommentId={setEditingCommentId}
                      onSetReplyingToCommentId={setReplyingToCommentId}
                      diagramId=""
                      loading={loading}
                      refreshComments={refreshComments}
                      isThreadResolved={isThreadResolved}
                      canResolveThread={isThreadOwner}
                    />

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
                );
              })}
            </Box>

            {/* New Comment Form - At the bottom of all threads */}
            {!editingCommentId && !replyingToCommentId && threadedComments.some(thread => !thread.isResolved) && (
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
                    const unresolvedThreads = threadedComments.filter(thread => !thread.isResolved);
                    const selectedThread = findThreadRoot(selectedCommentId);
                    const targetThread = (selectedThread && !selectedThread.isResolved)
                      ? selectedThread
                      : unresolvedThreads[0];

                    if (!targetThread) {
                      console.warn("No available thread to attach the new comment to.");
                      return;
                    }

                    try {
                      setLoading(true);
                      await handleCreateComment({
                        content: data.content,
                        positionX: targetThread.positionX,
                        positionY: targetThread.positionY,
                        parentId: targetThread.id,
                      });
                      await refreshComments();
                    } catch (error) {
                      console.error('Failed to create comment:', error);
                    } finally {
                      setLoading(false);
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
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
