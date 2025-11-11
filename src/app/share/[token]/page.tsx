"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  Tooltip,
} from "@mui/material";
import {
  GetApp,
  ExpandMore,
  Close as CloseIcon,
  Image as ImageIcon,
  Comment,
  Login,
} from "@mui/icons-material";
import MermaidRenderer from "@/components/MermaidRenderer";
import CommentPanel from "@/components/comments/CommentPanel";
import { useComments } from "@/components/comments/useComments";
import { exportToPNG, exportToSVG } from "@/lib/export";
import { useWebSocket } from "@/hooks/useWebSocket";
import { UserPresence } from "@/components/realtime/UserPresence";
import { LiveCursors } from "@/components/realtime/LiveCursors";

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const { data: session } = useSession();
  const [diagram, setDiagram] = useState<{
    id: string;
    title: string;
    code: string;
    anonymousMode: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Comment-related state - reusing the same pattern from editor
  const [isCommentMode, setIsCommentMode] = useState(false);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

  // WebSocket integration for real-time collaboration
  const {
    isConnected,
    connectedUsers,
    cursors,
    lastCodeChange,
    lastCommentEvent,
    sendCommentCreated,
    sendCommentUpdated,
    sendCommentDeleted,
    sendCommentResolved,
  } = useWebSocket(diagram?.id || null, diagram?.anonymousMode || false);

  // WebSocket comment broadcast callbacks - use useCallback with empty deps since sendCommentXXX use refs internally
  const handleCommentCreated = useCallback((comment: unknown) => {
    sendCommentCreated({
      commentId: (comment as { id: string }).id,
      comment
    });
  }, [sendCommentCreated]);

  const handleCommentUpdated = useCallback((comment: unknown) => {
    sendCommentUpdated({
      commentId: (comment as { id: string }).id,
      comment
    });
  }, [sendCommentUpdated]);

  const handleCommentDeleted = useCallback((commentId: string) => {
    sendCommentDeleted({ commentId });
  }, [sendCommentDeleted]);

  const handleCommentResolved = useCallback((commentId: string, isResolved: boolean) => {
    sendCommentResolved({ commentId, isResolved });
  }, [sendCommentResolved]);

  // Initialize comments hook with WebSocket broadcast - only when we have a diagram ID
  const {
    comments,
    threadedComments,
    createComment,
    updateComment,
    deleteComment,
    toggleResolved,
    refreshComments,
  } = useComments({
    diagramId: diagram?.id || "",
    onCommentCreated: handleCommentCreated,
    onCommentUpdated: handleCommentUpdated,
    onCommentDeleted: handleCommentDeleted,
    onCommentResolved: handleCommentResolved,
  });


  // Compute the active code (realtime or original)
  const activeCode = useMemo(() => {
    if (lastCodeChange && lastCodeChange.userId !== session?.user?.id) {
      return lastCodeChange.code;
    }
    return diagram?.code || "";
  }, [lastCodeChange, session?.user?.id, diagram?.code]);

  const editorRef = useRef<HTMLElement | null>(null);

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

  // Listen for incoming comment events from WebSocket
  useEffect(() => {
    if (lastCommentEvent && lastCommentEvent.userId !== session?.user?.id) {
      // Only refresh if the event is from another user
      void refreshComments();
    }
  }, [lastCommentEvent, session?.user?.id, refreshComments]);

  // Refresh comments when panel opens
  const handleCommentPanelOpen = useCallback(() => {
    setCommentPanelOpen(true);
    if (diagram?.id) {
      void refreshComments();
    }
  }, [diagram?.id, refreshComments]);

  const handleCommentModeToggle = () => {
    // Allow commenting if user is logged in OR if diagram is in anonymous mode
    if (!session && !diagram?.anonymousMode) {
      // User is not logged in and diagram is not in anonymous mode, redirect to login
      const currentUrl = window.location.href;
      window.location.href = `/login?callbackUrl=${encodeURIComponent(currentUrl)}`;
      return;
    }
    setIsCommentMode(!isCommentMode);
  };

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

  const commentButtonTitle = session
    ? (isCommentMode ? "Exit Comment Mode" : "Comment Mode")
    : diagram?.anonymousMode
      ? (isCommentMode ? "Exit Comment Mode" : "Comment Mode")
      : "Login to enable comments";

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
              <Tooltip title={commentButtonTitle}>
                <span>
                  <IconButton
                    onClick={handleCommentModeToggle}
                    title={commentButtonTitle}
                    color={isCommentMode ? "secondary" : "primary"}
                    size="small"
                  >
                    {session || diagram?.anonymousMode ? <Comment fontSize="small" /> : <Login fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
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
              <Tooltip title={commentButtonTitle}>
                <span>
                  <Button
                    variant={isCommentMode ? "contained" : "outlined"}
                    startIcon={session || diagram?.anonymousMode ? <Comment /> : <Login />}
                    onClick={handleCommentModeToggle}
                  >
                    {session ? (isCommentMode ? "Commenting" : "Comments") : diagram?.anonymousMode ? (isCommentMode ? "Commenting" : "Comments") : "Login to Comment"}
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, position: "relative", bgcolor: "background.default" }}>
        {/* User Presence Indicator - positioned below zoom toolbar */}
        {isConnected && connectedUsers.size > 0 && (
          <Box sx={{ position: "absolute", top: { xs: 70, md: 90 }, right: { xs: 15, md: 40 }, zIndex: 1000 }}>
            <UserPresence
              users={connectedUsers}
              currentUserId={session?.user?.id}
              anonymousMode={diagram?.anonymousMode}
            />
          </Box>
        )}

        {/* Live Cursors Overlay */}
        <LiveCursors
          cursors={cursors}
          users={connectedUsers}
          currentUserId={session?.user?.id}
          editorRef={editorRef}
          anonymousMode={diagram?.anonymousMode}
        />

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
            code={activeCode}
            comments={comments}
            threadedComments={threadedComments}
            selectedCommentId={selectedCommentId}
            isCommentMode={isCommentMode && (!!session || diagram?.anonymousMode)}
            onCommentClick={(commentId) => {
              if (session || diagram?.anonymousMode) {
                setSelectedCommentId(commentId);
                handleCommentPanelOpen();
              }
            }}
            onDiagramClick={async () => {
              // Handle diagram click for adding comments
            }}
            diagramId={diagram?.id}
            onCreateComment={createComment}
            currentUserId={session?.user?.id}
            anonymousMode={diagram?.anonymousMode}
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
                  {diagram?.anonymousMode && " Anonymous commenting is enabled."}
                </Typography>
                {!session && !diagram?.anonymousMode && (
                  <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                    <a href={`/login?callbackUrl=${encodeURIComponent(window.location.href)}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                      Login to enable commenting features
                    </a>
                  </Typography>
                )}
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
        anonymousMode={diagram?.anonymousMode}
      />
    </Box >
  );
}
