#!/usr/bin/env node

const { WebSocketServer } = require('ws');
const http = require('http');
const { parse } = require('url');

// Simple in-memory session store (in production, use Redis or similar)
const rooms = new Map();

const server = http.createServer();
const wss = new WebSocketServer({
  server,
  // Don't set path here, we'll handle routing manually
});

wss.on('connection', (ws, request) => {

  let userId = null;
  let diagramId = null;
  let userInfo = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'join_room':
          userId = message.userId;
          diagramId = extractDiagramId(request.url);

          // Extract user info and ensure proper structure
          userInfo = {
            id: message.data.userId || userId,
            name: message.data.userName,
            email: message.data.userEmail,
            image: message.data.userImage,
            isAnonymous: message.data.isAnonymous || false,
            anonymousSessionId: message.data.anonymousSessionId || undefined
          };

          // Add user to room
          if (!rooms.has(diagramId)) {
            rooms.set(diagramId, new Map());
          }

          // If user already exists (same userId), close the old connection first
          const room = rooms.get(diagramId);
          if (room.has(userId)) {
            const existingConnection = room.get(userId);
            if (existingConnection && existingConnection.ws !== ws) {
              // Set new connection FIRST to prevent race condition
              room.set(userId, { ws, userInfo });
              // Then close the old connection (this will trigger its close handler)
              const oldWs = existingConnection.ws;
              oldWs.close(1000, 'Replaced by new connection');
              // Skip the set below since we already set it above
              const currentUsers = getUniqueUsers(room);
              console.log(`[WS] User ${userId} replaced connection in room ${diagramId}. Total unique users: ${currentUsers.length}`);
              broadcastToRoom(diagramId, {
                type: 'user_presence',
                data: {
                  users: currentUsers
                },
                userId,
                timestamp: Date.now()
              });
              break;
            }
          }

          // Add/update user connection (only if not already set above)
          room.set(userId, { ws, userInfo });

          // Send current users to everyone in the room (deduplicated by userId)
          const currentUsers = getUniqueUsers(room);

          console.log(`[WS] User ${userId} joined room ${diagramId}. Total unique users: ${currentUsers.length}`);

          broadcastToRoom(diagramId, {
            type: 'user_presence',
            data: {
              users: currentUsers
            },
            userId,
            timestamp: Date.now()
          });
          break;

        case 'code_change':
          if (diagramId && userId) {
            broadcastToRoom(diagramId, {
              type: 'code_change',
              data: message.data,
              userId,
              timestamp: Date.now()
            }, ws); // Don't send back to sender
          }
          break;

        case 'cursor_move':
          if (diagramId && userId) {
            broadcastToRoom(diagramId, {
              type: 'cursor_move',
              data: message.data,
              userId,
              timestamp: Date.now()
            }, ws); // Don't send back to sender
          }
          break;

        case 'comment_position':
          if (diagramId && userId) {
            broadcastToRoom(diagramId, {
              type: 'comment_position',
              data: message.data,
              userId,
              timestamp: Date.now()
            }, ws); // Don't send back to sender
          }
          break;

        case 'comment_created':
          if (diagramId && userId) {
            broadcastToRoom(diagramId, {
              type: 'comment_created',
              data: message.data,
              userId,
              timestamp: Date.now()
            }, ws); // Don't send back to sender
          }
          break;

        case 'comment_updated':
          if (diagramId && userId) {
            broadcastToRoom(diagramId, {
              type: 'comment_updated',
              data: message.data,
              userId,
              timestamp: Date.now()
            }, ws); // Don't send back to sender
          }
          break;

        case 'comment_deleted':
          if (diagramId && userId) {
            broadcastToRoom(diagramId, {
              type: 'comment_deleted',
              data: message.data,
              userId,
              timestamp: Date.now()
            }, ws); // Don't send back to sender
          }
          break;

        case 'comment_resolved':
          if (diagramId && userId) {
            broadcastToRoom(diagramId, {
              type: 'comment_resolved',
              data: message.data,
              userId,
              timestamp: Date.now()
            }, ws); // Don't send back to sender
          }
          break;
      }
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (userId && diagramId) {
      // Remove user from room only if this is the current connection
      if (rooms.has(diagramId)) {
        const room = rooms.get(diagramId);
        const existingConnection = room.get(userId);

        // Only remove if this is the same connection (not replaced by a new one)
        if (existingConnection && existingConnection.ws === ws) {
          room.delete(userId);

          console.log(`[WS] User ${userId} left room ${diagramId}`);

          // Notify remaining users (deduplicated)
          const remainingUsers = getUniqueUsers(room);

          broadcastToRoom(diagramId, {
            type: 'user_presence',
            data: {
              users: remainingUsers
            },
            userId,
            timestamp: Date.now()
          });

          // Clean up empty rooms
          if (room.size === 0) {
            rooms.delete(diagramId);
          }
        } else {
          console.log(`[WS] Ignoring close for ${userId} - connection was replaced`);
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

function extractDiagramId(url) {
  if (!url) return null;

  try {
    const parsed = parse(url, true);
    const pathname = parsed.pathname;
    // Extract diagram ID from /api/diagrams/[id]/ws
    const match = pathname.match(/\/api\/diagrams\/([^\/]+)\/ws/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('❌ Error extracting diagram ID:', error);
    return null;
  }
}

// Deduplicate users by userId, keeping only the most recent connection
function getUniqueUsers(room) {
  const userMap = new Map();

  // Iterate through all connections and keep only the most recent one per userId
  room.forEach(({ ws, userInfo }) => {
    // Only include connections that are still open
    if (ws.readyState === 1) { // 1 = OPEN
      const userId = userInfo.id;
      // If user already exists, keep the existing one (first come first serve)
      // This ensures we don't duplicate users
      if (!userMap.has(userId)) {
        userMap.set(userId, userInfo);
      } else {
        console.log(`[WS] Duplicate user ${userId} detected, skipping`);
      }
    }
  });

  const uniqueUsers = Array.from(userMap.values());
  console.log(`[WS] getUniqueUsers: ${room.size} connections -> ${uniqueUsers.length} unique users`);
  return uniqueUsers;
}

function broadcastToRoom(diagramId, message, excludeWs = null) {
  if (!rooms.has(diagramId)) return;

  const room = rooms.get(diagramId);
  const messageStr = JSON.stringify(message);

  room.forEach(({ ws }) => {
    if (ws !== excludeWs && ws.readyState === 1) { // 1 = OPEN
      ws.send(messageStr);
    }
  });
}

server.listen(4026, () => {
});

// Graceful shutdown
process.on('SIGTERM', () => {
  wss.close();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  wss.close();
  server.close(() => {
    process.exit(0);
  });
});
