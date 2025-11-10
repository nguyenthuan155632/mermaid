"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Typography,
  Button,
  AppBar,
  Toolbar,
  Stack,
  useTheme,
  useMediaQuery,
  IconButton,
} from "@mui/material";
import {
  GetApp,
  ExpandMore,
  Close as CloseIcon,
  Image as ImageIcon,
  Comment,
} from "@mui/icons-material";
import MermaidRenderer from "@/components/MermaidRenderer";
import CommentPanel from "@/components/comments/CommentPanel";
import { useComments } from "@/components/comments/useComments";
import { exportToPNG, exportToSVG } from "@/lib/export";

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const { data: session } = useSession();
  const [diagram, setDiagram] = useState<{
    id: string;
    title: string;
    code: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Comment-related state - reusing the same pattern from editor
  const [isCommentMode, setIsCommentMode] = useState(false);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

  // Initialize comments hook - only when we have a diagram ID
  const {
    comments,
    threadedComments,
    createComment,
    updateComment,
    deleteComment,
    toggleResolved,
    refreshComments,
  } = useComments({ diagramId: diagram?.id || "" });

  useEffect(() => {
    if (token) {
      fetch(`/api/share/${token}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.code) {
            setDiagram(data);
          }
        })
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [token]);

  // Refresh comments when panel opens
  const handleCommentPanelOpen = useCallback(() => {
    setCommentPanelOpen(true);
    if (diagram?.id) {
      void refreshComments();
    }
  }, [diagram?.id, refreshComments]);

  const handleExportPNG = async () => {
    if (diagram) {
      await exportToPNG(diagram.code, diagram.title);
    }
  };

  const handleExportSVG = async () => {
    if (diagram) {
      await exportToSVG(diagram.code, diagram.title);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!diagram) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Diagram not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <AppBar
        position="static"
        color="default"
        elevation={0}
        sx={{
          bgcolor: "white",
          borderBottom: "1px solid #e5e7eb"
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, md: 64 },
            gap: isMobile ? 0.5 : 1,
            px: { xs: 1, md: 2 }
          }}
        >
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              fontSize: { xs: "0.95rem", md: "1.25rem" },
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: "text.primary"
            }}
          >
            {diagram?.title || "Shared Diagram"}
          </Typography>

          {isMobile ? (
            <>
              <IconButton
                onClick={() => setDetailsOpen((prev) => !prev)}
                title={detailsOpen ? "Hide Details" : "Show Details"}
                color="primary"
                size="small"
              >
                <ExpandMore
                  fontSize="small"
                  sx={{
                    transform: detailsOpen ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 0.2s"
                  }}
                />
              </IconButton>
              <IconButton
                onClick={handleExportPNG}
                title="Export PNG"
                color="primary"
                size="small"
              >
                <ImageIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleExportSVG}
                title="Export SVG"
                color="primary"
                size="small"
              >
                <GetApp fontSize="small" />
              </IconButton>
              <IconButton
                onClick={() => setIsCommentMode(!isCommentMode)}
                title={isCommentMode ? "Exit Comment Mode" : "Comment Mode"}
                color={isCommentMode ? "secondary" : "primary"}
                size="small"
              >
                <Comment fontSize="small" />
              </IconButton>
            </>
          ) : (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <Button
                variant="text"
                endIcon={
                  <ExpandMore
                    sx={{
                      transform: detailsOpen ? "rotate(180deg)" : "rotate(0)",
                      transition: "transform 0.2s"
                    }}
                  />
                }
                onClick={() => setDetailsOpen((prev) => !prev)}
              >
                {detailsOpen ? "Hide Details" : "Show Details"}
              </Button>
              <Button
                variant="text"
                startIcon={<ImageIcon />}
                onClick={handleExportPNG}
              >
                Export PNG
              </Button>
              <Button
                variant="text"
                startIcon={<GetApp />}
                onClick={handleExportSVG}
              >
                Export SVG
              </Button>
              <Button
                variant={isCommentMode ? "contained" : "outlined"}
                startIcon={<Comment />}
                onClick={() => setIsCommentMode(!isCommentMode)}
              >
                {isCommentMode ? "Commenting" : "Comments"}
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, position: "relative", bgcolor: "background.default" }}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: { xs: 1, md: 4 },
            py: { xs: 2, md: 4 },
          }}
        >
          <MermaidRenderer
            code={diagram.code}
            comments={comments}
            threadedComments={threadedComments}
            selectedCommentId={selectedCommentId}
            isCommentMode={isCommentMode}
            onCommentClick={(commentId) => {
              setSelectedCommentId(commentId);
              handleCommentPanelOpen();
            }}
            onDiagramClick={async () => {
              // Handle diagram click for adding comments
            }}
            diagramId={diagram?.id}
            onCreateComment={createComment}
            currentUserId={session?.user?.id}
          />
        </Box>
        {detailsOpen && (
          <Box
            sx={{
              position: "absolute",
              top: { xs: 12, md: 24 },
              left: { xs: 12, md: 24 },
              bgcolor: "rgba(255,255,255,0.95)",
              borderRadius: 2,
              boxShadow: 4,
              p: 2,
              width: { xs: "calc(100% - 24px)", md: 320 },
            }}
          >
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>
                  Shared diagram
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {diagram.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Anyone with this link can view the diagram and export it.
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setDetailsOpen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>
        )}
      </Box>

      {/* Comment Panel - Reusing the exact same component from editor */}
      <CommentPanel
        comments={comments}
        threadedComments={threadedComments}
        selectedCommentId={selectedCommentId}
        isOpen={commentPanelOpen}
        onClose={() => setCommentPanelOpen(false)}
        onSelectComment={setSelectedCommentId}
        onEditComment={async (commentId, data) => {
          await updateComment(commentId, data);
        }}
        onDeleteComment={async (commentId) => {
          if (confirm("Are you sure you want to delete this comment?")) {
            await deleteComment(commentId);
            if (selectedCommentId === commentId) {
              setSelectedCommentId(null);
              setCommentPanelOpen(false);
            }
          }
        }}
        onToggleResolved={async (commentId) => {
          await toggleResolved(commentId);
        }}
        onCreateComment={createComment}
        currentUserId={session?.user?.id}
        diagramId={diagram?.id}
      />
    </Box >
  );
}
