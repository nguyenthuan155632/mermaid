"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Stack,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Button,
} from "@mui/material";
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Reply as ReplyIcon,
} from "@mui/icons-material";
import { CommentThreadProps } from "./types";
import { formatRelativeTime } from "@/lib/utils";

export default function CommentThread({
  comment,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onToggleResolved,
  onReply,
  currentUserId,
  depth = 0,
}: CommentThreadProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isReplying, setIsReplying] = useState(false);
  const isAuthor = currentUserId === comment.user.id;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    onEdit();
  };

  const handleDelete = () => {
    handleMenuClose();
    onDelete();
  };

  const handleToggleResolved = () => {
    handleMenuClose();
    onToggleResolved();
  };

  const handleReply = () => {
    handleMenuClose();
    if (onReply) {
      onReply(comment.id);
    }
  };

  return (
    <Box sx={{ ml: depth > 0 ? depth * 3 : 0, mb: 1 }}>
      <Box
        data-comment-id={comment.id}
        sx={{
          p: 1.5,
          borderRadius: "8px",
          border: isSelected ? "1px solid #1a73e8" : "1px solid #e9ecef",
          bgcolor: isSelected ? "#f8f9ff" : "#ffffff",
          cursor: "pointer",
          transition: "all 0.2s ease",
          "&:hover": {
            borderColor: "#c2c7d0",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
          },
          ...(depth > 0 && {
            bgcolor: "#f8f9fa",
            borderLeft: "3px solid #1a73e8",
          }),
        }}
        onClick={onSelect}
      >
        {/* Header with user info and actions */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  bgcolor: "#e8eaed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#5f6368",
                }}
              >
                {comment.user.email.charAt(0).toUpperCase()}
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{
                  fontWeight: 600,
                  color: "#202124",
                  fontSize: "14px",
                  lineHeight: "18px"
                }}>
                  {comment.user.email}
                </Typography>
                <Typography variant="caption" sx={{
                  color: "#5f6368",
                  fontSize: "12px",
                  lineHeight: "14px"
                }}>
                  {formatRelativeTime(comment.createdAt)}
                  {comment.updatedAt !== comment.createdAt && " • edited"}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Stack direction="row" alignItems="center" spacing={1}>
            {comment.isResolved && (
              <Chip
                icon={<CheckCircleIcon fontSize="small" />}
                label="Resolved"
                size="small"
                sx={{
                  bgcolor: "#e6f4ea",
                  color: "#137333",
                  fontSize: "11px",
                  height: "20px",
                  fontWeight: 500,
                }}
              />
            )}

            {(isAuthor || currentUserId) && (
              <IconButton
                size="small"
                onClick={handleMenuOpen}
                sx={{
                  p: 0.5,
                  color: "#5f6368",
                  "&:hover": { bgcolor: "#f1f3f4" },
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        </Box>

        {/* Comment content */}
        <Typography
          variant="body2"
          component="div"
          sx={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: comment.isResolved ? "#5f6368" : "#202124",
            fontSize: "14px",
            lineHeight: "18px",
            opacity: comment.isResolved ? 0.7 : 1,
            textDecoration: comment.isResolved ? "line-through" : "none",
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

        {/* Actions */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
          {onReply && currentUserId && (
            <Button
              size="small"
              startIcon={<ReplyIcon fontSize="small" />}
              onClick={(e) => {
                e.stopPropagation();
                onReply(comment.id);
              }}
              sx={{
                minWidth: 'auto',
                fontSize: '12px',
                fontWeight: 500,
                color: "#1a73e8",
                textTransform: "none",
                py: 0.5,
                px: 1,
                "&:hover": {
                  bgcolor: "#f8f9ff",
                },
              }}
            >
              Reply
            </Button>
          )}
        </Box>
      </Box>

      {/* Context menu - Notion style */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            borderRadius: "8px",
            border: "1px solid #e9ecef",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            minWidth: "180px",
          },
        }}
      >
        {onReply && currentUserId && (
          <MenuItem onClick={handleReply} sx={{
            fontSize: "14px",
            color: "#202124",
            py: 1,
          }}>
            <ListItemIcon sx={{ minWidth: "32px" }}>
              <ReplyIcon fontSize="small" sx={{ color: "#5f6368" }} />
            </ListItemIcon>
            Reply
          </MenuItem>
        )}

        {isAuthor && (
          <MenuItem onClick={handleEdit} sx={{
            fontSize: "14px",
            color: "#202124",
            py: 1,
          }}>
            <ListItemIcon sx={{ minWidth: "32px" }}>
              <EditIcon fontSize="small" sx={{ color: "#5f6368" }} />
            </ListItemIcon>
            Edit
          </MenuItem>
        )}

        {(isAuthor || currentUserId) && (
          <MenuItem onClick={handleToggleResolved} sx={{
            fontSize: "14px",
            color: "#202124",
            py: 1,
          }}>
            <ListItemIcon sx={{ minWidth: "32px" }}>
              {comment.isResolved ? (
                <UncheckedIcon fontSize="small" sx={{ color: "#5f6368" }} />
              ) : (
                <CheckCircleIcon fontSize="small" sx={{ color: "#5f6368" }} />
              )}
            </ListItemIcon>
            {comment.isResolved ? "Mark as unresolved" : "Mark as resolved"}
          </MenuItem>
        )}

        {isAuthor && (
          <MenuItem onClick={handleDelete} sx={{
            fontSize: "14px",
            color: "#ea4335",
            py: 1,
          }}>
            <ListItemIcon sx={{ minWidth: "32px" }}>
              <DeleteIcon fontSize="small" sx={{ color: "#ea4335" }} />
            </ListItemIcon>
            Delete
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}
