/**
 * Anonymous Session Management
 * 
 * Provides utilities for managing anonymous user sessions:
 * - Session UUID generation and persistence
 * - Deterministic animal name assignment based on session ID
 * - Deterministic avatar color assignment based on session ID
 */

interface Animal {
  name: string;
  color: string; // Hex color code
}

// List of 50 animals with associated colors
const ANIMALS: Animal[] = [
  { name: "Lion", color: "#FFA500" },
  { name: "Tiger", color: "#FF6347" },
  { name: "Elephant", color: "#808080" },
  { name: "Giraffe", color: "#FFD700" },
  { name: "Penguin", color: "#000000" },
  { name: "Dolphin", color: "#1E90FF" },
  { name: "Bear", color: "#8B4513" },
  { name: "Wolf", color: "#696969" },
  { name: "Fox", color: "#FF8C00" },
  { name: "Rabbit", color: "#FFFFFF" },
  { name: "Deer", color: "#D2691E" },
  { name: "Horse", color: "#8B4513" },
  { name: "Cow", color: "#F5F5DC" },
  { name: "Pig", color: "#FFB6C1" },
  { name: "Sheep", color: "#F0F8FF" },
  { name: "Goat", color: "#D3D3D3" },
  { name: "Monkey", color: "#CD853F" },
  { name: "Zebra", color: "#000000" },
  { name: "Kangaroo", color: "#D2691E" },
  { name: "Koala", color: "#A9A9A9" },
  { name: "Panda", color: "#000000" },
  { name: "Hippo", color: "#708090" },
  { name: "Rhino", color: "#696969" },
  { name: "Crocodile", color: "#228B22" },
  { name: "Snake", color: "#32CD32" },
  { name: "Eagle", color: "#8B4513" },
  { name: "Owl", color: "#654321" },
  { name: "Parrot", color: "#FF1493" },
  { name: "Peacock", color: "#0000FF" },
  { name: "Flamingo", color: "#FF69B4" },
  { name: "Swan", color: "#FFFFFF" },
  { name: "Duck", color: "#FFD700" },
  { name: "Chicken", color: "#FFA500" },
  { name: "Rooster", color: "#FF4500" },
  { name: "Cat", color: "#FFA500" },
  { name: "Dog", color: "#8B4513" },
  { name: "Hamster", color: "#D2691E" },
  { name: "Mouse", color: "#808080" },
  { name: "Rat", color: "#696969" },
  { name: "Squirrel", color: "#8B4513" },
  { name: "Beaver", color: "#654321" },
  { name: "Otter", color: "#4682B4" },
  { name: "Seal", color: "#708090" },
  { name: "Whale", color: "#191970" },
  { name: "Shark", color: "#C0C0C0" },
  { name: "Octopus", color: "#8B008B" },
  { name: "Jellyfish", color: "#FF69B4" },
  { name: "Crab", color: "#DC143C" },
  { name: "Lobster", color: "#FF4500" },
  { name: "Butterfly", color: "#FF1493" },
  { name: "Bee", color: "#FFD700" },
];

const STORAGE_KEY = "mermaid-anonymous-session-id";

/**
 * Simple hash function to convert UUID string to number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a UUID v4 (fallback if crypto.randomUUID is not available)
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a deterministic UUID-like string from a seed (e.g., comment ID)
 * This ensures the same seed always produces the same "session ID"
 */
export function generateDeterministicSessionId(seed: string): string {
  // Use a simple hash to create a deterministic UUID-like string
  const hash = hashString(seed);

  // Convert hash to UUID v4 format (but deterministic)
  const hex = Math.abs(hash).toString(16).padStart(32, '0').substring(0, 32);

  // Format as UUID: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4${hex.substring(13, 16)}-${((hash & 0x3) | 0x8).toString(16)}${hex.substring(17, 20)}-${hex.substring(20, 32)}`;
}

/**
 * Get or create anonymous session ID
 * Stores the UUID in localStorage for persistence across page refreshes
 */
export function getAnonymousSessionId(): string {
  if (typeof window === "undefined") {
    // Server-side: generate a new UUID (shouldn't happen in practice)
    return generateUUID();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // Validate that stored value is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(stored)) {
        return stored;
      }
      // If stored value is invalid, generate a new one
      console.warn("Invalid stored session ID, generating new one");
    }

    // Generate new UUID
    const sessionId = generateUUID();
    localStorage.setItem(STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    // Fallback if localStorage is not available
    console.warn("localStorage not available, generating temporary session ID");
    return generateUUID();
  }
}

/**
 * Get deterministic animal name based on session ID
 */
export function getAnonymousDisplayName(sessionId: string): string {
  const hash = hashString(sessionId);
  const index = hash % ANIMALS.length;
  return ANIMALS[index].name;
}

/**
 * Get deterministic avatar color based on session ID
 */
export function getAnonymousAvatarColor(sessionId: string): string {
  const hash = hashString(sessionId);
  const index = hash % ANIMALS.length;
  return ANIMALS[index].color;
}

/**
 * Get avatar initials (first letter of animal name)
 */
export function getAnonymousAvatarInitials(sessionId: string): string {
  const displayName = getAnonymousDisplayName(sessionId);
  return displayName.charAt(0).toUpperCase();
}

/**
 * Get all anonymous user info for a session ID
 */
export function getAnonymousUserInfo(sessionId: string): {
  sessionId: string;
  displayName: string;
  avatarColor: string;
  avatarInitials: string;
} {
  return {
    sessionId,
    displayName: getAnonymousDisplayName(sessionId),
    avatarColor: getAnonymousAvatarColor(sessionId),
    avatarInitials: getAnonymousAvatarInitials(sessionId),
  };
}

