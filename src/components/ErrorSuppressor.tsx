"use client";

import { useEffect } from "react";

// Helper function to check if error is Monaco-related
const isMonacoError = (arg: any): boolean => {
  const errorString = String(arg);
  const errorMessage = arg?.message || '';
  const stackTrace = arg?.stack || '';

  return (
    errorString.includes('Canceled') ||
    errorString.includes('ERR Canceled') ||
    errorString.includes('Ju.cancel') ||
    errorString.includes('editor.api') ||
    stackTrace.includes('editor.api') ||
    stackTrace.includes('Ju.cancel') ||
    errorMessage.includes('Canceled')
  );
};

// Store the truly original console methods before any modifications
const ORIGINAL_ERROR = typeof window !== 'undefined' ? console.error.bind(console) : null;
const ORIGINAL_WARN = typeof window !== 'undefined' ? console.warn.bind(console) : null;

// Suppress Monaco Editor errors immediately on module load
if (typeof window !== 'undefined') {
  // Intercept window.onerror for unhandled errors
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (isMonacoError(message) || isMonacoError(error)) {
      return true; // Prevent default error handling
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Intercept unhandledrejection for promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (isMonacoError(event.reason)) {
      event.preventDefault(); // Suppress the error
    }
  });

  // Override console.error
  console.error = (...args: any[]) => {
    if (args.some(arg => isMonacoError(arg))) {
      // Suppress these harmless Monaco errors - don't log anything
      return;
    }

    // Pass through all other errors to the original console.error
    if (ORIGINAL_ERROR) {
      ORIGINAL_ERROR(...args);
    }
  };

  // Override console.warn
  console.warn = (...args: any[]) => {
    if (args.some(arg => isMonacoError(arg))) {
      return;
    }

    if (ORIGINAL_WARN) {
      ORIGINAL_WARN(...args);
    }
  };
}

export default function ErrorSuppressor() {
  useEffect(() => {
    // Additional runtime check to ensure suppression stays active
    const interval = setInterval(() => {
      // Re-apply suppression in case something overwrites console.error
      if (typeof console.error === 'function') {
        const testStr = console.error.toString();
        if (!testStr.includes('isMonacoError') && !testStr.includes('Canceled')) {
          // Console.error was overwritten, re-apply our suppression
          console.error = (...args: any[]) => {
            if (args.some(arg => isMonacoError(arg))) {
              return;
            }
            if (ORIGINAL_ERROR) {
              ORIGINAL_ERROR(...args);
            }
          };
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}

