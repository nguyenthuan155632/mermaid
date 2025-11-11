import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getAnonymousSessionId } from "@/lib/anonymousSession";

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
  isAnonymous?: boolean;
  anonymousSessionId?: string;
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
    // Don't clear connectedUsers - they should persist across reconnects
    this.state.lastCodeChange = null;
    this.state.cursors = new Map();
    this.state.commentPositions = {};
    this.state.lastCommentEvent = null;
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

export function useWebSocket(diagramId: string | null, anonymousMode: boolean = false) {
  const { data: session } = useSession();
  const sessionRef = useRef(session);
  const anonymousModeRef = useRef(anonymousMode);
  const anonymousUserIdRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<Map<string, UserInfo>>(wsStateManager.state.connectedUsers);
  const [lastCodeChange, setLastCodeChange] = useState<{ code: string; userId: string; timestamp: number } | null>(wsStateManager.state.lastCodeChange);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(wsStateManager.state.cursors);
  const [commentPositions, setCommentPositions] = useState<CommentPositionsMap>(wsStateManager.state.commentPositions);
  const [lastCommentEvent, setLastCommentEvent] = useState<{ type: "created" | "updated" | "deleted" | "resolved"; event: CommentEvent; userId: string; timestamp: number } | null>(wsStateManager.state.lastCommentEvent);

  // Only log on mount or when key values change, not on every render
  const prevDiagramIdRef = useRef<string | null>(null);
  const prevSessionIdRef = useRef<string | undefined>(undefined);
  const prevAnonymousModeRef = useRef<boolean>(anonymousMode);

  useEffect(() => {
    const diagramChanged = prevDiagramIdRef.current !== diagramId;
    const sessionChanged = prevSessionIdRef.current !== session?.user?.id;
    const anonymousModeChanged = prevAnonymousModeRef.current !== anonymousMode;

    if (diagramChanged || sessionChanged || anonymousModeChanged) {
      prevDiagramIdRef.current = diagramId;
      prevSessionIdRef.current = session?.user?.id;
      prevAnonymousModeRef.current = anonymousMode;
    }
  }, [diagramId, session?.user?.id, anonymousMode]);

  // Keep session and anonymousMode refs updated
  useEffect(() => {
    sessionRef.current = session;
    anonymousModeRef.current = anonymousMode;
  }, [session, anonymousMode]);

  // Subscribe to state manager updates
  useEffect(() => {
    const unsubscribe = wsStateManager.subscribe((state) => {
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
    if (!diagramId) return;

    // Don't connect if already connected or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // For anonymous mode, allow connection without session
    // For authenticated mode, wait for session to be available (it might be loading)
    if (!anonymousModeRef.current && !session?.user?.id) {
      return;
    }

    try {
      // Connect to WebSocket server on port 4026
      const wsUrl = `ws://localhost:4026/api/diagrams/${diagramId}/ws`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Send user info as headers (since we can't set headers in WebSocket constructor)
        if (wsRef.current) {
          if (anonymousModeRef.current) {
            // Use the same anonymous session ID from localStorage for consistency
            const anonymousSessionId = getAnonymousSessionId();
            const anonymousUserId = anonymousSessionId; // Use session ID as user ID
            anonymousUserIdRef.current = anonymousUserId; // Store for later use
            wsRef.current.send(JSON.stringify({
              type: "join_room",
              data: {
                userId: anonymousUserId,
                userName: "Anonymous", // Will be computed on server/client side
                userEmail: "anonymous@example.com",
                userImage: null,
                isAnonymous: true,
                anonymousSessionId: anonymousSessionId,
              },
              userId: anonymousUserId,
              timestamp: Date.now(),
            }));
          } else if (session?.user) {
            // Send authenticated user info
            wsRef.current.send(JSON.stringify({
              type: "join_room",
              data: {
                userId: session.user.id,
                userName: session.user.name,
                userEmail: session.user.email,
                userImage: session.user.image,
                isAnonymous: false,
              },
              userId: session.user.id,
              timestamp: Date.now(),
            }));
          }
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);

          switch (message.type) {
            case "user_presence":
              if (typeof message.data === "object" && message.data !== null) {
                const data = message.data as { users?: UserInfo[]; action?: string; user?: UserInfo };
                if (data.users) {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[WS] Received user_presence:', {
                      usersCount: data.users.length,
                      action: data.action,
                      users: data.users.map(u => ({ id: u.id, name: u.name, isAnonymous: u.isAnonymous, anonymousSessionId: u.anonymousSessionId }))
                    });
                  }
                  // Always update - server sends the current state of users
                  // Empty array means no other users, which is valid
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
        setIsConnected(false);
        // Don't clear state on disconnect - keep for display
        // State persists in singleton manager

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            // Use a direct connection attempt here to avoid circular dependency
            if (diagramId && (anonymousModeRef.current || session?.user?.id)) {
              const wsUrl = `ws://localhost:4026/api/diagrams/${diagramId}/ws`;
              const newWs = new WebSocket(wsUrl);
              wsRef.current = newWs;

              newWs.onopen = () => {
                setIsConnected(true);
                reconnectAttemptsRef.current = 0;

                if (newWs) {
                  if (anonymousModeRef.current) {
                    // Use the same anonymous session ID from localStorage for consistency
                    const anonymousSessionId = getAnonymousSessionId();
                    const anonymousUserId = anonymousSessionId; // Use session ID as user ID
                    anonymousUserIdRef.current = anonymousUserId; // Store for later use
                    newWs.send(JSON.stringify({
                      type: "join_room",
                      data: {
                        userId: anonymousUserId,
                        userName: "Anonymous", // Will be computed on server/client side
                        userEmail: "anonymous@example.com",
                        userImage: null,
                        isAnonymous: true,
                        anonymousSessionId: anonymousSessionId,
                      },
                      userId: anonymousUserId,
                      timestamp: Date.now(),
                    }));
                  } else if (session?.user) {
                    newWs.send(JSON.stringify({
                      type: "join_room",
                      data: {
                        userId: session.user.id,
                        userName: session.user.name,
                        userEmail: session.user.email,
                        userImage: session.user.image,
                        isAnonymous: false,
                      },
                      userId: session.user.id,
                      timestamp: Date.now(),
                    }));
                  }
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
  }, [diagramId, session]); // anonymousMode is accessed via ref to avoid dependency issues

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
  }, [session?.user?.id]);

  const sendCursorMove = useCallback((position: CursorPosition) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && session?.user?.id) {
      wsRef.current.send(JSON.stringify({
        type: "cursor_move",
        data: { position },
        userId: session.user.id,
        timestamp: Date.now(),
      }));
    }
  }, [session?.user?.id]);

  const sendCommentPosition = useCallback((commentPosition: CommentPosition) => {
    // Always update the local shared map so the initiator sees the new position immediately
    wsStateManager.updateCommentPosition(commentPosition.commentId, {
      x: commentPosition.x,
      y: commentPosition.y,
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Allow sending position updates in anonymous mode or when authenticated
      const userId = anonymousModeRef.current && anonymousUserIdRef.current
        ? anonymousUserIdRef.current
        : sessionRef.current?.user?.id;

      if (userId) {
        const message = {
          type: "comment_position",
          data: commentPosition,
          userId: userId,
          timestamp: Date.now(),
        };
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn('[WS] Cannot send comment_position - no userId available');
      }
    } else {
      console.warn('[WS] Cannot send comment_position - WebSocket not open, readyState:', wsRef.current?.readyState);
    }
  }, []); // No dependencies - uses refs

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
    const userId = anonymousModeRef.current && anonymousUserIdRef.current
      ? anonymousUserIdRef.current
      : sessionRef.current?.user?.id;

    if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
      const message = {
        type: "comment_created",
        data: commentEvent,
        userId: userId,
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send comment_created - WebSocket not open or no userId. readyState:', wsRef.current?.readyState, 'userId:', userId);
    }
  }, []); // No dependencies - uses refs

  const sendCommentUpdated = useCallback((commentEvent: CommentEvent) => {
    const userId = anonymousModeRef.current && anonymousUserIdRef.current
      ? anonymousUserIdRef.current
      : sessionRef.current?.user?.id;

    if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
      const message = {
        type: "comment_updated",
        data: commentEvent,
        userId: userId,
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send comment_updated - WebSocket not open or no userId. readyState:', wsRef.current?.readyState, 'userId:', userId);
    }
  }, []); // No dependencies - uses refs

  const sendCommentDeleted = useCallback((commentEvent: CommentEvent) => {
    const userId = anonymousModeRef.current && anonymousUserIdRef.current
      ? anonymousUserIdRef.current
      : sessionRef.current?.user?.id;

    if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
      const message = {
        type: "comment_deleted",
        data: commentEvent,
        userId: userId,
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send comment_deleted - WebSocket not open or no userId. readyState:', wsRef.current?.readyState, 'userId:', userId);
    }
  }, []); // No dependencies - uses refs

  const sendCommentResolved = useCallback((commentEvent: CommentEvent) => {
    const userId = anonymousModeRef.current && anonymousUserIdRef.current
      ? anonymousUserIdRef.current
      : sessionRef.current?.user?.id;

    if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
      const message = {
        type: "comment_resolved",
        data: commentEvent,
        userId: userId,
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send comment_resolved - WebSocket not open or no userId. readyState:', wsRef.current?.readyState, 'userId:', userId);
    }
  }, []); // No dependencies - uses refs

  // Auto-connect when diagramId or session changes
  useEffect(() => {
    // In anonymous mode, connect immediately if we have a diagramId
    // In authenticated mode, wait for session to be available
    const shouldConnect = diagramId && (
      anonymousMode ||
      (session?.user?.id !== undefined && session?.user?.id !== null)
    );

    // Defer setState calls to avoid cascading renders
    const timeoutId = setTimeout(() => {
      if (shouldConnect) {
        connect();
      } else if (!anonymousMode && session?.user?.id === null) {
        // Only disconnect if we're in authenticated mode and session is explicitly null (not just loading)
        disconnect();
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      // Only disconnect on cleanup if we're actually changing diagramId
      // Don't disconnect just because session is loading
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramId, session?.user?.id, anonymousMode]); // Intentionally exclude connect/disconnect to prevent infinite loops

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
