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

  // Debug logging
  console.log('👥 UserPresence render:', {
    totalUsers: usersArray.length,
    currentUserId,
    otherUsersCount: otherUsers.length,
    anonymousMode,
    users: usersArray.map(u => ({ id: u.id, name: u.name, email: u.email }))
  });

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
        return (
          <Tooltip
            key={user.id || `user-${index}`}
            title={isAnonymousUser ? "Anonymous User" : (user.name || user.email || 'Anonymous')}
            placement="top"
            arrow
          >
            <Avatar
              src={isAnonymousUser ? undefined : user.image}
              alt={isAnonymousUser ? "Anonymous User" : (user.name || user.email)}
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
              {getUserInitials({ ...user, isAnonymous: isAnonymousUser })}
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
  // For anonymous users, always show "A"
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
