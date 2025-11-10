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

console.log('🚀 WebSocket server starting on port 4026...');

wss.on('connection', (ws, request) => {
  console.log('📡 New WebSocket connection established');

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
            image: message.data.userImage
          };

          console.log(`👤 User ${userId} (${userInfo.name || userInfo.email}) joined diagram ${diagramId}`);

          // Add user to room
          if (!rooms.has(diagramId)) {
            rooms.set(diagramId, new Map());
          }
          rooms.get(diagramId).set(userId, { ws, userInfo });

          // Send current users to everyone in the room
          const currentUsers = Array.from(rooms.get(diagramId).values()).map(u => u.userInfo);
          console.log(`📊 Broadcasting ${currentUsers.length} users to room ${diagramId}:`, currentUsers.map(u => u.name || u.email));

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
            console.log(`📝 Code change in diagram ${diagramId} by user ${userId}`);
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
            console.log(`👆 Cursor move in diagram ${diagramId} by user ${userId}`);
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
            console.log(`📍 Comment position change in diagram ${diagramId} by user ${userId}`);
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
            console.log(`💬 Comment created in diagram ${diagramId} by user ${userId}`);
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
            console.log(`✏️ Comment updated in diagram ${diagramId} by user ${userId}`);
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
            console.log(`🗑️ Comment deleted in diagram ${diagramId} by user ${userId}`);
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
            console.log(`✅ Comment resolved status changed in diagram ${diagramId} by user ${userId}`);
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
      console.log(`👋 User ${userId} left diagram ${diagramId}`);

      // Remove user from room
      if (rooms.has(diagramId)) {
        rooms.get(diagramId).delete(userId);

        // Notify remaining users
        const remainingUsers = Array.from(rooms.get(diagramId).values()).map(u => u.userInfo);
        console.log(`📊 Broadcasting ${remainingUsers.length} remaining users to room ${diagramId}`);

        broadcastToRoom(diagramId, {
          type: 'user_presence',
          data: {
            users: remainingUsers
          },
          userId,
          timestamp: Date.now()
        });

        // Clean up empty rooms
        if (rooms.get(diagramId).size === 0) {
          rooms.delete(diagramId);
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
  console.log('✅ WebSocket server is running on port 4026');
  console.log('📡 WebSocket endpoint: ws://localhost:4026/api/diagrams/[id]/ws');
  console.log('🌐 Make sure your Next.js app is running and can connect to this server');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  wss.close();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  wss.close();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
