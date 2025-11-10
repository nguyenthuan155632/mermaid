"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import mermaid from "mermaid";
import {
  Box,
  IconButton,
  Dialog,
  DialogContent,
  Alert,
} from "@mui/material";
import {
  ZoomIn,
  ZoomOut,
  FitScreen,
  Fullscreen,
  FullscreenExit,
  Comment as CommentIcon,
} from "@mui/icons-material";
import CommentOverlay from "./comments/CommentOverlay";
import CommentPopup from "./comments/CommentPopup";
import { CommentWithUser, ThreadedComment } from "./comments/types";
import { useComments } from "./comments/useComments";
import { useWebSocket } from "@/hooks/useWebSocket";

interface MermaidRendererProps {
  code: string;
  onError?: (error: string) => void;
  onSuccess?: () => void;
  disableInteractions?: boolean;
  initialZoom?: number;
  // Comment-related props
  comments?: CommentWithUser[];
  threadedComments?: ThreadedComment[];
  selectedCommentId?: string | null;
  onCommentClick?: (commentId: string) => void;
  onDiagramClick?: (position: { x: number; y: number }) => void;
  isCommentMode?: boolean;
  onToggleCommentMode?: () => void;
  diagramId?: string;
  onCreateComment?: (data: { content: string; positionX: number; positionY: number }) => Promise<void>;
  currentUserId?: string;
}

const MERMAID_ERROR_PATTERNS = [/syntax error in text/i, /mermaid version/i];

export default function MermaidRenderer({
  code,
  onError,
  onSuccess,
  disableInteractions = false,
  initialZoom,
  comments = [],
  threadedComments = [],
  selectedCommentId = null,
  onCommentClick,
  onDiagramClick,
  isCommentMode = false,
  onToggleCommentMode,
  diagramId,
  onCreateComment,
  currentUserId,
}: MermaidRendererProps) {
  const { data: session } = useSession();

  // WebSocket hook for real-time comment synchronization (initialize first to get callbacks)
  const {
    sendCommentPosition,
    commentPositions,
    lastCommentEvent,
    sendCommentCreated,
    sendCommentUpdated,
    sendCommentDeleted,
    sendCommentResolved,
  } = useWebSocket(diagramId || null);

  // Use the comments hook for real functionality with WebSocket callbacks
  const commentsHook = useComments({
    diagramId: diagramId || "",
    onCommentCreated: (comment) => {
      console.log('[MermaidRenderer] onCommentCreated callback triggered:', comment.id);
      sendCommentCreated({ commentId: comment.id, comment });
    },
    onCommentUpdated: (comment) => {
      console.log('[MermaidRenderer] onCommentUpdated callback triggered:', comment.id);
      sendCommentUpdated({ commentId: comment.id, comment });
    },
    onCommentDeleted: (commentId) => {
      console.log('[MermaidRenderer] onCommentDeleted callback triggered:', commentId);
      sendCommentDeleted({ commentId });
    },
    onCommentResolved: (commentId, isResolved) => {
      console.log('[MermaidRenderer] onCommentResolved callback triggered:', commentId, isResolved);
      sendCommentResolved({ commentId, isResolved });
    },
  });
  const {
    comments: hookComments,
    threadedComments: hookThreadedComments,
    createComment: hookCreateComment,
    updateComment: hookUpdateComment,
    deleteComment: hookDeleteComment,
    toggleResolved: hookToggleResolved,
    refreshComments,
  } = commentsHook;

  // Use hook data if available, otherwise fall back to props
  const actualComments = diagramId ? hookComments : comments;
  const actualThreadedComments = diagramId ? hookThreadedComments : threadedComments;
  const actualCreateComment = diagramId ? hookCreateComment : onCreateComment;
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const lastCalculatedSvg = useRef<string>("");
  const isCalculatingRef = useRef(false);
  const updateUrlTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Touch gesture state
  const isPinchingRef = useRef(false);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const pinchLastCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchLastDistanceRef = useRef(0);
  const MOBILE_PINCH_GAIN = 1.5;

  // Helper to get zoom from URL (used during initialization)
  const getInitialZoomFromUrl = (): number | null => {
    const zoomParam = searchParams.get("zoom");
    if (!zoomParam) return null;
    const zoomValue = parseFloat(zoomParam);
    if (isNaN(zoomValue) || zoomValue < 0.3 || zoomValue > 10) return null;
    return zoomValue;
  };

  // Helper to get pan from URL (used during initialization)
  const getInitialPanFromUrl = (): { x: number; y: number } | null => {
    const panParam = searchParams.get("pan");
    if (!panParam) return null;
    const parts = panParam.split("_");
    if (parts.length !== 2) return null;
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (isNaN(x) || isNaN(y)) return null;
    return { x, y };
  };

  // Initialize state from URL if available, otherwise use defaults
  const initialUrlZoom = disableInteractions ? null : getInitialZoomFromUrl();
  const initialUrlPan = disableInteractions ? null : getInitialPanFromUrl();
  const hasUrlParams = useRef(disableInteractions ? true : initialUrlZoom !== null);

  const [error, setError] = useState<string | null>(null);
  const resolvedInitialZoom =
    typeof initialZoom === "number"
      ? initialZoom
      : disableInteractions
        ? 1
        : initialUrlZoom ?? 1;
  const [zoom, setZoom] = useState(resolvedInitialZoom);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [svgContent, setSvgContent] = useState<string>("");
  const [pan, setPan] = useState(initialUrlPan ?? { x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [, setFittedZoom] = useState(resolvedInitialZoom);
  const [isCalculatingZoom, setIsCalculatingZoom] = useState(false);
  const [popupComment, setPopupComment] = useState<{
    comment: CommentWithUser;
    threadedComment?: ThreadedComment;
    position: { x: number; y: number };
  } | null>(null);
  const handlePopupDrag = useCallback((clientPosition: { x: number; y: number }) => {
    setPopupComment((prev) =>
      prev ? { ...prev, position: clientPosition } : prev
    );
  }, []);

  const handlePopupDragEnd = useCallback(async (clientPosition: { x: number; y: number }) => {
    setPopupComment((prev) =>
      prev ? { ...prev, position: clientPosition } : prev
    );

    if (!diagramId || !popupComment) {
      return;
    }

    const containerRect = diagramContainerRef.current?.getBoundingClientRect();
    if (!containerRect) {
      return;
    }

    const containerCenterX = containerRect.left + containerRect.width / 2;
    const containerCenterY = containerRect.top + containerRect.height / 2;
    const nextPositionX = (clientPosition.x - containerCenterX - pan.x) / zoom;
    const nextPositionY = (clientPosition.y - containerCenterY - pan.y) / zoom;

    const commentToUpdate = actualComments.find(
      (c) => c.id === popupComment.comment.id
    );

    if (!commentToUpdate) {
      return;
    }

    try {
      await hookUpdateComment(popupComment.comment.id, {
        content: commentToUpdate.content,
        positionX: nextPositionX,
        positionY: nextPositionY,
      });
    } catch (err) {
      console.error("Failed to move comment:", err);
    }
  }, [diagramId, popupComment, pan.x, pan.y, zoom, actualComments, hookUpdateComment]);

  const handleIndicatorDragEnd = useCallback(async (commentId: string, position: { x: number; y: number }) => {
    if (!diagramId) {
      return;
    }
    const comment = actualComments.find((c) => c.id === commentId);
    if (!comment) {
      return;
    }

    try {
      // Only send position update (allows all users to drag comments for collaboration)
      await hookUpdateComment(commentId, {
        positionX: position.x,
        positionY: position.y,
      });

      // Send real-time update to other users
      sendCommentPosition({
        commentId,
        x: position.x,
        y: position.y,
      });
    } catch (error) {
      console.error("Failed to move comment:", error);
    }
  }, [actualComments, diagramId, hookUpdateComment, sendCommentPosition]);

  const findThreadRootForComment = useCallback(
    (commentId: string): ThreadedComment | null => {
      for (const rootComment of actualThreadedComments) {
        if (rootComment.id === commentId) {
          return rootComment;
        }

        const stack = [...rootComment.replies];
        while (stack.length > 0) {
          const current = stack.pop();
          if (!current) continue;

          if (current.id === commentId) {
            return rootComment;
          }

          if (current.replies.length) {
            stack.push(...current.replies);
          }
        }
      }

      return null;
    },
    [actualThreadedComments]
  );

  const openPopupForComment = useCallback(
    (commentId: string) => {
      const comment = actualComments.find((c) => c.id === commentId);
      if (!comment) {
        return;
      }

      const containerRect = diagramContainerRef.current?.getBoundingClientRect();
      if (!containerRect) {
        return;
      }

      const containerCenterX = containerRect.left + containerRect.width / 2;
      const containerCenterY = containerRect.top + containerRect.height / 2;

      const transformedX = containerCenterX + comment.positionX * zoom + pan.x;
      const transformedY = containerCenterY + comment.positionY * zoom + pan.y;

      setPopupComment({
        comment,
        threadedComment: findThreadRootForComment(commentId) ?? undefined,
        position: { x: transformedX, y: transformedY },
      });
    },
    [actualComments, findThreadRootForComment, pan, zoom]
  );

  // Update popup comment data when comments change
  useEffect(() => {
    if (popupComment) {
      const updatedComment = actualComments.find((c) => c.id === popupComment.comment.id);
      const updatedThreadedComment = findThreadRootForComment(popupComment.comment.id);

      if (updatedComment || updatedThreadedComment) {
        setPopupComment(prev => prev ? {
          ...prev,
          comment: updatedComment || prev.comment,
          threadedComment: updatedThreadedComment ?? prev.threadedComment,
        } : null);
      }
    }
    // We only depend on popupComment?.comment.id, not the full popupComment object to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualComments, actualThreadedComments, popupComment?.comment.id, findThreadRootForComment]);

  // Listen for incoming comment events from WebSocket to refresh comments from other users
  useEffect(() => {
    if (!diagramId) return;

    if (lastCommentEvent && lastCommentEvent.userId !== session?.user?.id) {
      // Only refresh if the event is from another user
      console.log(`[MermaidRenderer] Received ${lastCommentEvent.type} event for comment ${lastCommentEvent.event.commentId} from user ${lastCommentEvent.userId}`);
      void refreshComments();
    }
  }, [lastCommentEvent, session?.user?.id, refreshComments, diagramId]);

  // Merge WebSocket comment positions into threaded comments for real-time updates
  const threadedCommentsWithPositions = useMemo(() => {
    const positionKeys = Object.keys(commentPositions);
    if (positionKeys.length === 0) {
      return actualThreadedComments;
    }

    const mergePositions = (thread: ThreadedComment): ThreadedComment => {
      const wsPosition = commentPositions[thread.id];
      if (wsPosition) {
        // Always use WebSocket position if available (it's the latest from other users)
        return {
          ...thread,
          positionX: wsPosition.x,
          positionY: wsPosition.y,
          replies: thread.replies.map(mergePositions),
        };
      }
      return {
        ...thread,
        replies: thread.replies.map(mergePositions),
      };
    };

    return actualThreadedComments.map(mergePositions);
  }, [actualThreadedComments, commentPositions]);

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // URL parameter update utility


  const updateUrlParams = useCallback(
    (newZoom: number, newPan: { x: number; y: number }) => {
      if (disableInteractions) return;

      // Validate inputs before updating URL
      if (isNaN(newZoom) || newZoom < 0.3 || newZoom > 10) return;
      if (isNaN(newPan.x) || isNaN(newPan.y)) return;

      // Debounce URL updates to avoid excessive history entries
      if (updateUrlTimeoutRef.current) {
        clearTimeout(updateUrlTimeoutRef.current);
      }

      updateUrlTimeoutRef.current = setTimeout(() => {
        try {
          const params = new URLSearchParams(window.location.search);

          // Round zoom to 2 decimal places for cleaner URLs
          params.set("zoom", newZoom.toFixed(2));

          // Round pan values to integers for cleaner URLs
          params.set("pan", `${Math.round(newPan.x)}_${Math.round(newPan.y)}`);

          // Use replaceState to avoid creating too many history entries
          const newUrl = `${window.location.pathname}?${params.toString()}`;
          window.history.replaceState({}, "", newUrl);
        } catch {
          // Silently fail if URL update fails (e.g., in environments without history API)
        }
      }, 500); // 500ms debounce
    },
    [disableInteractions]
  );

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
    });
  }, []);

  // Add wheel event listener with passive: false to enable preventDefault
  useEffect(() => {
    if (disableInteractions) return;

    const container = diagramContainerRef.current;
    const fullscreenContainer = fullscreenContainerRef.current;

    const wheelHandler = (e: WheelEvent) => {
      // Detect pinch-to-zoom gesture (Ctrl key is set during trackpad pinch on most browsers)
      // Also allow regular mouse wheel with Ctrl key for zoom
      const isPinchOrCtrlZoom = e.ctrlKey || e.metaKey;

      if (isPinchOrCtrlZoom) {
        // This is a pinch-to-zoom gesture or Ctrl+wheel - zoom the diagram
        e.preventDefault();
        e.stopPropagation();

        // Increased sensitivity for more responsive zoom (3x faster: 0.03)
        const delta = e.deltaY * -0.03;
        setZoom((prevZoom) => Math.min(Math.max(prevZoom + delta, 0.3), 10));
      } else {
        // This is a regular scroll - pan the diagram
        e.preventDefault();
        e.stopPropagation();

        // Pan the diagram based on scroll direction
        setPan((prevPan) => ({
          x: prevPan.x - e.deltaX,
          y: prevPan.y - e.deltaY,
        }));
      }
    };

    // Use passive: false to allow preventDefault
    if (container) {
      container.addEventListener("wheel", wheelHandler, { passive: false });
    }
    if (fullscreenContainer) {
      fullscreenContainer.addEventListener("wheel", wheelHandler, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener("wheel", wheelHandler);
      }
      if (fullscreenContainer) {
        fullscreenContainer.removeEventListener("wheel", wheelHandler);
      }
    };
  }, [disableInteractions, isFullscreen, svgContent]);

  // Touch gestures: pinch-to-zoom and one-finger pan (mobile devices)
  useEffect(() => {
    if (disableInteractions) return;

    const container = diagramContainerRef.current;
    const fullscreenContainer = fullscreenContainerRef.current;

    const getTouchDistance = (e: TouchEvent) => {
      if (e.touches.length < 2) return 0;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    };
    const getTouchCenter = (e: TouchEvent) => {
      if (e.touches.length < 2) return { x: 0, y: 0 };
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    };

    const touchStart = (e: TouchEvent) => {
      const touches = e.touches;
      if (touches.length === 2) {
        // Two-finger gesture - determine if it's pinch or drag
        const distance = getTouchDistance(e);
        const center = getTouchCenter(e);

        // Initialize gesture state
        isPinchingRef.current = true;
        setIsPinching(true);
        pinchStartDistanceRef.current = distance;
        pinchLastDistanceRef.current = distance;
        pinchStartZoomRef.current = zoom;
        pinchLastCenterRef.current = center;

        // Also enable panning for two-finger drag gestures
        setIsPanning(true);
        setPanStart({ x: center.x - pan.x, y: center.y - pan.y });

        e.preventDefault();
        e.stopPropagation();
      } else if (touches.length === 1) {
        // Single-finger pan (no zoom restriction)
        const t = touches[0];
        setIsPanning(true);
        setPanStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const touchMove = (e: TouchEvent) => {
      const touches = e.touches;
      if (touches.length === 2 && isPinchingRef.current) {
        // Two-finger gesture - handle both zoom and pan
        const distance = getTouchDistance(e);
        const center = getTouchCenter(e);
        const target = fullscreenContainer || container;

        if (target && pinchLastDistanceRef.current > 0) {
          const rect = target.getBoundingClientRect();
          const containerCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

          // Handle zoom if distance is changing significantly (pinch gesture)
          const distanceChange = Math.abs(distance - pinchLastDistanceRef.current);
          const isPinchGesture = distanceChange > 5; // Threshold to detect pinch vs drag

          if (isPinchGesture) {
            // Two-finger pinch to zoom
            const ratio = distance / pinchLastDistanceRef.current;
            const k = MOBILE_PINCH_GAIN;

            setZoom((prevZoom) => {
              const nextZoom = Math.min(Math.max(prevZoom * Math.pow(ratio, k), 0.3), 10);

              // Zoom towards the pinch center point
              const ax = center.x - containerCenter.x;
              const ay = center.y - containerCenter.y;
              setPan((prevPan) => ({
                x: prevPan.x + ax - (nextZoom / prevZoom) * ax,
                y: prevPan.y + ay - (nextZoom / prevZoom) * ay,
              }));

              return nextZoom;
            });
          } else {
            // Two-finger drag to pan
            setPan({ x: center.x - panStart.x, y: center.y - panStart.y });
          }
        }
        pinchLastDistanceRef.current = distance;
        pinchLastCenterRef.current = center;
        e.preventDefault();
        e.stopPropagation();
      } else if (touches.length === 1 && isPanning) {
        // Single-finger pan
        const t = touches[0];
        setPan({ x: t.clientX - panStart.x, y: t.clientY - panStart.y });
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const touchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
        setIsPinching(false);
      }
      if (e.touches.length === 0) {
        setIsPanning(false);
      }
    };

    const opts: AddEventListenerOptions = { passive: false };

    const targets = [container, fullscreenContainer].filter(Boolean) as HTMLDivElement[];
    targets.forEach((el) => {
      el.addEventListener("touchstart", touchStart, opts);
      el.addEventListener("touchmove", touchMove, opts);
      el.addEventListener("touchend", touchEnd, opts);
      el.addEventListener("touchcancel", touchEnd, opts);
    });

    return () => {
      targets.forEach((el) => {
        el.removeEventListener("touchstart", touchStart);
        el.removeEventListener("touchmove", touchMove);
        el.removeEventListener("touchend", touchEnd);
        el.removeEventListener("touchcancel", touchEnd);
      });
    };
  }, [disableInteractions, isFullscreen, svgContent, zoom, pan, panStart, isPanning]);

  useEffect(() => {
    if (!code.trim()) {
      // We intentionally reset derived state synchronously when the editor is empty.
      setError(null);
      setSvgContent("");
      setIsCalculatingZoom(false);
      lastCalculatedSvg.current = "";
      isCalculatingRef.current = false;
      return;
    }

    const renderDiagram = async () => {
      try {
        setError(null);
        // Only set calculating flag if we don't have URL params (need auto-fit) and interactions enabled
        if (!hasUrlParams.current && !disableInteractions) {
          setIsCalculatingZoom(true);
          isCalculatingRef.current = true;
        } else if (disableInteractions) {
          setIsCalculatingZoom(false);
          isCalculatingRef.current = false;
        }
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);
        if (MERMAID_ERROR_PATTERNS.some((pattern) => pattern.test(svg))) {
          throw new Error("Syntax error in text");
        }
        setSvgContent(svg);
        const successHandler = onSuccessRef.current;
        if (successHandler) successHandler();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to render diagram";
        setError(errorMessage);
        const errorHandler = onErrorRef.current;
        if (errorHandler) errorHandler(errorMessage);
        setSvgContent("");
        setIsCalculatingZoom(false);
        isCalculatingRef.current = false;
      }
    };

    renderDiagram();
    // Dependencies include callbacks/flags that affect render behaviour.
  }, [code, disableInteractions]);

  // Calculate optimal zoom to fit diagram in viewport
  const calculateFitZoom = () => {
    const container = diagramContainerRef.current || fullscreenContainerRef.current;
    const svgElement = containerRef.current?.querySelector("svg");

    if (!container || !svgElement) {
      return 1;
    }

    const containerRect = container.getBoundingClientRect();

    // Get SVG's intrinsic dimensions (not affected by current zoom)
    let svgWidth = 0;
    let svgHeight = 0;

    // Try to get dimensions from viewBox first (most reliable)
    const viewBox = svgElement.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/\s+/);
      svgWidth = parseFloat(parts[2]);
      svgHeight = parseFloat(parts[3]);
    } else {
      // Fallback to width/height attributes
      const widthAttr = svgElement.getAttribute("width");
      const heightAttr = svgElement.getAttribute("height");
      svgWidth = parseFloat(widthAttr || "0");
      svgHeight = parseFloat(heightAttr || "0");
    }

    // If we still don't have dimensions, try getBBox (unscaled bounding box)
    if (svgWidth === 0 || svgHeight === 0) {
      try {
        const bbox = svgElement.getBBox();
        svgWidth = bbox.width;
        svgHeight = bbox.height;
      } catch {
        // getBBox can fail in some cases, return default zoom
        return 1;
      }
    }

    if (svgWidth === 0 || svgHeight === 0) {
      return 1;
    }

    // Calculate zoom to fit the diagram to the container
    // Use 100% to maximize space usage (no margin)
    const scaleX = containerRect.width / svgWidth;
    const scaleY = containerRect.height / svgHeight;

    // For wide diagrams (width > height), prioritize height to make them more readable
    // For tall diagrams, use the smaller scale to fit both dimensions
    const aspectRatio = svgWidth / svgHeight;
    let fitZoom;

    if (aspectRatio > 2) {
      // Wide diagram (like flowcharts) - prioritize height for better readability
      // This allows horizontal scrolling but makes the diagram taller and more readable
      fitZoom = scaleY;
    } else {
      // Normal or tall diagram - fit to both dimensions
      fitZoom = Math.min(scaleX, scaleY);
    }

    // Clamp between min and max zoom levels
    return Math.min(Math.max(fitZoom, 0.3), 10);
  };

  // Calculate and apply initial fit-to-viewport zoom after diagram renders
  useEffect(() => {
    if (disableInteractions) return;

    // Skip if we have URL parameters - zoom is already set from URL
    if (hasUrlParams.current) {
      // Just mark as calculated and hide the loading state
      if (svgContent && lastCalculatedSvg.current !== svgContent) {
        lastCalculatedSvg.current = svgContent;
        setIsCalculatingZoom(false);
      }
      return;
    }

    // Only calculate if we have new SVG content and haven't calculated for this SVG yet
    if (!svgContent || error || !isCalculatingRef.current) return;
    if (lastCalculatedSvg.current === svgContent) return;

    // Use requestAnimationFrame to ensure DOM is updated
    const rafId = requestAnimationFrame(() => {
      // Double RAF to ensure layout is complete
      requestAnimationFrame(() => {
        // Check again to prevent race conditions
        if (!isCalculatingRef.current || lastCalculatedSvg.current === svgContent) {
          return;
        }

        const fitZoom = calculateFitZoom();

        // Only update if we got a valid zoom value and it's different
        if (fitZoom && fitZoom > 0) {
          setFittedZoom(fitZoom);
          setZoom(fitZoom);
          setPan({ x: 0, y: 0 });

          // Update URL with initial auto-fit values
          updateUrlParams(fitZoom, { x: 0, y: 0 });
        }

        // Mark this SVG as calculated
        lastCalculatedSvg.current = svgContent;
        isCalculatingRef.current = false;
        setIsCalculatingZoom(false);
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [disableInteractions, svgContent, error, updateUrlParams]);

  // Update URL when zoom or pan changes (debounced)
  useEffect(() => {
    if (disableInteractions) return;

    // Don't update URL during initial calculation
    if (isCalculatingZoom || !svgContent) return;

    // Don't update URL on first render if we loaded from URL
    // This prevents overwriting the URL params immediately after loading
    if (hasUrlParams.current && lastCalculatedSvg.current === "") return;

    // Update URL with current zoom and pan
    updateUrlParams(zoom, pan);
  }, [disableInteractions, zoom, pan, isCalculatingZoom, svgContent, updateUrlParams]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateUrlTimeoutRef.current) {
        clearTimeout(updateUrlTimeoutRef.current);
      }
    };
  }, []);

  const handleZoomIn = () => {
    if (disableInteractions) return;
    setZoom((prev) => Math.min(prev + 1.5, 10));
  };

  const handleZoomOut = () => {
    if (disableInteractions) return;
    setZoom((prev) => Math.max(prev - 1.5, 0.3));
  };

  const handleResetZoom = () => {
    if (disableInteractions) return;

    // Recalculate fit zoom based on current container size
    const newFitZoom = calculateFitZoom();

    setZoom(newFitZoom);
    setFittedZoom(newFitZoom); // Update the fitted zoom state
    setPan({ x: 0, y: 0 });
  };

  // Handle panning
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disableInteractions) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disableInteractions) return;
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (disableInteractions) return;
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    if (disableInteractions) return;
    setIsPanning(false);
  };

  const handleFullscreen = () => {
    if (disableInteractions) return;
    setIsFullscreen(true);
  };

  const handleExitFullscreen = () => {
    setIsFullscreen(false);
  };

  // Handle sidebar click - only call the original handler
  const handleSidebarClick = (commentId: string) => {
    if (onCommentClick) {
      onCommentClick(commentId);
    }
  };

  // Handle popup click - show popup
  const handlePopupClick = (commentId: string) => {
    openPopupForComment(commentId);
  };

  // Close popup
  const handleClosePopup = () => {
    setPopupComment(null);
  };


  const renderContent = () => (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        bgcolor: "background.paper",
        backgroundImage: "radial-gradient(circle, #f0f0f0 2px, transparent 2px)",
        backgroundSize: "30px 30px",
        p: 2,
      }}
    >
      {!disableInteractions && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            gap: 0.5,
            zIndex: 1,
            bgcolor: "primary.main",
            borderRadius: 1,
            p: 0.5,
            boxShadow: 2,
          }}
        >
          <IconButton
            onClick={handleZoomIn}
            size="small"
            title="Zoom In"
            sx={{ color: "white" }}
          >
            <ZoomIn fontSize="small" />
          </IconButton>
          <IconButton
            onClick={handleZoomOut}
            size="small"
            title="Zoom Out"
            sx={{ color: "white" }}
          >
            <ZoomOut fontSize="small" />
          </IconButton>
          <IconButton
            onClick={handleResetZoom}
            size="small"
            title="Fit to Screen"
            sx={{ color: "white" }}
          >
            <FitScreen fontSize="small" />
          </IconButton>
          {onToggleCommentMode && (
            <IconButton
              onClick={onToggleCommentMode}
              size="small"
              title={isCommentMode ? "Exit Comment Mode" : "Comment Mode"}
              sx={{
                color: "white",
                bgcolor: isCommentMode ? "secondary.main" : "transparent"
              }}
            >
              <CommentIcon fontSize="small" />
            </IconButton>
          )}
          {!isFullscreen && (
            <IconButton
              onClick={handleFullscreen}
              size="small"
              title="Fullscreen"
              sx={{ color: "white" }}
            >
              <Fullscreen fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}

      {error ? (
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <strong>Syntax Error:</strong> {error}
        </Alert>
      ) : svgContent ? (
        <Box
          ref={diagramContainerRef}
          onMouseDown={disableInteractions ? undefined : handleMouseDown}
          onMouseMove={disableInteractions ? undefined : handleMouseMove}
          onMouseUp={disableInteractions ? undefined : handleMouseUp}
          onMouseLeave={disableInteractions ? undefined : handleMouseLeave}
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: disableInteractions
              ? "default"
              : isPanning
                ? "grabbing"
                : "grab",
            userSelect: disableInteractions ? "auto" : "none",
            touchAction: disableInteractions ? "auto" : "none",
          }}
        >
          <Box
            ref={containerRef}
            sx={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: "center",
              transition: (isPanning || isPinching) ? "none" : "transform 0.2s",
              opacity: isCalculatingZoom ? 0 : 1,
              visibility: isCalculatingZoom ? "hidden" : "visible",
              pointerEvents: disableInteractions ? "auto" : "none",
              "& svg": {
                pointerEvents: disableInteractions ? "auto" : "none",
              },
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </Box>
      ) : (
        <Box sx={{ color: "text.secondary" }}>Enter Mermaid code to preview</Box>
      )}
    </Box>
  );

  return (
    <>
      <Box sx={{ width: "100%", height: "100%", position: "relative" }}>
        {renderContent()}
        {/* Comment Overlay */}
        <CommentOverlay
          comments={actualComments}
          threadedComments={threadedCommentsWithPositions}
          selectedCommentId={selectedCommentId}
          zoom={zoom}
          pan={pan}
          onCommentClick={handleSidebarClick}
          onDiagramClick={onDiagramClick || (() => { })}
          isCommentMode={isCommentMode}
          diagramId={diagramId || ""}
          isPinching={isPinching}
          isPanning={isPanning}
          onCreateComment={actualCreateComment || (async () => { })}
          onPopupClick={handlePopupClick}
          onUpdateCommentPosition={handleIndicatorDragEnd}
        />
      </Box>
      <Dialog
        open={isFullscreen}
        onClose={handleExitFullscreen}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: "background.paper",
          },
        }}
      >
        <DialogContent sx={{ p: 0, height: "100%" }}>
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "hidden",
            }}
          >
            {!disableInteractions && (
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  display: "flex",
                  gap: 0.5,
                  zIndex: 1,
                  bgcolor: "primary.main",
                  borderRadius: 1,
                  p: 0.5,
                  boxShadow: 2,
                }}
              >
                <IconButton
                  onClick={handleZoomIn}
                  size="small"
                  title="Zoom In"
                  sx={{ color: "white" }}
                >
                  <ZoomIn fontSize="small" />
                </IconButton>
                <IconButton
                  onClick={handleZoomOut}
                  size="small"
                  title="Zoom Out"
                  sx={{ color: "white" }}
                >
                  <ZoomOut fontSize="small" />
                </IconButton>
                <IconButton
                  onClick={handleResetZoom}
                  size="small"
                  title="Fit to Screen"
                  sx={{ color: "white" }}
                >
                  <FitScreen fontSize="small" />
                </IconButton>
                <IconButton
                  onClick={handleExitFullscreen}
                  size="small"
                  title="Exit Fullscreen"
                  sx={{ color: "white" }}
                >
                  <FullscreenExit fontSize="small" />
                </IconButton>
              </Box>
            )}
            {error ? (
              <Alert severity="error" sx={{ m: 2 }}>
                <strong>Syntax Error:</strong> {error}
              </Alert>
            ) : svgContent ? (
              <Box
                ref={fullscreenContainerRef}
                onMouseDown={disableInteractions ? undefined : handleMouseDown}
                onMouseMove={disableInteractions ? undefined : handleMouseMove}
                onMouseUp={disableInteractions ? undefined : handleMouseUp}
                onMouseLeave={disableInteractions ? undefined : handleMouseLeave}
                sx={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 2,
                  cursor: disableInteractions
                    ? "default"
                    : isPanning
                      ? "grabbing"
                      : "grab",
                  userSelect: disableInteractions ? "auto" : "none",
                  touchAction: disableInteractions ? "auto" : "none",
                  backgroundImage: "radial-gradient(circle, #f0f0f0 2px, transparent 2px)",
                  backgroundSize: "30px 30px",
                }}
              >
                <Box
                  sx={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: "center",
                    transition: (isPanning || isPinching) ? "none" : "transform 0.2s",
                    opacity: isCalculatingZoom ? 0 : 1,
                    visibility: isCalculatingZoom ? "hidden" : "visible",
                    pointerEvents: disableInteractions ? "auto" : "none",
                    "& svg": {
                      pointerEvents: disableInteractions ? "auto" : "none",
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              </Box>
            ) : null}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Comment Popup */}
      {popupComment && (
        <CommentPopup
          comment={popupComment.comment}
          threadedComment={popupComment.threadedComment}
          position={popupComment.position}
          onClose={handleClosePopup}
          onDelete={async (commentId) => {
            try {
              await hookDeleteComment(commentId);
              handleClosePopup();
            } catch (error) {
              console.error('Failed to delete comment:', error);
            }
          }}
          onToggleResolved={async (commentId) => {
            try {
              await hookToggleResolved(commentId);
            } catch (error) {
              console.error('Failed to toggle resolved:', error);
            }
          }}
          currentUserId={currentUserId}
          // NEW PROPS for Add/Edit/Reply functionality
          onCreateComment={actualCreateComment}
          diagramId={diagramId}
          onUpdateComment={async (commentId: string, data: { content: string }) => {
            try {
              await hookUpdateComment(commentId, data);
            } catch (error) {
              console.error('Failed to update comment:', error);
            }
          }}
          onDrag={handlePopupDrag}
          onDragEnd={handlePopupDragEnd}
        />
      )}
    </>
  );
}
