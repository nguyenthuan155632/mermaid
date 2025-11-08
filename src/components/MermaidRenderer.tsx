"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import mermaid from "mermaid";
import {
  Box,
  IconButton,
  Dialog,
  DialogContent,
  Alert,
  Paper,
} from "@mui/material";
import {
  ZoomIn,
  ZoomOut,
  FitScreen,
  Fullscreen,
  FullscreenExit,
} from "@mui/icons-material";

interface MermaidRendererProps {
  code: string;
  onError?: (error: string) => void;
  onSuccess?: () => void;
  disableInteractions?: boolean;
  initialZoom?: number;
}

export default function MermaidRenderer({
  code,
  onError,
  onSuccess,
  disableInteractions = false,
  initialZoom,
}: MermaidRendererProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const lastCalculatedSvg = useRef<string>("");
  const isCalculatingRef = useRef(false);
  const updateUrlTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [fittedZoom, setFittedZoom] = useState(resolvedInitialZoom);
  const [isCalculatingZoom, setIsCalculatingZoom] = useState(false);

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

        // Preserve the 'id' parameter if it exists
        const currentId = params.get("id");

        // Round zoom to 2 decimal places for cleaner URLs
        params.set("zoom", newZoom.toFixed(2));

        // Round pan values to integers for cleaner URLs
        params.set("pan", `${Math.round(newPan.x)}_${Math.round(newPan.y)}`);

        // Use replaceState to avoid creating too many history entries
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, "", newUrl);
      } catch (error) {
        // Silently fail if URL update fails (e.g., in environments without history API)
        console.warn("Failed to update URL parameters:", error);
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

  useEffect(() => {
    if (!code.trim()) {
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
        setSvgContent(svg);
        if (onSuccess) onSuccess();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to render diagram";
        setError(errorMessage);
        if (onError) onError(errorMessage);
        setSvgContent("");
        setIsCalculatingZoom(false);
        isCalculatingRef.current = false;
      }
    };

    renderDiagram();
  }, [code]); // Removed onError and onSuccess from dependencies

  // Calculate optimal zoom to fit diagram in viewport
  const calculateFitZoom = () => {
    const container = diagramContainerRef.current || fullscreenContainerRef.current;
    const svgElement = containerRef.current?.querySelector("svg");

    if (!container || !svgElement) {
      console.warn("calculateFitZoom: container or SVG element not found");
      return 1;
    }

    const containerRect = container.getBoundingClientRect();

    // Debug: Log container dimensions
    console.log("Container dimensions:", {
      width: containerRect.width,
      height: containerRect.height,
      isFullscreen: !!fullscreenContainerRef.current
    });

    // Get SVG's intrinsic dimensions (not affected by current zoom)
    let svgWidth = 0;
    let svgHeight = 0;

    // Try to get dimensions from viewBox first (most reliable)
    const viewBox = svgElement.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/\s+/);
      svgWidth = parseFloat(parts[2]);
      svgHeight = parseFloat(parts[3]);
      console.log("SVG dimensions from viewBox:", { svgWidth, svgHeight });
    } else {
      // Fallback to width/height attributes
      const widthAttr = svgElement.getAttribute("width");
      const heightAttr = svgElement.getAttribute("height");
      svgWidth = parseFloat(widthAttr || "0");
      svgHeight = parseFloat(heightAttr || "0");
      console.log("SVG dimensions from attributes:", { svgWidth, svgHeight, widthAttr, heightAttr });
    }

    // If we still don't have dimensions, try getBBox (unscaled bounding box)
    if (svgWidth === 0 || svgHeight === 0) {
      try {
        const bbox = svgElement.getBBox();
        svgWidth = bbox.width;
        svgHeight = bbox.height;
        console.log("SVG dimensions from getBBox:", { svgWidth, svgHeight });
      } catch (e) {
        // getBBox can fail in some cases, return default zoom
        console.error("getBBox failed:", e);
        return 1;
      }
    }

    if (svgWidth === 0 || svgHeight === 0) {
      console.warn("Could not determine SVG dimensions");
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
      console.log("Wide diagram detected (aspect ratio:", aspectRatio, ") - using height-based zoom");
    } else {
      // Normal or tall diagram - fit to both dimensions
      fitZoom = Math.min(scaleX, scaleY);
      console.log("Normal diagram (aspect ratio:", aspectRatio, ") - using min(scaleX, scaleY)");
    }

    console.log("Zoom calculation:", {
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
      svgWidth,
      svgHeight,
      aspectRatio: svgWidth / svgHeight,
      scaleX,
      scaleY,
      fitZoom,
      "Using height-based zoom": aspectRatio > 2,
      "Final zoom": fitZoom
    });

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
    setZoom((prev) => Math.min(prev + 0.1, 10));
  };

  const handleZoomOut = () => {
    if (disableInteractions) return;
    setZoom((prev) => Math.max(prev - 0.1, 0.3));
  };

  const handleResetZoom = () => {
    if (disableInteractions) return;
    console.log("=== FIT TO SCREEN CLICKED ===");
    console.log("Current zoom:", zoom);
    console.log("Current fittedZoom:", fittedZoom);

    // Recalculate fit zoom based on current container size
    const newFitZoom = calculateFitZoom();
    console.log("handleResetZoom: calculated new fit zoom:", newFitZoom);
    console.log("=== END FIT TO SCREEN ===");

    setZoom(newFitZoom);
    setFittedZoom(newFitZoom); // Update the fitted zoom state
    setPan({ x: 0, y: 0 });
  };

  // Handle panning
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disableInteractions) return;
    if (zoom > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disableInteractions) return;
    if (isPanning && zoom > 1) {
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
            gap: 1,
            zIndex: 1,
          }}
        >
          <IconButton onClick={handleZoomIn} size="small" title="Zoom In">
            <ZoomIn />
          </IconButton>
          <IconButton onClick={handleZoomOut} size="small" title="Zoom Out">
            <ZoomOut />
          </IconButton>
          <IconButton onClick={handleResetZoom} size="small" title="Fit to Screen">
            <FitScreen />
          </IconButton>
          {!isFullscreen && (
            <IconButton onClick={handleFullscreen} size="small" title="Fullscreen">
              <Fullscreen />
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
                : zoom > 1
                  ? "grab"
                  : "default",
            userSelect: disableInteractions ? "auto" : "none",
          }}
        >
          <Box
            ref={containerRef}
            sx={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: "center",
              transition: isPanning ? "none" : "transform 0.2s",
              opacity: isCalculatingZoom ? 0 : 1,
              visibility: isCalculatingZoom ? "hidden" : "visible",
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
                  gap: 1,
                  zIndex: 1,
                }}
              >
                <IconButton onClick={handleZoomIn} size="small" title="Zoom In">
                  <ZoomIn />
                </IconButton>
                <IconButton onClick={handleZoomOut} size="small" title="Zoom Out">
                  <ZoomOut />
                </IconButton>
                <IconButton onClick={handleResetZoom} size="small" title="Fit to Screen">
                  <FitScreen />
                </IconButton>
                <IconButton onClick={handleExitFullscreen} size="small" title="Exit Fullscreen">
                  <FullscreenExit />
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
                      : zoom > 1
                        ? "grab"
                        : "default",
                  userSelect: disableInteractions ? "auto" : "none",
                  backgroundImage: "radial-gradient(circle, #f0f0f0 2px, transparent 2px)",
                  backgroundSize: "30px 30px",
                }}
              >
                <Box
                  sx={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: "center",
                    transition: isPanning ? "none" : "transform 0.2s",
                    opacity: isCalculatingZoom ? 0 : 1,
                    visibility: isCalculatingZoom ? "hidden" : "visible",
                  }}
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              </Box>
            ) : null}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
