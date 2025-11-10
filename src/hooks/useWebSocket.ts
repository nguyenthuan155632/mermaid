import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface WSMessage {
  type: "join_room" | "leave_room" | "code_change" | "cursor_move" | "user_presence" | "comment_position" | "comment_created" | "comment_updated" | "comment_deleted" | "comment_resolved";
  data: unknown;
  userId: string;
  timestamp: number;
}

export interface UserInfo {
  id: string;
  name?: string;
  email?: string;
  image?: string;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface CommentPosition {
  commentId: string;
  x: number;
  y: number;
}

export interface CommentPositionsMap {
  [commentId: string]: { x: number; y: number };
}

export interface CommentEvent {
  commentId: string;
  comment?: unknown; // Full comment data for create/update
  isResolved?: boolean;
}

// Singleton state manager for WebSocket - single source of truth for all WebSocket state
interface WSState {
  connectedUsers: Map<string, UserInfo>;
  lastCodeChange: { code: string; userId: string; timestamp: number } | null;
  cursors: Map<string, CursorPosition>;
  commentPositions: CommentPositionsMap;
  lastCommentEvent: { type: "created" | "updated" | "deleted" | "resolved"; event: CommentEvent; userId: string; timestamp: number } | null;
}

type WSStateListener = (state: WSState) => void;

const wsStateManager = {
  state: {
    connectedUsers: new Map<string, UserInfo>(),
    lastCodeChange: null,
    cursors: new Map<string, CursorPosition>(),
    commentPositions: {},
    lastCommentEvent: null,
  } as WSState,

  listeners: new Set<WSStateListener>(),

  updateConnectedUsers(users: UserInfo[]) {
    const newMap = new Map(users.map(u => [u.id, u]));
    console.log('📝 wsStateManager.updateConnectedUsers:', {
      usersCount: users.length,
      users: users.map(u => ({ id: u.id, name: u.name, email: u.email })),
      mapSize: newMap.size
    });
    this.state.connectedUsers = newMap;
    this.notifyListeners();
  },

  updateCodeChange(code: string, userId: string, timestamp: number) {
    this.state.lastCodeChange = { code, userId, timestamp };
    this.notifyListeners();
  },

  updateCursor(userId: string, position: CursorPosition) {
    this.state.cursors = new Map(this.state.cursors);
    this.state.cursors.set(userId, position);
    this.notifyListeners();
  },

  updateCommentPosition(commentId: string, position: { x: number; y: number }) {
    this.state.commentPositions = {
      ...this.state.commentPositions,
      [commentId]: position,
    };
    this.notifyListeners();
  },

  updateCommentEvent(type: "created" | "updated" | "deleted" | "resolved", event: CommentEvent, userId: string, timestamp: number) {
    this.state.lastCommentEvent = { type, event, userId, timestamp };
    this.notifyListeners();
  },

  clearState() {
    this.state = {
      connectedUsers: new Map(),
      lastCodeChange: null,
      cursors: new Map(),
      commentPositions: {},
      lastCommentEvent: null,
    };
    this.notifyListeners();
  },

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  },

  subscribe(listener: WSStateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
};

export function useWebSocket(diagramId: string | null) {
  const { data: session } = useSession();
  const sessionRef = useRef(session);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<Map<string, UserInfo>>(wsStateManager.state.connectedUsers);
  const [lastCodeChange, setLastCodeChange] = useState<{ code: string; userId: string; timestamp: number } | null>(wsStateManager.state.lastCodeChange);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(wsStateManager.state.cursors);
  const [commentPositions, setCommentPositions] = useState<CommentPositionsMap>(wsStateManager.state.commentPositions);
  const [lastCommentEvent, setLastCommentEvent] = useState<{ type: "created" | "updated" | "deleted" | "resolved"; event: CommentEvent; userId: string; timestamp: number } | null>(wsStateManager.state.lastCommentEvent);

  console.log('🎣 useWebSocket hook initialized/rendered for diagramId:', diagramId, 'session:', session?.user?.id);

  // Keep session ref updated
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Subscribe to state manager updates
  useEffect(() => {
    const unsubscribe = wsStateManager.subscribe((state) => {
      console.log('🔔 wsStateManager notified listener:', {
        connectedUsersSize: state.connectedUsers.size,
        connectedUsers: Array.from(state.connectedUsers.values()).map(u => ({ id: u.id, name: u.name, email: u.email }))
      });
      setConnectedUsers(new Map(state.connectedUsers)); // Create new Map to force re-render
      setLastCodeChange(state.lastCodeChange);
      setCursors(state.cursors);
      setCommentPositions(state.commentPositions);
      setLastCommentEvent(state.lastCommentEvent);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!diagramId || !session?.user?.id) return;

    try {
      // Connect to WebSocket server on port 4026
      const wsUrl = `ws://localhost:4026/api/diagrams/${diagramId}/ws`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Send user info as headers (since we can't set headers in WebSocket constructor)
        if (wsRef.current && session.user) {
          // We'll send authentication info in first message instead
          wsRef.current.send(JSON.stringify({
            type: "join_room",
            data: {
              userId: session.user.id,
              userName: session.user.name,
              userEmail: session.user.email,
              userImage: session.user.image,
            },
            userId: session.user.id,
            timestamp: Date.now(),
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', message.type, message);

          switch (message.type) {
            case "user_presence":
              console.log('👥 Processing user_presence message, data:', message.data);
              if (typeof message.data === "object" && message.data !== null) {
                const data = message.data as { users?: UserInfo[]; action?: string; user?: UserInfo };
                console.log('👥 data.users exists?', !!data.users, 'data.users:', data.users);
                if (data.users) {
                  console.log(`🔄 Received user_presence update: ${data.users.length} users`, data.users);
                  wsStateManager.updateConnectedUsers(data.users);
                } else {
                  console.warn('⚠️ user_presence message has no users array!', data);
                }
              }
              break;

            case "code_change":
              if (typeof message.data === "object" && message.data !== null) {
                const data = message.data as { code: string };
                wsStateManager.updateCodeChange(data.code, message.userId, message.timestamp);
              }
              break;

            case "cursor_move":
              if (typeof message.data === "object" && message.data !== null) {
                const data = message.data as { position: CursorPosition };
                wsStateManager.updateCursor(message.userId, data.position);
              }
              break;

            case "comment_position":
              if (typeof message.data === "object" && message.data !== null) {
                const data = message.data as CommentPosition;
                wsStateManager.updateCommentPosition(data.commentId, { x: data.x, y: data.y });
              }
              break;

            case "comment_created":
              if (typeof message.data === "object" && message.data !== null) {
                const data = message.data as CommentEvent;
                wsStateManager.updateCommentEvent("created", data, message.userId, message.timestamp);
              }
              break;

            case "comment_updated":
              if (typeof message.data === "object" && message.data !== null) {
                const data = message.data as CommentEvent;
                wsStateManager.updateCommentEvent("updated", data, message.userId, message.timestamp);
              }
              break;

            case "comment_deleted":
              if (typeof message.data === "object" && message.data !== null) {
                const data = message.data as CommentEvent;
                wsStateManager.updateCommentEvent("deleted", data, message.userId, message.timestamp);
              }
              break;

            case "comment_resolved":
              if (typeof message.data === "object" && message.data !== null) {
                const data = message.data as CommentEvent;
                wsStateManager.updateCommentEvent("resolved", data, message.userId, message.timestamp);
              }
              break;
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        setIsConnected(false);
        // Don't clear state on disconnect - keep for display
        // State persists in singleton manager

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            // Use a direct connection attempt here to avoid circular dependency
            if (diagramId && session?.user?.id) {
              const wsUrl = `ws://localhost:4026/api/diagrams/${diagramId}/ws`;
              const newWs = new WebSocket(wsUrl);
              wsRef.current = newWs;

              newWs.onopen = () => {
                console.log("WebSocket reconnected");
                setIsConnected(true);
                reconnectAttemptsRef.current = 0;

                if (newWs && session.user) {
                  newWs.send(JSON.stringify({
                    type: "join_room",
                    data: {
                      userId: session.user.id,
                      userName: session.user.name,
                      userEmail: session.user.email,
                      userImage: session.user.image,
                    },
                    userId: session.user.id,
                    timestamp: Date.now(),
                  }));
                }
              };
            }
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Don't set isConnected to false here, let onclose handle it
      };

    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [diagramId, session]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }

    setIsConnected(false);
    // Don't clear state - it persists in singleton manager
  }, []);

  const sendCodeChange = useCallback((code: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && session?.user?.id) {
      wsRef.current.send(JSON.stringify({
        type: "code_change",
        data: { code },
        userId: session.user.id,
        timestamp: Date.now(),
      }));
    }
  }, [session]);

  const sendCursorMove = useCallback((position: CursorPosition) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && session?.user?.id) {
      wsRef.current.send(JSON.stringify({
        type: "cursor_move",
        data: { position },
        userId: session.user.id,
        timestamp: Date.now(),
      }));
    }
  }, [session]);

  const sendCommentPosition = useCallback((commentPosition: CommentPosition) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && session?.user?.id) {
      wsRef.current.send(JSON.stringify({
        type: "comment_position",
        data: commentPosition,
        userId: session.user.id,
        timestamp: Date.now(),
      }));
    }
  }, [session]);

  const clearCommentPosition = useCallback((commentId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [commentId]: _, ...rest } = wsStateManager.state.commentPositions;
    wsStateManager.state.commentPositions = rest;
    wsStateManager.notifyListeners();
  }, []);

  const clearAllCommentPositions = useCallback(() => {
    wsStateManager.clearState();
  }, []);

  const sendCommentCreated = useCallback((commentEvent: CommentEvent) => {
    console.log('[WS] sendCommentCreated called:', commentEvent);
    console.log('[WS] WebSocket state:', wsRef.current?.readyState, 'Session:', !!sessionRef.current?.user?.id);
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionRef.current?.user?.id) {
      const message = {
        type: "comment_created",
        data: commentEvent,
        userId: sessionRef.current.user.id,
        timestamp: Date.now(),
      };
      console.log('[WS] Sending comment_created:', message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send comment_created - WebSocket not open or no session');
    }
  }, []); // No dependencies - uses refs

  const sendCommentUpdated = useCallback((commentEvent: CommentEvent) => {
    console.log('[WS] sendCommentUpdated called:', commentEvent);
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionRef.current?.user?.id) {
      const message = {
        type: "comment_updated",
        data: commentEvent,
        userId: sessionRef.current.user.id,
        timestamp: Date.now(),
      };
      console.log('[WS] Sending comment_updated:', message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send comment_updated - WebSocket not open or no session');
    }
  }, []); // No dependencies - uses refs

  const sendCommentDeleted = useCallback((commentEvent: CommentEvent) => {
    console.log('[WS] sendCommentDeleted called:', commentEvent);
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionRef.current?.user?.id) {
      const message = {
        type: "comment_deleted",
        data: commentEvent,
        userId: sessionRef.current.user.id,
        timestamp: Date.now(),
      };
      console.log('[WS] Sending comment_deleted:', message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send comment_deleted - WebSocket not open or no session');
    }
  }, []); // No dependencies - uses refs

  const sendCommentResolved = useCallback((commentEvent: CommentEvent) => {
    console.log('[WS] sendCommentResolved called:', commentEvent);
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionRef.current?.user?.id) {
      const message = {
        type: "comment_resolved",
        data: commentEvent,
        userId: sessionRef.current.user.id,
        timestamp: Date.now(),
      };
      console.log('[WS] Sending comment_resolved:', message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send comment_resolved - WebSocket not open or no session');
    }
  }, []); // No dependencies - uses refs

  // Auto-connect when diagramId or session changes
  useEffect(() => {
    const shouldConnect = diagramId && session?.user?.id;

    // Defer setState calls to avoid cascading renders
    const timeoutId = setTimeout(() => {
      if (shouldConnect) {
        connect();
      } else {
        disconnect();
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramId, session?.user?.id]); // Intentionally exclude connect/disconnect to prevent infinite loops

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Defer setState call to avoid cascading renders
      setTimeout(disconnect, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally exclude disconnect - only run on mount/unmount

  return {
    isConnected,
    connectedUsers,
    lastCodeChange,
    cursors,
    commentPositions,
    lastCommentEvent,
    sendCodeChange,
    sendCursorMove,
    sendCommentPosition,
    clearCommentPosition,
    clearAllCommentPositions,
    sendCommentCreated,
    sendCommentUpdated,
    sendCommentDeleted,
    sendCommentResolved,
    connect,
    disconnect,
  };
}
