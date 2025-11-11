import { Box, Avatar, Typography, Tooltip, Chip } from "@mui/material";
import { UserInfo } from "@/hooks/useWebSocket";
import {
  getAnonymousDisplayName,
  getAnonymousAvatarColor,
  getAnonymousAvatarInitials,
  generateDeterministicSessionId,
} from "@/lib/anonymousSession";

interface UserPresenceProps {
  users: Map<string, UserInfo>;
  currentUserId?: string;
  maxVisible?: number;
  anonymousMode?: boolean;
}

export function UserPresence({ users, currentUserId, maxVisible = 3, anonymousMode = false }: UserPresenceProps) {
  // Convert Map to array and filter out current user
  const usersArray = Array.from(users.values());
  const otherUsers = usersArray.filter((user: UserInfo) => user.id !== currentUserId);
  const visibleUsers = otherUsers.slice(0, maxVisible);
  const remainingCount = otherUsers.length - visibleUsers.length;

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[UserPresence]', {
      totalUsers: usersArray.length,
      currentUserId,
      otherUsersCount: otherUsers.length,
      willRender: otherUsers.length > 0,
      users: usersArray.map(u => ({ id: u.id, name: u.name, isAnonymous: u.isAnonymous, anonymousSessionId: u.anonymousSessionId }))
    });
  }

  if (otherUsers.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[UserPresence] Returning null - no other users');
    }
    return null;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[UserPresence] Rendering component with', otherUsers.length, 'users');
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        padding: 1,
        backgroundColor: "rgba(25, 118, 210, 0.04)",
        borderRadius: 1,
        border: "1px solid rgba(25, 118, 210, 0.12)",
        visibility: "visible",
        opacity: 1,
        pointerEvents: "auto",
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
        {otherUsers.length === 1 ? "1 viewer" : `${otherUsers.length} viewers`}
      </Typography>

      {/* Visible user avatars */}
      {visibleUsers.map((user: UserInfo, index: number) => {
        const isAnonymousUser = anonymousMode || user.isAnonymous;

        // Get display name and avatar info for anonymous users
        let displayName: string;
        let avatarColor: string;
        let avatarInitials: string;

        if (isAnonymousUser) {
          // Try to use anonymousSessionId if available
          let sessionId: string;
          if (user.anonymousSessionId) {
            sessionId = user.anonymousSessionId;
          } else if (user.id) {
            // Fallback: generate deterministic session ID from user ID
            sessionId = generateDeterministicSessionId(user.id);
          } else {
            // Last resort: use a default
            sessionId = generateDeterministicSessionId(`user-${index}`);
          }

          displayName = getAnonymousDisplayName(sessionId);
          avatarColor = getAnonymousAvatarColor(sessionId);
          avatarInitials = getAnonymousAvatarInitials(sessionId);
        } else {
          displayName = user.name || user.email || 'Anonymous';
          avatarColor = "#9e9e9e";
          avatarInitials = getUserInitials(user);
        }

        return (
          <Tooltip
            key={user.id || `user-${index}`}
            title={displayName}
            placement="top"
            arrow
          >
            <Avatar
              src={isAnonymousUser ? undefined : user.image}
              alt={displayName}
              sx={{
                width: 24,
                height: 24,
                fontSize: "0.75rem",
                border: "2px solid white",
                marginLeft: index > 0 ? -1 : 0,
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                backgroundColor: isAnonymousUser ? avatarColor : undefined,
                color: isAnonymousUser ? "#ffffff" : undefined,
              }}
            >
              {isAnonymousUser ? avatarInitials : getUserInitials(user)}
            </Avatar>
          </Tooltip>
        );
      })}

      {/* Remaining users count */}
      {remainingCount > 0 && (
        <Chip
          key="remaining-users"
          label={`+${remainingCount}`}
          size="small"
          sx={{
            height: 24,
            fontSize: "0.7rem",
            backgroundColor: "grey.200",
            color: "grey.700",
            marginLeft: -0.5,
          }}
        />
      )}
    </Box>
  );
}

function getUserInitials(user: UserInfo): string {
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
