import { Buffer } from "buffer";

export type ExportFormat = "png" | "svg";
export type ExportBackground = "white" | "transparent";

export interface ExportLinkConfig {
  diagramId: string;
  format: ExportFormat;
  resolution: number;
  background: ExportBackground;
  token?: string | null;
}

const UUID_BYTE_LENGTH = 16;

const FORMAT_BITS: Record<ExportFormat, number> = {
  png: 0,
  svg: 1,
};

const BACKGROUND_BITS: Record<ExportBackground, number> = {
  white: 0,
  transparent: 1,
};

const uuidToBytes = (uuid: string): Uint8Array => {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) {
    throw new Error("Invalid UUID");
  }
  const bytes = new Uint8Array(UUID_BYTE_LENGTH);
  for (let i = 0; i < UUID_BYTE_LENGTH; i += 1) {
    const byteHex = hex.slice(i * 2, i * 2 + 2);
    bytes[i] = parseInt(byteHex, 16);
  }
  return bytes;
};

const bytesToUuid = (bytes: Uint8Array): string => {
  if (bytes.length !== UUID_BYTE_LENGTH) {
    throw new Error("UUID buffer must be 16 bytes");
  }
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const encodeBase64Url = (bytes: Uint8Array): string =>
  Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const decodeBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingNeeded = (4 - (normalized.length % 4)) % 4;
  const padded = normalized.padEnd(normalized.length + paddingNeeded, "=");
  return new Uint8Array(Buffer.from(padded, "base64"));
};

export const encodeExportLink = (config: ExportLinkConfig): string => {
  const resolutionIndex = Math.max(1, Math.min(4, Math.round(config.resolution))) - 1;
  const hasToken = Boolean(config.token);
  const byteLength = UUID_BYTE_LENGTH + 1 + (hasToken ? UUID_BYTE_LENGTH : 0);
  const bytes = new Uint8Array(byteLength);

  bytes.set(uuidToBytes(config.diagramId), 0);

  let flags = 0;
  flags |= FORMAT_BITS[config.format] & 0b1;
  flags |= (resolutionIndex & 0b11) << 1;
  flags |= (BACKGROUND_BITS[config.background] & 0b1) << 3;
  if (hasToken) {
    flags |= 0b1 << 4;
  }
  bytes[UUID_BYTE_LENGTH] = flags;

  if (hasToken && config.token) {
    bytes.set(uuidToBytes(config.token), UUID_BYTE_LENGTH + 1);
  }

  return encodeBase64Url(bytes);
};

export const decodeExportLink = (encoded: string): ExportLinkConfig => {
  const bytes = decodeBase64Url(encoded);
  if (bytes.length !== UUID_BYTE_LENGTH + 1 && bytes.length !== UUID_BYTE_LENGTH * 2 + 1) {
    throw new Error("Invalid export link payload");
  }

  const diagramBytes = bytes.slice(0, UUID_BYTE_LENGTH);
  const flags = bytes[UUID_BYTE_LENGTH];
  const hasToken = Boolean(flags & (0b1 << 4));

  const format: ExportFormat = (flags & 0b1) === 1 ? "svg" : "png";
  const resolution = ((flags >> 1) & 0b11) + 1;
  const background: ExportBackground = (flags & (0b1 << 3)) !== 0 ? "transparent" : "white";

  let token: string | undefined;
  if (hasToken) {
    if (bytes.length < UUID_BYTE_LENGTH * 2 + 1) {
      throw new Error("Token bytes missing");
    }
    const tokenBytes = bytes.slice(UUID_BYTE_LENGTH + 1);
    token = bytesToUuid(tokenBytes);
  }

  return {
    diagramId: bytesToUuid(diagramBytes),
    format,
    resolution,
    background,
    token,
  };
};
