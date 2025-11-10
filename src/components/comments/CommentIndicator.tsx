"use client";

import { Box, Badge, Tooltip, IconButton, Menu, MenuItem } from "@mui/material";
import { Comment as CommentIcon, CheckCircle, MenuOpen } from "@mui/icons-material";
import { CommentIndicatorProps } from "./types";
import { useState, useRef } from "react";

export default function CommentIndicator({
  comment,
  isSelected,
  onClick,
  onSidebarClick,
  onPopupClick,
  zoom,
  pan,
  isPanning = false,
  isPinching = false,
  onDrag,
  onDragEnd,
  getContainerRect,
}: CommentIndicatorProps & { onSidebarClick?: () => void; onPopupClick?: () => void }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isContextMenuOpen = Boolean(anchorEl);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const dragMetadataRef = useRef({ isPointerDown: false, startX: 0, startY: 0, didDrag: false });
  const clickSuppressedRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerCaptureTargetRef = useRef<HTMLElement | null>(null);

  const toDiagramCoordinates = (clientX: number, clientY: number) => {
    const rect = getContainerRect?.();
    if (!rect) return null;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = (clientX - centerX - pan.x) / zoom;
    const y = (clientY - centerY - pan.y) / zoom;
    return { x, y };
  };

  const cleanupDragListeners = (
    moveHandler: (event: PointerEvent) => void,
    upHandler: (event: PointerEvent) => void,
    cancelHandler: (event: PointerEvent) => void,
  ) => {
    window.removeEventListener("pointermove", moveHandler);
    window.removeEventListener("pointerup", upHandler);
    window.removeEventListener("pointercancel", cancelHandler);
  };

  const releasePointer = (pointerId: number) => {
    if (pointerCaptureTargetRef.current?.hasPointerCapture?.(pointerId)) {
      pointerCaptureTargetRef.current.releasePointerCapture(pointerId);
    }
    pointerCaptureTargetRef.current = null;
  };

  const handleDragStart = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    pointerCaptureTargetRef.current = event.currentTarget as HTMLElement;
    pointerCaptureTargetRef.current.setPointerCapture?.(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    dragMetadataRef.current = {
      isPointerDown: true,
      startX: event.clientX,
      startY: event.clientY,
      didDrag: false,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      if (activePointerIdRef.current !== moveEvent.pointerId) return;
      if (!dragMetadataRef.current.isPointerDown) return;
      const deltaX = moveEvent.clientX - dragMetadataRef.current.startX;
      const deltaY = moveEvent.clientY - dragMetadataRef.current.startY;
      const distance = Math.abs(deltaX) + Math.abs(deltaY);

      if (!dragMetadataRef.current.didDrag && distance < 4) {
        return;
      }

      if (!dragMetadataRef.current.didDrag) {
        dragMetadataRef.current.didDrag = true;
        clickSuppressedRef.current = true;
        setIsDragging(true);
        setDragPosition({ x: comment.positionX, y: comment.positionY });
      }

      const coords = toDiagramCoordinates(moveEvent.clientX, moveEvent.clientY);
      if (!coords) return;
      setDragPosition(coords);
      onDrag?.(coords);
    };

    const endDrag = async (event: PointerEvent, shouldPersist: boolean) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }
      cleanupDragListeners(handleMove, handleUp, handleCancel);
      const { didDrag } = dragMetadataRef.current;
      dragMetadataRef.current = { isPointerDown: false, startX: 0, startY: 0, didDrag: false };
      activePointerIdRef.current = null;

      if (!didDrag) {
        releasePointer(event.pointerId);
        clickSuppressedRef.current = false;
        return;
      }

      setIsDragging(false);
      if (!shouldPersist) {
        releasePointer(event.pointerId);
        setDragPosition(null);
        clickSuppressedRef.current = false;
        return;
      }

      const coords = toDiagramCoordinates(event.clientX, event.clientY);
      if (!coords) {
        releasePointer(event.pointerId);
        setDragPosition(null);
        clickSuppressedRef.current = false;
        return;
      }

      setDragPosition(coords);
      try {
        await onDragEnd?.(coords);
      } catch (error) {
        console.error("Failed to finish drag:", error);
      } finally {
        releasePointer(event.pointerId);
        setDragPosition(null);
        clickSuppressedRef.current = false;
      }
    };

    const handleUp = (upEvent: PointerEvent) => {
      void endDrag(upEvent, true);
    };

    const handleCancel = (cancelEvent: PointerEvent) => {
      void endDrag(cancelEvent, false);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
  };
  // Calculate the position considering zoom and pan
  // Since diagram is centered, we position relative to center using 50% positioning
  // The actual positioning will be handled by the transform style

  const getCommentNumber = () => {
    // This would be calculated based on the order of comments
    // For now, we'll use a simple approach
    return comment.id.slice(0, 3).toUpperCase();
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleContextMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSidebarAction = () => {
    handleContextMenuClose();
    if (onSidebarClick) {
      onSidebarClick();
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    // Default behavior - open popup instead of sidebar
    if (clickSuppressedRef.current) {
      return;
    }
    if (onPopupClick) {
      onPopupClick();
    } else if (onClick) {
      onClick();
    }
  };

  const effectivePosition = dragPosition ?? { x: comment.positionX, y: comment.positionY };

  return (
    <Box
      sx={{
        position: "absolute",
        left: `50%`,
        top: `50%`,
        transform: `translate(-50%, -50%) translate(${effectivePosition.x * zoom + pan.x}px, ${effectivePosition.y * zoom + pan.y}px)`,
        zIndex: isSelected || isDragging ? 1000 : 100,
        pointerEvents: "auto",
        willChange: "transform",
        transition: (isPanning || isPinching || isDragging) ? "none" : "transform 0.2s",
        touchAction: "none",
      }}
    >
      <Tooltip
        title={
          <Box>
            <Box sx={{ fontWeight: "bold", mb: 0.5 }}>
              {comment.user.email}
            </Box>
            <Box sx={{ maxWidth: 200 }}>
              {comment.content.slice(0, 100)}
              {comment.content.length > 100 && "..."}
            </Box>
            <Box sx={{ fontSize: "0.75rem", mt: 0.5, opacity: 0.7 }}>
              {new Date(comment.createdAt).toLocaleDateString()}
            </Box>
          </Box>
        }
        arrow
        placement="top"
      >
        <IconButton
          onClick={handleClick}
          onPointerDown={handleDragStart}
          onContextMenu={handleContextMenu}
          sx={{
            width: 32,
            height: 32,
            p: 0,
            bgcolor: isSelected ? "primary.main" : "background.paper",
            color: isSelected ? "white" : "primary.main",
            border: isSelected ? "2px solid primary.main" : "2px solid",
            borderColor: isSelected ? "primary.main" : "primary.light",
            boxShadow: 2,
            transition: "all 0.2s ease",
            "&:hover": {
              bgcolor: "primary.main",
              color: "white",
              transform: "scale(1.1)",
            },
            position: "relative",
            touchAction: "none",
          }}
        >
          {comment.isResolved && (
            <CheckCircle
              sx={{
                position: "absolute",
                top: -8,
                right: -8,
                fontSize: 16,
                color: "success.main",
                bgcolor: "background.paper",
                borderRadius: "50%",
                border: "2px solid",
                borderColor: "success.main",
              }}
            />
          )}
          <CommentIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      {/* Comment number badge */}
      <Badge
        badgeContent={getCommentNumber()}
        sx={{
          position: "absolute",
          top: -8,
          right: -8,
          "& .MuiBadge-badge": {
            fontSize: "0.6rem",
            height: 16,
            minWidth: 16,
            bgcolor: isSelected ? "white" : "primary.main",
            color: isSelected ? "primary.main" : "white",
          },
        }}
      />

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={isContextMenuOpen}
        onClose={handleContextMenuClose}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            borderRadius: '6px',
            border: '1px solid #e9ecef',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            minWidth: '180px',
          },
        }}
      >
        <MenuItem onClick={handleSidebarAction} sx={{
          fontSize: '13px',
          color: '#202124',
          py: 0.5,
        }}>
          <MenuOpen fontSize="small" sx={{ mr: 1, color: '#5f6368' }} />
          Open in Sidebar
        </MenuItem>
      </Menu>
    </Box>
  );
}
