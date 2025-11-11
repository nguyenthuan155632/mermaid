import { WebSocketServer, WebSocket } from "ws";
import { db } from "@/db";
import { diagrams } from "@/db/schema";
import { eq, or } from "drizzle-orm";

// WebSocket message types
interface WSMessage {
  type: "join_room" | "leave_room" | "code_change" | "cursor_move" | "user_presence";
  data: unknown;
  userId: string;
  timestamp: number;
}

interface UserInfo {
  id: string;
  name?: string;
  email?: string;
  image?: string;
}

// Store active connections per diagram
const channelRooms = new Map<string, Set<WebSocket>>();
const userSockets = new Map<WebSocket, UserInfo>();

export async function GET() {
  // This is a hack to upgrade HTTP to WebSocket
  // Next.js doesn't have native WebSocket support in API routes
  // We'll use a different approach

  return new Response(
    "WebSocket endpoint. Please connect to ws://localhost:4026/api/diagrams/[id]/ws",
    { status: 200 }
  );
}

// WebSocket server setup (will be initialized separately)
let wss: WebSocketServer | null = null;

export function initializeWebSocketServer() {
  if (wss) return wss;

  wss = new WebSocketServer({
    port: 4026, // Different port for WebSocket
    path: `/api/diagrams/[id]/ws`
  });

  wss.on("connection", async (ws: WebSocket, request) => {
    try {
      // Extract diagram ID from URL
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      const pathParts = url.pathname.split("/");
      const requestedChannel = pathParts[pathParts.indexOf("diagrams") + 1];

      if (!requestedChannel) {
        ws.close(1008, "Channel identifier required");
        return;
      }

      // Verify user authentication (simplified for now)
      // In production, you'd want to pass auth token in query params
      const headers = request.headers as unknown as Record<string, string>;
      const userId = headers["x-user-id"];
      const userName = headers["x-user-name"];
      const userEmail = headers["x-user-email"];
      const userImage = headers["x-user-image"];

      if (!userId) {
        ws.close(1008, "Authentication required");
        return;
      }

      // Verify diagram exists and user has access
      const diagram = await db
        .select()
        .from(diagrams)
        .where(
          or(
            eq(diagrams.id, requestedChannel),
            eq(diagrams.shareToken, requestedChannel)
          )
        )
        .limit(1);

      if (diagram.length === 0) {
        ws.close(1008, "Diagram not found");
        return;
      }
      const diagramRecord = diagram[0];
      const channelId = diagramRecord.shareToken ?? diagramRecord.id;

      if (!channelId) {
        ws.close(1011, "Channel unavailable");
        return;
      }

      // Store user info
      const userInfo: UserInfo = {
        id: userId,
        name: userName || undefined,
        email: userEmail || undefined,
        image: userImage || undefined,
      };
      userSockets.set(ws, userInfo);

      // Add to diagram room
      if (!channelRooms.has(channelId)) {
        channelRooms.set(channelId, new Set());
      }
      channelRooms.get(channelId)!.add(ws);

      // Send current users list to new user
      const roomUsers = Array.from(channelRooms.get(channelId)!)
        .map(socket => userSockets.get(socket))
        .filter(Boolean);

      ws.send(JSON.stringify({
        type: "user_presence",
        data: { users: roomUsers },
        userId: "system",
        timestamp: Date.now(),
      }));

      // Notify other users about new user
      broadcastToRoom(channelId, {
        type: "user_presence",
        data: {
          users: roomUsers,
          action: "user_joined",
          user: userInfo
        },
        userId: "system",
        timestamp: Date.now(),
      }, ws);

      // Handle messages
      ws.on("message", (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());

          // Validate message
          if (!message.type || !message.userId) {
            return;
          }

          // Broadcast to room (excluding sender)
          broadcastToRoom(channelId, message, ws);

        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      });

      // Handle disconnection
      ws.on("close", () => {
        // Remove from room
        const room = channelRooms.get(channelId);
        if (room) {
          room.delete(ws);
          if (room.size === 0) {
            channelRooms.delete(channelId);
          }
        }

        // Remove user info
        userSockets.delete(ws);

        // Notify other users
        const remainingUsers = Array.from(channelRooms.get(channelId) || [])
          .map(socket => userSockets.get(socket))
          .filter(Boolean);

        broadcastToRoom(channelId, {
          type: "user_presence",
          data: {
            users: remainingUsers,
            action: "user_left",
            user: userInfo
          },
          userId: "system",
          timestamp: Date.now(),
        });
      });

      // Handle errors
      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });

    } catch (error) {
      console.error("Error in WebSocket connection:", error);
      ws.close(1011, "Internal server error");
    }
  });

  return wss;
}

function broadcastToRoom(channelId: string, message: WSMessage, excludeWs?: WebSocket) {
  const room = channelRooms.get(channelId);
  if (!room) return;

  const messageStr = JSON.stringify(message);

  room.forEach((ws) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

// Helper function to get room info
export function getRoomInfo(channelId: string) {
  const room = channelRooms.get(channelId);
  if (!room) return null;

  return {
    userCount: room.size,
    users: Array.from(room).map(ws => userSockets.get(ws)).filter(Boolean),
  };
}
