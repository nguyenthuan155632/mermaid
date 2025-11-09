"use client";

import { useEffect } from "react";

type ConsoleArgs = Parameters<typeof console.error>;
type ConsoleMethod = (...args: ConsoleArgs) => void;

const getErrorLikeFields = (
  arg: unknown
): { message?: string; stack?: string } => {
  if (arg && typeof arg === "object") {
    return arg as { message?: string; stack?: string };
  }
  return {};
};

// Helper function to check if error is Monaco-related
const isMonacoError = (arg: unknown): boolean => {
  const errorString = String(arg);
  const { message, stack } = getErrorLikeFields(arg);
  const errorMessage = typeof message === "string" ? message : "";
  const stackTrace = typeof stack === "string" ? stack : "";

  return (
    errorString.includes("Canceled") ||
    errorString.includes("ERR Canceled") ||
    errorString.includes("Ju.cancel") ||
    errorString.includes("editor.api") ||
    stackTrace.includes("editor.api") ||
    stackTrace.includes("Ju.cancel") ||
    errorMessage.includes("Canceled")
  );
};

const patchConsoleMethod = (
  method: "error" | "warn",
  original: ConsoleMethod | null
): ConsoleMethod | null => {
  if (!original) {
    return null;
  }

  const patched: ConsoleMethod = (...args) => {
    if (args.some(isMonacoError)) {
      return;
    }
    original(...args);
  };

  console[method] = patched;
  return patched;
};

// Store the truly original console methods before any modifications
const ORIGINAL_ERROR =
  typeof window !== "undefined" ? console.error.bind(console) : null;
const ORIGINAL_WARN =
  typeof window !== "undefined" ? console.warn.bind(console) : null;

let patchedError: ConsoleMethod | null = null;
let patchedWarn: ConsoleMethod | null = null;

// Suppress Monaco Editor errors immediately on module load
if (typeof window !== "undefined") {
  // Intercept window.onerror for unhandled errors
  const originalOnError = window.onerror;
  const handleWindowError: OnErrorEventHandler = (
    message,
    source,
    lineno,
    colno,
    error
  ) => {
    if (isMonacoError(message) || isMonacoError(error)) {
      return true; // Prevent default error handling
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };
  window.onerror = handleWindowError;

  // Intercept unhandledrejection for promise rejections
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    if (isMonacoError(event.reason)) {
      event.preventDefault(); // Suppress the error
    }
  });

  patchedError = patchConsoleMethod("error", ORIGINAL_ERROR);
  patchedWarn = patchConsoleMethod("warn", ORIGINAL_WARN);
}

export default function ErrorSuppressor() {
  useEffect(() => {
    // Additional runtime check to ensure suppression stays active
    const interval = setInterval(() => {
      if (typeof window === "undefined") {
        return;
      }

      if (patchedError && console.error !== patchedError) {
        patchedError = patchConsoleMethod("error", ORIGINAL_ERROR);
      }

      if (patchedWarn && console.warn !== patchedWarn) {
        patchedWarn = patchConsoleMethod("warn", ORIGINAL_WARN);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
