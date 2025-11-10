import { useState, useEffect, RefObject } from "react";
import { Box, Typography, Avatar, Tooltip } from "@mui/material";
import { UserInfo, CursorPosition } from "@/hooks/useWebSocket";

interface LiveCursorsProps {
  cursors: Map<string, CursorPosition>;
  users: Map<string, UserInfo>;
  currentUserId: string | undefined;
  editorRef: RefObject<HTMLElement | null>;
  anonymousMode?: boolean;
}

interface CursorWithPosition {
  userId: string;
  userInfo: UserInfo;
  position: { top: number; left: number };
  color: string;
}

export function LiveCursors({ cursors, users, currentUserId, editorRef, anonymousMode = false }: LiveCursorsProps) {
  const [cursorPositions, setCursorPositions] = useState<CursorWithPosition[]>([]);

  useEffect(() => {
    // Defer setState to avoid cascading renders
    const timeoutId = setTimeout(() => {
      if (cursors.size === 0) {
        setCursorPositions([]);
        return;
      }

      const getUserInfo = (userId: string): UserInfo | undefined => {
        return users.get(userId);
      };

      const getCursorPosition = (position: CursorPosition): { top: number; left: number } | null => {
        if (!editorRef?.current) return null;

        try {
          // This is a simplified calculation
          // In a real implementation, you'd need to calculate the exact position
          // based on the editor's line height and character width
          const lineHeight = 20; // Approximate line height in pixels
          const charWidth = 8; // Approximate character width in pixels

          return {
            top: position.line * lineHeight,
            left: position.column * charWidth,
          };
        } catch (error) {
          console.error("Error calculating cursor position:", error);
          return null;
        }
      };

      const positions: CursorWithPosition[] = Array.from(cursors.entries())
        .filter(([userId]) => userId !== currentUserId)
        .map(([userId, position]) => {
          const userInfo = getUserInfo(userId);
          const cursorPos = getCursorPosition(position);

          if (!userInfo || !cursorPos) return null;

          return {
            userId,
            userInfo,
            position: cursorPos,
            color: getUserColor(userId),
          };
        })
        .filter(Boolean) as CursorWithPosition[];

      setCursorPositions(positions);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [cursors, users, currentUserId, editorRef]);

  if (cursorPositions.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      {cursorPositions.map(({ userId, userInfo, position, color }) => {
        const isAnonymousUser = anonymousMode || userInfo.isAnonymous;
        return (
          <Tooltip
            key={userId}
            title={isAnonymousUser ? "Anonymous User" : (userInfo.name || userInfo.email || 'Anonymous')}
            placement="top"
            arrow
            componentsProps={{
              tooltip: {
                sx: {
                  backgroundColor: color,
                  color: "white",
                  fontSize: "0.75rem",
                  padding: "4px 8px",
                },
              },
              arrow: {
                sx: {
                  color: color,
                },
              },
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: position.top,
                left: position.left,
                display: "flex",
                alignItems: "center",
                transition: "all 0.2s ease-in-out",
              }}
            >
              {/* Cursor line */}
              <Box
                sx={{
                  width: 2,
                  height: 20,
                  backgroundColor: color,
                  animation: "blink 1s infinite",
                }}
              />

              {/* User avatar */}
              <Avatar
                src={isAnonymousUser ? undefined : userInfo.image}
                alt={isAnonymousUser ? "Anonymous User" : (userInfo.name || userInfo.email || 'Anonymous')}
                sx={{
                  width: 20,
                  height: 20,
                  fontSize: "0.6rem",
                  border: `2px solid ${color}`,
                  marginLeft: 0.5,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  backgroundColor: isAnonymousUser ? "grey.500" : undefined,
                }}
              >
                {getUserInitials({ ...userInfo, isAnonymous: isAnonymousUser })}
              </Avatar>
            </Box>
          </Tooltip>
        );
      })}

      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
      `}</style>
    </Box>
  );
}

function getUserColor(userId: string): string {
  // Generate a consistent color based on user ID
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2",
    "#F8B739", "#52B788", "#E76F51", "#8E44AD", "#3498DB"
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function getUserInitials(user: UserInfo): string {
  // Handle anonymous users
  if (user.isAnonymous) {
    return "A";
  }

  if (user.name) {
    const names = user.name.trim().split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return user.name.slice(0, 2).toUpperCase();
  }

  if (user.email) {
    return user.email.slice(0, 2).toUpperCase();
  }

  return "?";
}
