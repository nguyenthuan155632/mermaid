import { Box, Avatar, Typography, Tooltip, Chip } from "@mui/material";
import { UserInfo } from "@/hooks/useWebSocket";

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

  if (otherUsers.length === 0) {
    return null;
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
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
        {otherUsers.length === 1 ? "1 viewer" : `${otherUsers.length} viewers`}
      </Typography>

      {/* Visible user avatars */}
      {visibleUsers.map((user: UserInfo, index: number) => {
        const isAnonymousUser = anonymousMode || user.isAnonymous;
        // For anonymous users, create unique display name from ID if name is generic
        let displayName: string;
        if (isAnonymousUser) {
          if (user.name && user.name !== 'Anonymous User' && user.name.startsWith('Anonymous ')) {
            // Already has unique name like "Anonymous abc123"
            displayName = user.name;
          } else if (user.id) {
            // Generate unique name from ID
            const idPart = user.id.split('_').pop()?.substring(0, 6) || user.id.substring(user.id.length - 6);
            displayName = `Anonymous ${idPart}`;
          } else {
            displayName = 'Anonymous User';
          }
        } else {
          displayName = user.name || user.email || 'Anonymous';
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
                backgroundColor: isAnonymousUser ? "grey.500" : undefined,
              }}
            >
              {getUserInitials({ ...user, isAnonymous: isAnonymousUser, name: displayName })}
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
  // For anonymous users, show first letter of the unique ID part
  if (user.isAnonymous) {
    // If name includes a unique ID (e.g., "Anonymous abc123"), show "A" + first letter of ID
    if (user.name && user.name.includes(' ') && user.name !== 'Anonymous User') {
      const parts = user.name.split(' ');
      if (parts.length > 1 && parts[1]) {
        return `A${parts[1].substring(0, 1).toUpperCase()}`;
      }
    }
    // Fallback: show first letter from ID if available
    if (user.id) {
      const idPart = user.id.split('_').pop()?.substring(0, 1) || user.id.substring(user.id.length - 1);
      return `A${idPart.toUpperCase()}`;
    }
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
