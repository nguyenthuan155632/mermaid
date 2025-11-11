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

export type CommentEventType = "created" | "updated" | "deleted" | "resolved";

export interface LastCommentEvent {
  type: CommentEventType;
  event: CommentEvent;
  userId: string;
  timestamp: number;
}

// Singleton state manager for WebSocket - single source of truth for all WebSocket state
interface WSState {
  connectedUsers: Map<string, UserInfo>;
  lastCodeChange: { code: string; userId: string; timestamp: number } | null;
  cursors: Map<string, CursorPosition>;
  commentPositions: CommentPositionsMap;
  lastCommentEvent: LastCommentEvent | null;
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

export function useWebSocket(channelId: string | null, anonymousMode: boolean = false) {
  const { data: session } = useSession();
  const sessionRef = useRef(session);
  const anonymousUserIdRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<Map<string, UserInfo>>(wsStateManager.state.connectedUsers);
  const [lastCodeChange, setLastCodeChange] = useState<{ code: string; userId: string; timestamp: number } | null>(wsStateManager.state.lastCodeChange);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(wsStateManager.state.cursors);
  const [commentPositions, setCommentPositions] = useState<CommentPositionsMap>(wsStateManager.state.commentPositions);
  const [lastCommentEvent, setLastCommentEvent] = useState<LastCommentEvent | null>(wsStateManager.state.lastCommentEvent);

  // Only log on mount or when key values change, not on every render
  const prevChannelIdRef = useRef<string | null>(null);
  const prevSessionIdRef = useRef<string | undefined>(undefined);
  const prevAnonymousModeRef = useRef<boolean>(anonymousMode);

  useEffect(() => {
    const channelChanged = prevChannelIdRef.current !== channelId;
    const sessionChanged = prevSessionIdRef.current !== session?.user?.id;
    const anonymousModeChanged = prevAnonymousModeRef.current !== anonymousMode;

    if (channelChanged || sessionChanged || anonymousModeChanged) {
      prevChannelIdRef.current = channelId;
      prevSessionIdRef.current = session?.user?.id;
      prevAnonymousModeRef.current = anonymousMode;
    }
  }, [channelId, session?.user?.id, anonymousMode]);

  // Keep session ref updated
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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

  const getEffectiveUserId = useCallback(() => {
    if (sessionRef.current?.user?.id) {
      return sessionRef.current.user.id;
    }

    if (!anonymousUserIdRef.current) {
      anonymousUserIdRef.current = getAnonymousSessionId();
    }

    return anonymousUserIdRef.current;
  }, []);

  const getEffectiveUserInfo = useCallback(() => {
    const sessionUser = sessionRef.current?.user;
    if (sessionUser) {
      return {
        userId: sessionUser.id,
        userName: sessionUser.name,
        userEmail: sessionUser.email,
        userImage: sessionUser.image,
        isAnonymous: false,
      };
    }

    const fallbackId = getEffectiveUserId();
    return {
      userId: fallbackId,
      userName: "Anonymous",
      userEmail: "anonymous@example.com",
      userImage: null,
      isAnonymous: true,
      anonymousSessionId: fallbackId,
    };
  }, [getEffectiveUserId]);

  const connect = useCallback(() => {
    if (!channelId) return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const wsUrl = `ws://localhost:4026/api/diagrams/${channelId}/ws`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        if (wsRef.current) {
          const userInfo = getEffectiveUserInfo();
          const joinPayload = {
            userId: userInfo.userId,
            userName: userInfo.userName,
            userEmail: userInfo.userEmail,
            userImage: userInfo.userImage,
            isAnonymous: userInfo.isAnonymous,
            ...(userInfo.isAnonymous && userInfo.anonymousSessionId
              ? { anonymousSessionId: userInfo.anonymousSessionId }
              : {}),
          };

          wsRef.current.send(JSON.stringify({
            type: "join_room",
            data: joinPayload,
            userId: userInfo.userId,
            timestamp: Date.now(),
          }));
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
            if (channelId) {
              const wsUrl = `ws://localhost:4026/api/diagrams/${channelId}/ws`;
              const newWs = new WebSocket(wsUrl);
              wsRef.current = newWs;

              newWs.onopen = () => {
                setIsConnected(true);
                reconnectAttemptsRef.current = 0;

                if (newWs) {
                  const userInfo = getEffectiveUserInfo();
                  const joinPayload = {
                    userId: userInfo.userId,
                    userName: userInfo.userName,
                    userEmail: userInfo.userEmail,
                    userImage: userInfo.userImage,
                    isAnonymous: userInfo.isAnonymous,
                    ...(userInfo.isAnonymous && userInfo.anonymousSessionId
                      ? { anonymousSessionId: userInfo.anonymousSessionId }
                      : {}),
                  };

                  newWs.send(JSON.stringify({
                    type: "join_room",
                    data: joinPayload,
                    userId: userInfo.userId,
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
  }, [channelId, getEffectiveUserInfo]);

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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const userId = getEffectiveUserId();
      wsRef.current.send(JSON.stringify({
        type: "code_change",
        data: { code },
        userId,
        timestamp: Date.now(),
      }));
    }
  }, [getEffectiveUserId]);

  const sendCursorMove = useCallback((position: CursorPosition) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const userId = getEffectiveUserId();
      wsRef.current.send(JSON.stringify({
        type: "cursor_move",
        data: { position },
        userId,
        timestamp: Date.now(),
      }));
    }
  }, [getEffectiveUserId]);

  const sendCommentPosition = useCallback((commentPosition: CommentPosition) => {
    // Always update the local shared map so the initiator sees the new position immediately
    wsStateManager.updateCommentPosition(commentPosition.commentId, {
      x: commentPosition.x,
      y: commentPosition.y,
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const userId = getEffectiveUserId();
      const message = {
        type: "comment_position",
        data: commentPosition,
        userId,
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send comment_position - WebSocket not open, readyState:', wsRef.current?.readyState);
    }
  }, [getEffectiveUserId]);

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
    const userId = getEffectiveUserId();

    if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
      const message = {
        type: "comment_created",
        data: commentEvent,
        userId,
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send comment_created - WebSocket not open or no userId. readyState:', wsRef.current?.readyState, 'userId:', userId);
    }
  }, [getEffectiveUserId]); // Uses refs

  const sendCommentUpdated = useCallback((commentEvent: CommentEvent) => {
    const userId = getEffectiveUserId();

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
  }, [getEffectiveUserId]); // Uses refs

  const sendCommentDeleted = useCallback((commentEvent: CommentEvent) => {
    const userId = getEffectiveUserId();

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
  }, [getEffectiveUserId]); // Uses refs

  const sendCommentResolved = useCallback((commentEvent: CommentEvent) => {
    const userId = getEffectiveUserId();

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
  }, [getEffectiveUserId]); // Uses refs

  // Auto-connect when channelId changes
  useEffect(() => {
    if (!channelId) {
      disconnect();
      return;
    }

    // Always reset the connection before joining a new channel
    disconnect();

    const timeoutId = setTimeout(() => {
      connect();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [channelId, connect, disconnect]);

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
