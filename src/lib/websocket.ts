import { initializeWebSocketServer } from "@/app/api/diagrams/[id]/ws/route";

// Initialize WebSocket server when this module is imported
let wsServerInitialized = false;

export function ensureWebSocketServer() {
  if (!wsServerInitialized) {
    initializeWebSocketServer();
    wsServerInitialized = true;
    console.log("WebSocket server started");
  }
}

// Auto-initialize when imported
ensureWebSocketServer();
