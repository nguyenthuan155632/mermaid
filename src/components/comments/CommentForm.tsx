"use client";

import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Save as SaveIcon, Close as CloseIcon } from "@mui/icons-material";
import { CommentFormProps } from "./types";

export default function CommentForm({
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
  loading = false,
  placeholder,
  showCancelButton = true,
}: CommentFormProps & { showCancelButton?: boolean }) {
  const [content, setContent] = useState(initialData?.content || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      await onSubmit({
        content: content.trim(),
        positionX: initialData?.positionX || 0,
        positionY: initialData?.positionY || 0,
      });
      // Clear form after successful submission
      setContent("");
    } catch (error) {
      // Don't clear form on error
      console.error('Form submission failed:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && showCancelButton && onCancel) {
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "#ffffff",
        border: "1px solid #e9ecef",
        borderRadius: "8px",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
        width: "100%", // Use full width of container
        maxWidth: "none", // Remove max width constraint
        boxSizing: "border-box", // Ensure padding doesn't overflow
      }}
    >
      <Typography variant="subtitle2" sx={{
        mb: 2,
        fontWeight: 600,
        color: "#202124",
        fontSize: "14px",
      }}>
        {isEditing ? "Edit comment" : "Add comment"}
      </Typography>

      <form onSubmit={handleSubmit}>
        <TextField
          multiline
          rows={3}
          fullWidth
          placeholder={placeholder || "Type your comment here..."}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          autoFocus
          sx={{
            "& .MuiOutlinedInput-root": {
              fontSize: "14px",
              lineHeight: "20px",
              color: "#202124",
              "& fieldset": {
                borderColor: "#e9ecef",
                borderWidth: "1px",
              },
              "&:hover fieldset": {
                borderColor: "#c2c7d0",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#1a73e8",
                borderWidth: "2px",
              },
            },
            "& .MuiInputBase-input::placeholder": {
              color: "#9aa0a6",
            },
          }}
        />

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={!content.trim() || loading}
            startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
            sx={{
              flex: 1,
              bgcolor: "#1a73e8",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 500,
              textTransform: "none",
              py: 1,
              "&:hover": {
                bgcolor: "#1765cc",
              },
              "&:disabled": {
                bgcolor: "#f1f3f4",
                color: "#9aa0a6",
              },
            }}
          >
            {isEditing ? "Update" : "Comment"}
          </Button>

          {showCancelButton && (
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={onCancel}
              disabled={loading}
              startIcon={<CloseIcon />}
              sx={{
                fontSize: "14px",
                fontWeight: 500,
                textTransform: "none",
                py: 1,
                color: "#5f6368",
                borderColor: "#dadce0",
                "&:hover": {
                  bgcolor: "#f8f9fa",
                  borderColor: "#c2c7d0",
                },
                "&:disabled": {
                  color: "#9aa0a6",
                  borderColor: "#e9ecef",
                },
              }}
            >
              Cancel
            </Button>
          )}
        </Stack>

        <Typography variant="caption" sx={{
          mt: 1,
          display: "block",
          color: "#9aa0a6",
          fontSize: "12px",
        }}>
          Press Ctrl+Enter to save{showCancelButton && ", Esc to cancel"}
        </Typography>
      </form>
    </Box>
  );
}
