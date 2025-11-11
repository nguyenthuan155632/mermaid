"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Popover,
} from "@mui/material";
import {
  Save as SaveIcon,
  Close as CloseIcon,
  FormatBold,
  FormatItalic,
  FormatStrikethrough,
  FormatColorText,
} from "@mui/icons-material";
import { CommentFormProps } from "./types";
import { getAnonymousSessionId } from "@/lib/anonymousSession";

const TEXT_COLORS = [
  "#202124", "#5f6368", "#1a73e8", "#ea4335", "#34a853",
  "#fbbc04", "#ff6d01", "#9334e6", "#e91e63", "#00bcd4",
];

// Utility function to convert URLs to clickable links
const linkifyText = (html: string): string => {
  // URL regex pattern that matches http, https, and www URLs
  const urlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;

  return html.replace(urlPattern, (url) => {
    // Add protocol if missing (for www. links)
    const href = url.startsWith('www.') ? `https://${url}` : url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; text-decoration: underline;">${url}</a>`;
  });
};

export default function CommentForm({
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
  loading = false,
  placeholder,
  showCancelButton = true,
  anonymousMode = false,
}: CommentFormProps & { showCancelButton?: boolean }) {
  const [content, setContent] = useState(initialData?.content || "");
  const editorRef = useRef<HTMLDivElement>(null);
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Initialize editor with existing content
  useEffect(() => {
    if (editorRef.current && initialData?.content) {
      editorRef.current.innerHTML = initialData.content;
    }
  }, [initialData?.content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      // Get the HTML content from the editor
      const htmlContent = editorRef.current?.innerHTML || "";

      // Convert plain URLs to clickable links
      const linkifiedContent = linkifyText(htmlContent);

      await onSubmit({
        content: linkifiedContent.trim(),
        positionX: initialData?.positionX || 0,
        positionY: initialData?.positionY || 0,
        isAnonymous: anonymousMode,
        // Always include anonymousSessionId when in anonymous mode (never undefined)
        ...(anonymousMode && { anonymousSessionId: getAnonymousSessionId() }),
      });
      // Clear form after successful submission
      setContent("");
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }
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

  const handleInput = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText;
      setContent(text);
    }
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleColorClick = (event: React.MouseEvent<HTMLElement>) => {
    setColorAnchor(event.currentTarget);
  };

  const handleColorClose = () => {
    setColorAnchor(null);
  };

  const applyColor = (color: string) => {
    applyFormat("foreColor", color);
    handleColorClose();
  };

  return (
    <Box
      sx={{
        p: 1.5,
        pt: 0,
        borderRadius: "6px",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
        width: "100%", // Use full width of container
        maxWidth: "none", // Remove max width constraint
        boxSizing: "border-box", // Ensure padding doesn't overflow
        bgcolor: "#fffcf4",
      }}
    >
      <form onSubmit={handleSubmit}>
        {/* Formatting Toolbar */}
        <Stack
          direction="row"
          spacing={0.25}
        >
          <Tooltip title="Bold (Ctrl+B)" arrow>
            <IconButton
              size="small"
              onClick={() => applyFormat("bold")}
              disabled={loading}
              sx={{
                color: "#5f6368",
                "&:hover": { bgcolor: "#f1f3f4" },
                "&:disabled": { color: "#9aa0a6" },
              }}
            >
              <FormatBold fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Italic (Ctrl+I)" arrow>
            <IconButton
              size="small"
              onClick={() => applyFormat("italic")}
              disabled={loading}
              sx={{
                color: "#5f6368",
                "&:hover": { bgcolor: "#f1f3f4" },
                "&:disabled": { color: "#9aa0a6" },
              }}
            >
              <FormatItalic fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Strikethrough" arrow>
            <IconButton
              size="small"
              onClick={() => applyFormat("strikeThrough")}
              disabled={loading}
              sx={{
                color: "#5f6368",
                "&:hover": { bgcolor: "#f1f3f4" },
                "&:disabled": { color: "#9aa0a6" },
              }}
            >
              <FormatStrikethrough fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Text color" arrow>
            <IconButton
              size="small"
              onClick={handleColorClick}
              disabled={loading}
              sx={{
                color: "#5f6368",
                "&:hover": { bgcolor: "#f1f3f4" },
                "&:disabled": { color: "#9aa0a6" },
              }}
            >
              <FormatColorText fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Color Picker Popover */}
        <Popover
          open={Boolean(colorAnchor)}
          anchorEl={colorAnchor}
          onClose={handleColorClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
        >
          <Box sx={{ p: 1.5, display: "flex", flexWrap: "wrap", width: 200 }}>
            {TEXT_COLORS.map((color) => (
              <IconButton
                key={color}
                onClick={() => applyColor(color)}
                sx={{
                  width: 32,
                  height: 32,
                  m: 0.5,
                  bgcolor: color,
                  "&:hover": {
                    bgcolor: color,
                    opacity: 0.8,
                    transform: "scale(1.1)",
                  },
                  border: "2px solid #fff",
                  boxShadow: "0 0 0 1px #dadce0",
                }}
              />
            ))}
          </Box>
        </Popover>

        {/* Rich Text Editor */}
        <Box
          ref={editorRef}
          contentEditable={!loading}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          suppressContentEditableWarning
          sx={{
            minHeight: "120px",
            maxHeight: "400px",
            overflowY: "auto",
            p: 1,
            fontSize: "14px",
            lineHeight: "20px",
            color: "#202124",
            border: "1px solid",
            borderColor: isFocused ? "#1a73e8" : "#e9ecef",
            borderWidth: isFocused ? "2px" : "1px",
            borderRadius: "4px",
            outline: "none",
            bgcolor: loading ? "#f5f7fa" : "#ffffff",
            cursor: loading ? "not-allowed" : "text",
            transition: "all 0.2s",
            "&:hover": {
              borderColor: loading ? "#e9ecef" : isFocused ? "#1a73e8" : "#c2c7d0",
            },
            "&:empty:before": {
              content: `"${placeholder || "Type your comment here..."}"`,
              color: "#9aa0a6",
              pointerEvents: "none",
            },
            "& b, & strong": {
              fontWeight: 700,
            },
            "& i, & em": {
              fontStyle: "italic",
            },
            "& strike, & s": {
              textDecoration: "line-through",
            },
          }}
        />

        <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }}>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={!content.trim() || loading}
            startIcon={loading ? <CircularProgress size={14} /> : <SaveIcon />}
            sx={{
              flex: 1,
              bgcolor: "#1a73e8",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 500,
              textTransform: "none",
              py: 0.75,
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
                fontSize: "13px",
                fontWeight: 500,
                textTransform: "none",
                py: 0.75,
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
          mt: 0.75,
          display: "block",
          color: "#9aa0a6",
          fontSize: "11px",
        }}>
          Press Ctrl+Enter to save{showCancelButton && ", Esc to cancel"}
        </Typography>
      </form>
    </Box>
  );
}
